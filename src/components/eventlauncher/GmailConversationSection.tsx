import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail,
  Send,
  RefreshCw,
  Square,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Check,
  Radio,
  Edit3,
  User,
  UsersRound,
  Wrench,
  Palette,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  initAuth,
  signInWithGoogle,
  signOutGoogle,
  sendGmailMessage,
  fetchGmailThread,
  composeAgentEmail,
  cleanEmailBody,
  type GmailMessageSummary,
} from "@/lib/gmail-client";
import type { User as FirebaseUser } from "firebase/auth";
import { AVAILABLE_AGENTS, type EventAgent } from "./Activity";

interface Props {
  eventDetails: {
    date?: string;
    time?: string;
    venue?: string;
    speaker?: string;
    audience?: number;
    topic?: string;
  };
}

export type ConversationStatus =
  | "idle"
  | "drafting"
  | "awaiting_approval"
  | "sending"
  | "sent"
  | "waiting_for_reply"
  | "reply_received"
  | "following_up"
  | "completed"
  | "stopped"
  | "error";

export interface LiveMessageItem {
  id: string;
  sender: "agent" | "recipient";
  senderName: string;
  senderEmail: string;
  time: string;
  body: string;
  isAI?: boolean;
  rfcId?: string;
}

export function GmailConversationSection({ eventDetails }: Props) {
  // Auth state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Agent configuration
  const [selectedAgentId, setSelectedAgentId] = useState<"guests" | "operations" | "design" | "venue">("guests");
  const selectedAgent = AVAILABLE_AGENTS.find((a) => a.id === selectedAgentId) || AVAILABLE_AGENTS[0];
  const SelectedAgentIcon = selectedAgent.icon;

  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [topicContext, setTopicContext] = useState(selectedAgent.defaultTopic);

  // Status & drafting
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isEditingDraft, setIsEditingDraft] = useState(false);

  // Live messages & polling
  const [threadId, setThreadId] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveMessageItem[]>([]);
  const [aiMessageCount, setAiMessageCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [isCheckingReply, setIsCheckingReply] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const statusRef = useRef(status);
  statusRef.current = status;
  const aiMessageCountRef = useRef(aiMessageCount);
  aiMessageCountRef.current = aiMessageCount;
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  // Initialize Auth State Listener
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAuthToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setCurrentUser(null);
        setAuthToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAgentSelect = (agentId: "guests" | "operations" | "design" | "venue") => {
    setSelectedAgentId(agentId);
    const agent = AVAILABLE_AGENTS.find((a) => a.id === agentId);
    if (agent && status === "idle") {
      setTopicContext(agent.defaultTopic);
      if (!recipientName) setRecipientName(agent.sampleRecipientName);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      const res = await signInWithGoogle();
      setCurrentUser(res.user);
      setAuthToken(res.accessToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in with Google.";
      setAuthError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    setCurrentUser(null);
    setAuthToken(null);
  };

  const handleGenerateDraft = async () => {
    if (!recipientEmail.trim() || !recipientEmail.includes("@")) {
      setErrorMessage("Please enter a valid recipient Gmail address.");
      return;
    }
    setErrorMessage(null);
    setStatus("drafting");

    try {
      const generated = await composeAgentEmail({
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim() || "Recipient",
        eventDetails: {
          date: eventDetails?.date || "November 24, 2026",
          time: eventDetails?.time || "14:00",
          venue: eventDetails?.venue || "North Hall Auditorium",
          speaker: eventDetails?.speaker || "Dr. Maya Chen",
          audience: eventDetails?.audience || 180,
          topic: topicContext,
        },
        conversationHistory: [],
        isFollowUp: false,
      });

      setDraftSubject(generated.subject);
      setDraftBody(generated.body);
      setStatus("awaiting_approval");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to draft email with AI agent.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  const handleApproveAndSend = async () => {
    if (!authToken) {
      setErrorMessage("Please sign in with Google to send via Gmail.");
      return;
    }
    setShowApprovalModal(false);
    setStatus("sending");
    setErrorMessage(null);

    try {
      const result = await sendGmailMessage(authToken, {
        to: recipientEmail.trim(),
        subject: draftSubject,
        body: draftBody,
        agentName: selectedAgent.name,
      });

      const sentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const initialMsg: LiveMessageItem = {
        id: result.id,
        sender: "agent",
        senderName: selectedAgent.name,
        senderEmail: currentUser?.email || selectedAgent.email,
        time: sentTime,
        body: draftBody,
        isAI: true,
      };

      knownMessageIdsRef.current = new Set([result.id]);
      setThreadId(result.threadId);
      threadIdRef.current = result.threadId;
      setLiveMessages([initialMsg]);
      setAiMessageCount(1);
      aiMessageCountRef.current = 1;
      setStatus("waiting_for_reply");
      setCountdown(10);
      setLastCheckTime(sentTime);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send email through Gmail.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  const checkForReplies = useCallback(
    async (isManual = false) => {
      const activeTid = threadIdRef.current;
      if (!authToken || !activeTid) return;
      if (statusRef.current !== "waiting_for_reply" && !isManual) return;

      setIsCheckingReply(true);
      try {
        const messages: GmailMessageSummary[] = await fetchGmailThread(
          authToken,
          activeTid,
          currentUser?.email || undefined
        );

        setLastCheckTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        const newReplies = messages.filter(
          (m) => !knownMessageIdsRef.current.has(m.id) && !m.isFromMe
        );

        if (newReplies.length > 0) {
          const latestReply = newReplies[newReplies.length - 1];
          knownMessageIdsRef.current.add(latestReply.id);

          const replyTime = new Date(latestReply.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const replyMsg: LiveMessageItem = {
            id: latestReply.id,
            sender: "recipient",
            senderName: recipientName || latestReply.from.split("<")[0].trim() || "Recipient",
            senderEmail: latestReply.from,
            time: replyTime,
            body: cleanEmailBody(latestReply.body),
            isAI: false,
            rfcId: latestReply.rfcMessageId,
          };

          const updatedMessages = [...liveMessages, replyMsg];
          setLiveMessages(updatedMessages);
          setStatus("reply_received");

          if (aiMessageCountRef.current < 3 && statusRef.current !== "stopped") {
            setStatus("following_up");

            const history = updatedMessages.map((m) => ({
              sender: m.sender === "agent" ? selectedAgent.name : m.senderName,
              body: cleanEmailBody(m.body),
            }));

            const followUpDraft = await composeAgentEmail({
              agentId: selectedAgent.id,
              agentName: selectedAgent.name,
              recipientEmail: recipientEmail.trim(),
              recipientName: recipientName.trim() || "Recipient",
              eventDetails: {
                date: eventDetails?.date || "November 24, 2026",
                time: eventDetails?.time || "14:00",
                venue: eventDetails?.venue || "North Hall Auditorium",
                speaker: eventDetails?.speaker || "Dr. Maya Chen",
                audience: eventDetails?.audience || 180,
                topic: topicContext,
              },
              conversationHistory: history,
              isFollowUp: true,
            });

            const followUpResult = await sendGmailMessage(authToken, {
              to: recipientEmail.trim(),
              subject: draftSubject.startsWith("Re:") ? draftSubject : `Re: ${draftSubject}`,
              body: followUpDraft.body,
              agentName: selectedAgent.name,
              threadId: activeTid,
              inReplyToRfcId: latestReply.rfcMessageId,
            });

            knownMessageIdsRef.current.add(followUpResult.id);

            const followUpTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const followUpMsg: LiveMessageItem = {
              id: followUpResult.id,
              sender: "agent",
              senderName: selectedAgent.name,
              senderEmail: currentUser?.email || selectedAgent.email,
              time: followUpTime,
              body: followUpDraft.body,
              isAI: true,
            };

            const newAiCount = aiMessageCountRef.current + 1;
            setAiMessageCount(newAiCount);
            aiMessageCountRef.current = newAiCount;
            setLiveMessages([...updatedMessages, followUpMsg]);

            if (newAiCount >= 3) {
              setStatus("completed");
            } else {
              setStatus("waiting_for_reply");
              setCountdown(10);
            }
          } else {
            setStatus("completed");
          }
        }
      } catch (err: unknown) {
        console.warn("Error polling thread replies:", err);
      } finally {
        setIsCheckingReply(false);
      }
    },
    [
      authToken,
      currentUser?.email,
      recipientName,
      liveMessages,
      selectedAgent,
      recipientEmail,
      eventDetails,
      topicContext,
      draftSubject,
    ]
  );

  useEffect(() => {
    if (status !== "waiting_for_reply") return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          checkForReplies(false);
          return 10;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, checkForReplies]);

  const handleStopConversation = () => {
    setStatus("stopped");
  };

  const handleResetConversation = () => {
    setStatus("idle");
    setLiveMessages([]);
    setThreadId(null);
    threadIdRef.current = null;
    setDraftSubject("");
    setDraftBody("");
    setAiMessageCount(0);
    aiMessageCountRef.current = 0;
    setErrorMessage(null);
    knownMessageIdsRef.current = new Set();
  };

  const renderStatusBadge = (currentStatus: ConversationStatus) => {
    switch (currentStatus) {
      case "drafting":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-500/20">
            <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
            Drafting Email...
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 border border-amber-300">
            <AlertCircle className="h-3 w-3 text-amber-700" />
            Awaiting Approval
          </span>
        );
      case "sending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-700 border border-blue-500/20">
            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            Sending via Gmail...
          </span>
        );
      case "sent":
      case "waiting_for_reply":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 border border-indigo-200">
            <Radio className="h-3 w-3 animate-pulse text-indigo-600" />
            Waiting for Reply ({countdown}s)
          </span>
        );
      case "reply_received":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 border border-teal-300">
            <Check className="h-3 w-3 text-teal-600" />
            Reply Received
          </span>
        );
      case "following_up":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 border border-purple-200">
            <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
            Agent Following Up...
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="h-3 w-3 text-emerald-700" />
            Completed ({aiMessageCount} emails)
          </span>
        );
      case "stopped":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-300">
            <Square className="h-3 w-3 text-slate-500" />
            Stopped
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-200">
            <AlertCircle className="h-3 w-3 text-rose-600" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Ready
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Account Connection */}
      <div className="rounded-xl border border-border/80 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-light text-sage-dark">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Email Integration (Gmail)</p>
              <p className="text-[11px] text-muted-foreground">
                {currentUser ? `Connected as ${currentUser.email}` : "Sign in to send and receive real agent emails"}
              </p>
            </div>
          </div>

          <div>
            {!currentUser ? (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
              >
                {isAuthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Sign in with Google
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <Check className="h-3 w-3 text-emerald-600" /> Active
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {authError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* 2. Step-by-step form: Agent, Recipient, Topic */}
      <div className="rounded-xl border border-border/80 bg-white p-5 shadow-2xs space-y-4">
        {/* Agent selection */}
        <div>
          <label className="block text-[11px] font-semibold text-foreground mb-1.5">
            1. Select AI Agent Persona
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AVAILABLE_AGENTS.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              const Icon = agent.icon;
              return (
                <button
                  key={agent.id}
                  type="button"
                  disabled={status !== "idle" && status !== "error"}
                  onClick={() => handleAgentSelect(agent.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-sage-light/60 ring-1 ring-primary/30"
                      : "border-border bg-[#FAFAF8] hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {agent.name.replace(" Agent", "")}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient inputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-border/60">
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              2. Recipient Email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="email"
                disabled={status !== "idle" && status !== "error"}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-lg border border-border bg-[#FAFAF8] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Recipient Name (Optional)
            </label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                disabled={status !== "idle" && status !== "error"}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Dr. Maya Chen"
                className="w-full rounded-lg border border-border bg-[#FAFAF8] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Topic Context */}
        <div>
          <label className="block text-[11px] font-semibold text-foreground mb-1">
            3. Discussion Focus & Context
          </label>
          <input
            type="text"
            disabled={status !== "idle" && status !== "error"}
            value={topicContext}
            onChange={(e) => setTopicContext(e.target.value)}
            placeholder="e.g. Keynote arrival time, AV rider specifications, monitor requirements"
            className="w-full rounded-lg border border-border bg-[#FAFAF8] px-3 py-1.5 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Draft action button */}
        {status === "idle" && (
          <div className="flex justify-end pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={!recipientEmail.trim() || !currentUser}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                !recipientEmail.trim() || !currentUser
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-sage-dark shadow-2xs cursor-pointer"
              )}
            >
              <Send className="h-3 w-3" />
              Draft Email with {selectedAgent.name.replace(" Agent", "")}
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-[10px] font-semibold underline">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 3. Awaiting Approval Gate */}
      {status === "awaiting_approval" && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                !
              </span>
              <h3 className="text-xs font-bold text-amber-950">Review Agent Draft Before Sending</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingDraft(!isEditingDraft)}
              className="text-[11px] font-semibold text-amber-900 hover:underline flex items-center gap-1"
            >
              <Edit3 className="h-3 w-3" />
              {isEditingDraft ? "Done Editing" : "Edit Text"}
            </button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-2 text-xs">
            <div>
              <span className="text-[10px] font-medium text-muted-foreground">Subject:</span>
              {isEditingDraft ? (
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="mt-0.5 w-full rounded border border-border p-1 text-xs"
                />
              ) : (
                <p className="font-semibold text-foreground">{draftSubject}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground">Body:</span>
              {isEditingDraft ? (
                <textarea
                  rows={6}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="mt-0.5 w-full rounded border border-border p-1.5 text-xs font-sans leading-relaxed"
                />
              ) : (
                <p className="whitespace-pre-line text-foreground/90 leading-relaxed font-sans mt-0.5">
                  {draftBody}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetConversation}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowApprovalModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-sage-dark"
            >
              <Check className="h-3.5 w-3.5" />
              Approve & Send via Gmail
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-white p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Confirm Dispatch</h3>
            <p className="text-xs text-muted-foreground">
              Send this message to <strong>{recipientEmail}</strong> using your Google account?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Review Again
              </button>
              <button
                type="button"
                onClick={handleApproveAndSend}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-sage-dark"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Live Conversation */}
      {liveMessages.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-[#FAFAF8] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SelectedAgentIcon className="h-4 w-4 text-sage-dark" />
              <span className="text-xs font-semibold text-foreground">{draftSubject}</span>
            </div>
            <div className="flex items-center gap-2">
              {renderStatusBadge(status)}
              {status === "waiting_for_reply" && (
                <button
                  type="button"
                  onClick={() => checkForReplies(true)}
                  disabled={isCheckingReply}
                  className="rounded border border-border bg-white px-2 py-0.5 text-[10px] text-foreground hover:bg-muted"
                >
                  {isCheckingReply ? "Checking..." : "Check Replies"}
                </button>
              )}
              {status !== "stopped" && status !== "completed" && (
                <button
                  type="button"
                  onClick={handleStopConversation}
                  className="rounded px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                >
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={handleResetConversation}
                className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
              >
                New Conversation
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto soft-scroll bg-[#FAF9F5]/40">
            {liveMessages.map((msg) => {
              const isAgent = msg.sender === "agent";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-xl border p-3.5 space-y-2 text-xs",
                    isAgent ? "border-primary/20 bg-white ml-4 shadow-2xs" : "border-teal-200 bg-teal-50/50 mr-4 shadow-2xs"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5 text-[11px]">
                    <span className="font-semibold text-foreground">
                      {msg.senderName} {isAgent ? "(AI Agent)" : "(Recipient)"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="whitespace-pre-line text-foreground/90 leading-relaxed font-sans">
                    {cleanEmailBody(msg.body)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
