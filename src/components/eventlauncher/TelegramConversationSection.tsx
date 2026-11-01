import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Sparkles,
  User,
  UsersRound,
  Wrench,
  Palette,
  Building2,
  RefreshCw,
  Play,
  Square,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Check,
  Radio,
  Edit3,
  ExternalLink,
  MessageSquare,
  Phone,
  AtSign,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cleanEmailBody, composeAgentEmail } from "@/lib/gmail-client";
import {
  fetchTelegramStatus,
  fetchTelegramRecentChats,
  sendTelegramMessage,
  fetchTelegramUpdates,
  resolveTelegramRecipient,
  type TelegramStatusResponse,
  type TelegramChatSummary,
  type TelegramMessageItem,
  type RecipientInputMode,
  type RecipientResolutionResult,
} from "@/lib/telegram-client";
import { AVAILABLE_AGENTS } from "./Activity";

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

type ConversationStatus =
  | "idle"
  | "drafting"
  | "awaiting_approval"
  | "sending"
  | "sent"
  | "waiting_for_reply"
  | "reply_received"
  | "following_up"
  | "completed"
  | "error"
  | "stopped";

export function TelegramConversationSection({ eventDetails }: Props) {
  // Telegram Bot Connection & Secret Status
  const [botStatus, setBotStatus] = useState<TelegramStatusResponse | null>(null);
  const [isCheckingBotStatus, setIsCheckingBotStatus] = useState(true);

  // Recent Chats Helper
  const [recentChats, setRecentChats] = useState<TelegramChatSummary[]>([]);
  const [isLoadingRecentChats, setIsLoadingRecentChats] = useState(false);
  const [showRecentChatsDropdown, setShowRecentChatsDropdown] = useState(false);

  // Agent Selection
  const [selectedAgentId, setSelectedAgentId] = useState<"guests" | "operations" | "design" | "venue">("operations");
  const selectedAgent = AVAILABLE_AGENTS.find((a) => a.id === selectedAgentId) || AVAILABLE_AGENTS[0];
  const SelectedAgentIcon = selectedAgent.icon;

  // Flexible Recipient Configuration (Chat ID, Username, or Phone Number)
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientInputMode, setRecipientInputMode] = useState<RecipientInputMode>("auto");
  const [recipientChatId, setRecipientChatId] = useState("");
  const [recipientTgName, setRecipientTgName] = useState("");
  const [resolutionResult, setResolutionResult] = useState<RecipientResolutionResult | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [topicContext, setTopicContext] = useState(selectedAgent.defaultTopic);

  // Conversation Execution State
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Active Telegram Conversation Data
  const [liveMessages, setLiveMessages] = useState<TelegramMessageItem[]>([]);
  const [aiMessageCount, setAiMessageCount] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [isCheckingReply, setIsCheckingReply] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const liveMessagesRef = useRef(liveMessages);
  liveMessagesRef.current = liveMessages;
  const lastMessageIdRef = useRef<number>(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const aiMessageCountRef = useRef(aiMessageCount);
  aiMessageCountRef.current = aiMessageCount;
  const recipientChatIdRef = useRef(recipientChatId);
  recipientChatIdRef.current = recipientChatId;

  // 1. Check Telegram Bot Connection Status
  const verifyBotConnection = useCallback(async () => {
    setIsCheckingBotStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetchTelegramStatus();
      setBotStatus(res);
      if (!res.ok && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to verify Telegram bot connection");
    } finally {
      setIsCheckingBotStatus(false);
    }
  }, []);

  useEffect(() => {
    verifyBotConnection();
  }, [verifyBotConnection]);

  // Load recent chats
  const loadRecentChats = async () => {
    setIsLoadingRecentChats(true);
    try {
      const chats = await fetchTelegramRecentChats();
      setRecentChats(chats);
      setShowRecentChatsDropdown(true);
    } catch {
      // Ignored
    } finally {
      setIsLoadingRecentChats(false);
    }
  };

  // Recipient resolution handler
  const handleResolve = useCallback(
    async (input: string, mode: RecipientInputMode = recipientInputMode) => {
      const cleanInput = input.trim();
      if (!cleanInput) {
        setResolutionResult(null);
        setRecipientChatId("");
        return;
      }

      setIsResolving(true);
      try {
        const result = await resolveTelegramRecipient({ input: cleanInput, mode });
        setResolutionResult(result);
        if (result.resolved && result.chatId) {
          setRecipientChatId(result.chatId);
          if (result.name && !recipientTgName) {
            setRecipientTgName(result.name);
          }
        } else {
          setRecipientChatId("");
        }
      } catch (err) {
        setResolutionResult({
          ok: false,
          resolved: false,
          type: "unknown",
          error: err instanceof Error ? err.message : "Failed to resolve recipient",
        });
        setRecipientChatId("");
      } finally {
        setIsResolving(false);
      }
    },
    [recipientInputMode, recipientTgName]
  );

  // Debounced auto-resolution when typing in the recipient field
  useEffect(() => {
    if (!recipientInput.trim()) {
      setResolutionResult(null);
      setRecipientChatId("");
      return;
    }

    const timer = setTimeout(() => {
      handleResolve(recipientInput, recipientInputMode);
    }, 450);

    return () => clearTimeout(timer);
  }, [recipientInput, recipientInputMode, handleResolve]);

  // Agent change handler
  const handleAgentSelect = (agentId: "guests" | "operations" | "design" | "venue") => {
    if (status !== "idle" && status !== "error") return;
    setSelectedAgentId(agentId);
    const agent = AVAILABLE_AGENTS.find((a) => a.id === agentId);
    if (agent) {
      setTopicContext(agent.defaultTopic);
    }
  };

  // Step 3: Have Agent Draft Initial Telegram Message
  const handleGenerateDraft = async () => {
    if (!recipientChatId.trim()) {
      if (resolutionResult && !resolutionResult.resolved) {
        setErrorMessage(
          resolutionResult.error || "Please resolve and verify the Telegram recipient before drafting."
        );
      } else {
        setErrorMessage("Please enter a valid Telegram recipient (Username, Phone Number, or Chat ID).");
      }
      return;
    }

    setStatus("drafting");
    setErrorMessage(null);

    try {
      const draft = await composeAgentEmail({
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        recipientEmail: `tg:${recipientChatId}`,
        recipientName: recipientTgName || "Colleague",
        eventDetails: {
          date: eventDetails.date || "November 24, 2026",
          time: eventDetails.time || "14:00 (2:00 PM)",
          venue: eventDetails.venue || "North Hall Auditorium",
          speaker: eventDetails.speaker || "Dr. Maya Chen",
          topic: topicContext,
        },
        conversationHistory: [],
        isFollowUp: false,
      });

      setDraftBody(draft.body);
      setStatus("awaiting_approval");
      setIsEditingDraft(false);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to compose agent draft");
    }
  };

  // Step 5: Send Initial Approved Telegram Message
  const handleApproveAndSend = async () => {
    setShowApprovalModal(false);
    setStatus("sending");
    setErrorMessage(null);

    try {
      const result = await sendTelegramMessage({
        chatId: recipientChatId.trim(),
        text: draftBody.trim(),
        agentName: selectedAgent.name,
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const initialMessage: TelegramMessageItem = {
        id: `tg-${result.messageId}`,
        messageId: result.messageId,
        sender: "agent",
        senderName: selectedAgent.name,
        senderIdentifier: `@${botStatus?.bot?.username || "Eventlauncher_bot"}`,
        time: timeStr,
        body: draftBody.trim(),
        isAI: true,
        timestamp: result.date || Date.now(),
      };

      lastMessageIdRef.current = result.messageId;
      setLiveMessages([initialMessage]);
      setAiMessageCount(1);
      aiMessageCountRef.current = 1;

      setStatus("waiting_for_reply");
      setCountdown(10);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to dispatch Telegram message");
    }
  };

  // Step 6: Check for Real Telegram Replies & Autonomous Follow-up
  const checkForReplies = useCallback(
    async (isManual: boolean = false) => {
      const currentChatId = recipientChatIdRef.current;
      if (!currentChatId || statusRef.current !== "waiting_for_reply") return;

      if (isManual) setIsCheckingReply(true);

      try {
        const newUpdates = await fetchTelegramUpdates({
          chatId: currentChatId,
          sinceMessageId: lastMessageIdRef.current,
        });

        setLastCheckTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        if (newUpdates.length > 0) {
          // Highest message ID seen
          const maxId = Math.max(...newUpdates.map((m) => m.messageId));
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, maxId);

          // Append new incoming messages to conversation stream
          setLiveMessages((prev) => [...prev, ...newUpdates]);

          // Transition to Reply Received
          setStatus("reply_received");

          // Check if conversation should finish or auto follow-up
          if (aiMessageCountRef.current >= 3) {
            setStatus("completed");
            return;
          }

          // Trigger Autonomous Follow-up
          setStatus("following_up");

          const updatedHistory = [
            ...liveMessagesRef.current,
            ...newUpdates,
          ].map((m) => ({
            sender: m.sender === "agent" ? selectedAgent.name : "Recipient",
            body: m.body,
          }));

          const followUpDraft = await composeAgentEmail({
            agentId: selectedAgent.id,
            agentName: selectedAgent.name,
            recipientEmail: `tg:${currentChatId}`,
            recipientName: recipientTgName || "Colleague",
            eventDetails: {
              date: eventDetails.date || "November 24, 2026",
              time: eventDetails.time || "14:00 (2:00 PM)",
              venue: eventDetails.venue || "North Hall Auditorium",
              speaker: eventDetails.speaker || "Dr. Maya Chen",
              topic: topicContext,
            },
            conversationHistory: updatedHistory,
            isFollowUp: true,
          });

          // Send the follow-up message to Telegram
          const followUpResult = await sendTelegramMessage({
            chatId: currentChatId,
            text: followUpDraft.body,
            agentName: selectedAgent.name,
            replyToMessageId: maxId,
          });

          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, followUpResult.messageId);

          const now = new Date();
          const followUpMessage: TelegramMessageItem = {
            id: `tg-${followUpResult.messageId}`,
            messageId: followUpResult.messageId,
            sender: "agent",
            senderName: selectedAgent.name,
            senderIdentifier: `@${botStatus?.bot?.username || "Eventlauncher_bot"}`,
            time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            body: followUpDraft.body,
            isAI: true,
            timestamp: followUpResult.date || Date.now(),
          };

          setLiveMessages((prev) => [...prev, followUpMessage]);
          const newAiCount = aiMessageCountRef.current + 1;
          setAiMessageCount(newAiCount);
          aiMessageCountRef.current = newAiCount;

          if (newAiCount >= 3) {
            setStatus("completed");
          } else {
            setStatus("waiting_for_reply");
            setCountdown(10);
          }
        }
      } catch (err) {
        console.warn("Telegram reply polling error:", err);
      } finally {
        if (isManual) setIsCheckingReply(false);
      }
    },
    [selectedAgent, recipientTgName, eventDetails, topicContext, botStatus]
  );

  // Automatic Polling Interval (every 10s when waiting for reply)
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

  // Stop conversation handler
  const handleStopConversation = () => {
    setStatus("stopped");
  };

  // Reset conversation handler
  const handleResetConversation = () => {
    setStatus("idle");
    setLiveMessages([]);
    setDraftBody("");
    setAiMessageCount(0);
    aiMessageCountRef.current = 0;
    lastMessageIdRef.current = 0;
    setErrorMessage(null);
  };

  // Status Badge Component
  const renderStatusBadge = (currentStatus: ConversationStatus) => {
    switch (currentStatus) {
      case "drafting":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-500/20">
            <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
            Drafting Message...
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
            Sending via Telegram...
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Sent to Recipient
          </span>
        );
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
            <Sparkles className="h-3 w-3 animate-spin text-purple-600" />
            Agent Following Up...
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="h-3 w-3 text-emerald-700" />
            Conversation Completed ({aiMessageCount} AI messages)
          </span>
        );
      case "stopped":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-300">
            <Square className="h-3 w-3 text-slate-500" />
            Conversation Stopped
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
            Ready to Start
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Connection Banner */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-[#EEF4EA] to-[#F5F8F2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-sage-dark" />
              <h2 className="text-sm font-semibold text-foreground">
                Telegram Bot Integration:{" "}
                <span className="text-sage-dark">
                  {botStatus?.bot?.username ? `@${botStatus.bot.username}` : "@Eventlauncher_bot"}
                </span>
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              EventLauncher uses the official Telegram Bot API to compose, dispatch real messages, and autonomously follow up when recipients reply.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {botStatus?.ok ? (
              <div className="flex items-center gap-2 rounded-xl bg-white border border-emerald-300 px-3 py-1.5 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-800">Bot Active & Verified</span>
              </div>
            ) : (
              <button
                onClick={verifyBotConnection}
                disabled={isCheckingBotStatus}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isCheckingBotStatus && "animate-spin")} />
                {isCheckingBotStatus ? "Verifying..." : "Check Bot Status"}
              </button>
            )}

            <a
              href={`https://t.me/${botStatus?.bot?.username || "Eventlauncher_bot"}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-sage-dark transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Bot
            </a>
          </div>
        </div>

        {/* Informational Guidance for linking recipient */}
        <div className="mt-3 rounded-lg bg-white/70 border border-primary/20 p-2.5 text-[11px] text-foreground flex items-center justify-between gap-2">
          <span>
            💡 <strong>Quick Link:</strong> In Telegram, the recipient clicks <strong>Start</strong> or messages{" "}
            <strong>@{botStatus?.bot?.username || "Eventlauncher_bot"}</strong> to begin receiving agent messages.
          </span>
          <button
            type="button"
            onClick={loadRecentChats}
            disabled={isLoadingRecentChats}
            className="text-[10px] font-semibold text-sage-dark underline hover:no-underline shrink-0"
          >
            {isLoadingRecentChats ? "Detecting..." : "Detect Recent Senders"}
          </button>
        </div>

        {/* Dropdown of detected recent senders */}
        {showRecentChatsDropdown && (
          <div className="mt-2.5 rounded-xl border border-primary/30 bg-white p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">
                Detected Users Who Messaged @{botStatus?.bot?.username || "Eventlauncher_bot"} ({recentChats.length})
              </span>
              <button
                onClick={() => setShowRecentChatsDropdown(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            {recentChats.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No recent senders found. Open Telegram, send <code>/start</code> to @{botStatus?.bot?.username || "Eventlauncher_bot"}, then click &quot;Detect Recent Senders&quot;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {recentChats.map((chat) => (
                  <button
                    key={chat.chatId}
                    type="button"
                    onClick={() => {
                      const displayVal = chat.username ? `@${chat.username}` : chat.chatId;
                      setRecipientInput(displayVal);
                      setRecipientChatId(chat.chatId);
                      setRecipientTgName(chat.firstName || (chat.username ? `@${chat.username}` : "Colleague"));
                      setResolutionResult({
                        ok: true,
                        resolved: true,
                        type: chat.username ? "username" : "chat_id",
                        chatId: chat.chatId,
                        name: chat.firstName,
                        username: chat.username,
                        verified: true,
                        worksImmediately: true,
                        message: `Verified sender: ${chat.firstName || "User"} (${chat.chatId})`,
                      });
                      setShowRecentChatsDropdown(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[#FAFAF8] px-2.5 py-1 text-xs text-foreground hover:border-primary hover:bg-[#EEF4EA] transition-colors"
                  >
                    <User className="h-3 w-3 text-sage-dark" />
                    <span className="font-medium">{chat.firstName || "User"}</span>
                    {chat.username && <span className="text-muted-foreground">(@{chat.username})</span>}
                    <span className="text-[10px] text-muted-foreground">ID: {chat.chatId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error notification if token check failed */}
        {!botStatus?.ok && botStatus?.error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span className="flex-1">{botStatus.error}</span>
          </div>
        )}
      </div>

      {/* Setup & Agent Configuration Card */}
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-xs space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              1. Select EventLauncher AI Agent
            </span>
            <span className="text-[10px] text-muted-foreground">Existing specialized agent personas</span>
          </div>

          {/* 4 Agent Selection Cards */}
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-[#EEF4EA] shadow-2xs ring-1 ring-primary/40"
                      : "border-border/70 bg-[#FBFAF7] hover:border-primary/30 hover:bg-[#F4F7F1]",
                    status !== "idle" && status !== "error" && "opacity-75 cursor-not-allowed"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-sage-light text-sage-dark"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {isSelected && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-semibold text-xs text-foreground">{agent.name.replace(" Agent", "")}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {agent.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient Details & Topic */}
        <div className="pt-2 border-t border-border/50 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              {/* Recipient Format Tabs & Auto-Detect Header */}
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-foreground">
                  Recipient Identifier <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={loadRecentChats}
                  disabled={isLoadingRecentChats}
                  className="text-[10px] font-medium text-sage-dark hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={cn("h-2.5 w-2.5", isLoadingRecentChats && "animate-spin")} />
                  {isLoadingRecentChats ? "Detecting..." : "Detect Recent Senders"}
                </button>
              </div>

              {/* Selector Tabs: Auto-Detect, Username, Phone, Chat ID */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F2F4EE] border border-border/60 mb-2">
                {[
                  { id: "auto", label: "Auto-Detect", icon: Sparkles },
                  { id: "username", label: "Username (@)", icon: AtSign },
                  { id: "phone", label: "Phone (+)", icon: Phone },
                  { id: "chat_id", label: "Chat ID (#)", icon: Hash },
                ].map((modeItem) => {
                  const isActive = recipientInputMode === modeItem.id;
                  const Icon = modeItem.icon;
                  return (
                    <button
                      key={modeItem.id}
                      type="button"
                      disabled={status !== "idle" && status !== "error"}
                      onClick={() => {
                        setRecipientInputMode(modeItem.id as RecipientInputMode);
                        if (recipientInput.trim()) {
                          handleResolve(recipientInput.trim(), modeItem.id as RecipientInputMode);
                        }
                      }}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1 rounded-md py-1 text-[10px] font-medium transition-all",
                        isActive
                          ? "bg-white text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-3 w-3", isActive ? "text-sage-dark" : "text-muted-foreground")} />
                      <span>{modeItem.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Input Field with Left Icon & Right Badges */}
              <div className="relative">
                {recipientInputMode === "username" ? (
                  <AtSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                ) : recipientInputMode === "phone" ? (
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                ) : recipientInputMode === "chat_id" ? (
                  <Hash className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <MessageSquare className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                )}

                <input
                  type="text"
                  disabled={status !== "idle" && status !== "error"}
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder={
                    recipientInputMode === "username"
                      ? "e.g. @username or https://t.me/username"
                      : recipientInputMode === "phone"
                      ? "e.g. +8801XXXXXXXXX or +12125550199"
                      : recipientInputMode === "chat_id"
                      ? "e.g. 123456789 (numeric chat ID)"
                      : "Enter @username, +8801..., or numeric Chat ID"
                  }
                  className="w-full rounded-lg border border-border bg-[#FAFAF8] pl-8 pr-24 py-2 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 transition-colors"
                />

                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                  {isResolving ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin text-sage-dark" />
                      Checking...
                    </span>
                  ) : resolutionResult ? (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        resolutionResult.resolved
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {resolutionResult.type === "chat_id"
                        ? "Chat ID"
                        : resolutionResult.type === "username"
                        ? "Username"
                        : resolutionResult.type === "phone"
                        ? "Phone"
                        : "Unknown"}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Detected format feedback & validation state */}
              {resolutionResult && (
                <div className="mt-2 space-y-1.5">
                  {/* Successfully Resolved */}
                  {resolutionResult.resolved ? (
                    <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 p-2.5 text-[11px] text-emerald-900 flex items-start gap-2 shadow-2xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-emerald-950">
                          {resolutionResult.type === "chat_id" && "Chat ID Validated & Ready"}
                          {resolutionResult.type === "username" && `Username @${resolutionResult.username} Verified`}
                          {resolutionResult.type === "phone" && `Phone ${resolutionResult.phone} Verified`}
                        </p>
                        <p className="text-[10px] text-emerald-800 mt-0.5">
                          Target Chat ID: <strong>{resolutionResult.chatId}</strong>
                          {resolutionResult.name && <span> · Associated with <strong>{resolutionResult.name}</strong></span>}
                          {resolutionResult.worksImmediately && <span> · Messages will dispatch immediately</span>}
                        </p>
                      </div>
                    </div>
                  ) : resolutionResult.needsBotStart ? (
                    /* Recipient needs to start bot */
                    <div className="rounded-xl bg-amber-50/90 border border-amber-300 p-3 text-[11px] text-amber-900 shadow-2xs space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-amber-950">
                            {resolutionResult.type === "username"
                              ? `User @${resolutionResult.username} has not started @${resolutionResult.botUsername || "Eventlauncher_bot"} yet`
                              : "Recipient must connect to the Telegram Bot"}
                          </p>
                          <p className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                            {resolutionResult.error}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
                        <a
                          href={resolutionResult.actionUrl || `https://t.me/${botStatus?.bot?.username || "Eventlauncher_bot"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-sage-dark text-primary-foreground px-2.5 py-1 text-[10px] font-semibold transition-colors shadow-2xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Connect Telegram (@{resolutionResult.botUsername || botStatus?.bot?.username || "Eventlauncher_bot"})
                        </a>
                        <button
                          type="button"
                          onClick={() => handleResolve(recipientInput.trim(), recipientInputMode)}
                          disabled={isResolving}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white hover:bg-amber-100 text-amber-900 px-2.5 py-1 text-[10px] font-semibold transition-colors"
                        >
                          <RefreshCw className={cn("h-3 w-3", isResolving && "animate-spin")} />
                          Check Connection
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* General validation error (e.g. invalid format) */
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[10px] text-rose-700 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span>{resolutionResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-1 text-[10px] text-muted-foreground">
                Accepts Username (e.g. <code>@name</code>), Phone with country code (e.g. <code>+8801...</code>), or Chat ID (<code>123456789</code>).
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">
                Recipient Name (Optional)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  disabled={status !== "idle" && status !== "error"}
                  value={recipientTgName}
                  onChange={(e) => setRecipientTgName(e.target.value)}
                  placeholder="e.g. Elena Woods (Speaker Coordinator)"
                  className="w-full rounded-lg border border-border bg-[#FAFAF8] pl-8 pr-3 py-2 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Used by the agent for natural greetings in the dispatch message.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Event Coordination Focus & Context
            </label>
            <input
              type="text"
              disabled={status !== "idle" && status !== "error"}
              value={topicContext}
              onChange={(e) => setTopicContext(e.target.value)}
              placeholder="e.g. Confirm keynote AV specs, arrival time, and confidence monitor"
              className="w-full rounded-lg border border-border bg-[#FAFAF8] px-3 py-2 text-xs outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>

        {/* Action Bar for Drafting */}
        {status === "idle" && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-sage-dark" />
              <span>The agent will independently compose the outreach draft based on event context.</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={!recipientChatId.trim() || isResolving}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
                !recipientChatId.trim() || isResolving
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-sage-dark shadow-xs"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Have {selectedAgent.name.replace(" Agent", "")} Draft Telegram Message
            </button>
          </div>
        )}

        {/* Error banner if any */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[10px] font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* DRAFT REVIEW & APPROVAL GATE (MANDATORY APPROVAL) */}
      {status === "awaiting_approval" && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200 text-amber-900 font-semibold text-xs">
                <SelectedAgentIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-semibold text-amber-950">
                  Step 4: Review Agent Telegram Draft (Approval Required)
                </h3>
                <p className="text-[10px] text-amber-800">
                  Explicit approval is required before the agent dispatches this real message via Telegram.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditingDraft(!isEditingDraft)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              {isEditingDraft ? "Done Editing" : "Edit Draft"}
            </button>
          </div>

          {/* Draft Content Card */}
          <div className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Message Content (Composed by {selectedAgent.name})
                </label>
                <span className="text-[9px] text-muted-foreground">Recipient Chat ID: {recipientChatId}</span>
              </div>
              {isEditingDraft ? (
                <textarea
                  rows={6}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="mt-1 w-full rounded border border-border p-2 text-xs leading-relaxed text-foreground focus:border-primary outline-none"
                />
              ) : (
                <div className="mt-1 whitespace-pre-line rounded-lg bg-[#FBFAF7] p-3 text-xs leading-relaxed text-foreground border border-border/60">
                  {draftBody}
                </div>
              )}
            </div>
          </div>

          {/* Approval Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleGenerateDraft}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
            >
              Regenerate Draft
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetConversation}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-sage-dark transition-all cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Approve & Send via Telegram
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before real Telegram send */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm Sending Real Telegram Message
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  This will dispatch a real message via <strong>@{botStatus?.bot?.username || "Eventlauncher_bot"}</strong> to{" "}
                  <strong>Chat ID: {recipientChatId}</strong> ({recipientTgName || "Contact"}).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleApproveAndSend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-sage-dark shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm & Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE LIVE THREAD DISPLAY */}
      {liveMessages.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-xs">
          {/* Thread Header with Real-Time Controls */}
          <div className="border-b border-border/60 bg-[#FBFAF7] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-light text-sage-dark border border-primary/20">
                  <SelectedAgentIcon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      Telegram Channel · Chat {recipientChatId}
                    </h2>
                    {renderStatusBadge(status)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Bot: @{botStatus?.bot?.username || "Eventlauncher_bot"} · AI Messages Sent: {aiMessageCount}/3
                  </p>
                </div>
              </div>

              {/* Controls: Refresh / Stop / Reset */}
              <div className="flex items-center gap-2">
                {status === "waiting_for_reply" && (
                  <button
                    onClick={() => checkForReplies(true)}
                    disabled={isCheckingReply}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-[11px] font-medium text-sage-dark shadow-2xs hover:bg-[#EEF4EA] transition-colors"
                  >
                    <RefreshCw className={cn("h-3 w-3", isCheckingReply && "animate-spin")} />
                    {isCheckingReply ? "Checking..." : "Check Replies Now"}
                  </button>
                )}

                {status === "waiting_for_reply" && (
                  <button
                    onClick={handleStopConversation}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Square className="h-3 w-3 text-slate-400" />
                    Stop Polling
                  </button>
                )}

                {(status === "completed" || status === "stopped" || status === "error") && (
                  <button
                    onClick={handleResetConversation}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-sage-dark shadow-2xs transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    Start New Conversation
                  </button>
                )}
              </div>
            </div>

            {/* Sender & Recipient Information */}
            <div className="mt-3.5 grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-white p-3 text-[11px] sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Autonomous AI Agent: </span>
                <p className="font-semibold text-sage-dark">{selectedAgent.name}</p>
                <p className="text-[10px] text-muted-foreground">Bot: @{botStatus?.bot?.username || "Eventlauncher_bot"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Recipient: </span>
                <p className="font-medium text-foreground">{recipientTgName || "Telegram Contact"}</p>
                <p className="text-[10px] text-muted-foreground">Chat ID: {recipientChatId}</p>
              </div>
            </div>
          </div>

          {/* Status Banner when Waiting */}
          {status === "waiting_for_reply" && (
            <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/70 px-5 py-2.5 text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 animate-pulse text-indigo-600" />
                <span>
                  Waiting for reply in Telegram chat <strong>{recipientChatId}</strong>...
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-indigo-700">
                <span>Auto-checking in <strong>{countdown}s</strong></span>
                {lastCheckTime && <span>(Last checked: {lastCheckTime})</span>}
              </div>
            </div>
          )}

          {/* Status Banner when Autonomous Follow-up in progress */}
          {status === "following_up" && (
            <div className="flex items-center gap-2 border-b border-purple-200 bg-purple-50 px-5 py-2.5 text-xs text-purple-900">
              <Sparkles className="h-4 w-4 animate-spin text-purple-600" />
              <span>
                Telegram reply received! {selectedAgent.name} is evaluating the response and autonomously composing follow-up...
              </span>
            </div>
          )}

          {/* Chronological Back-and-Forth Stream (Vertical timeline aesthetic) */}
          <div className="space-y-4 p-4 sm:p-6 bg-[#FAFAF8]">
            {liveMessages.map((message, index) => {
              const isAgent = message.sender === "agent";
              const isLast = index === liveMessages.length - 1;

              return (
                <div key={message.id} className="relative pl-7 sm:pl-8">
                  {/* Vertical connecting line extending down to next message */}
                  {!isLast && (
                    <div
                      className="absolute left-[7px] sm:left-[9px] top-5 -bottom-4 w-[2px] bg-primary/35"
                      aria-hidden="true"
                    />
                  )}

                  {/* Node dot matching EventLauncher design */}
                  <div
                    className="absolute left-0 sm:left-0.5 top-3.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-white shadow-2xs"
                    aria-hidden="true"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>

                  {/* Horizontal connection arm from node to message card */}
                  <div
                    className="absolute left-4 sm:left-[18px] top-[1.35rem] h-[2px] w-3 sm:w-3.5 bg-primary/35"
                    aria-hidden="true"
                  />

                  {/* Message Box */}
                  <div
                    className={cn(
                      "flex flex-col gap-1 rounded-xl p-4 transition-shadow",
                      isAgent
                        ? "border border-primary/25 bg-[#EEF4EA] shadow-xs"
                        : "border border-[#E4DDD2] bg-[#F7F4ED]"
                    )}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                            isAgent
                              ? "bg-sage-dark text-white font-medium"
                              : "bg-muted text-foreground font-medium"
                          )}
                        >
                          {isAgent ? "AI" : <User className="h-3 w-3" />}
                        </span>
                        <span className="inline-flex items-center rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                          {message.senderName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isAgent ? "(Autonomous EventLauncher Agent)" : "(Telegram Recipient)"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{message.time}</span>
                    </div>

                    {/* Message Body */}
                    <div className="pt-2 text-xs leading-relaxed text-foreground whitespace-pre-line">
                      {cleanEmailBody(message.body)}
                    </div>

                    {/* Verification Pill */}
                    {!isAgent ? (
                      <div className="mt-2.5 flex items-center gap-1.5 pt-1 text-[10px] text-sage-dark font-medium border-t border-border/30">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Verified Telegram reply retrieved via official Bot API</span>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground border-t border-border/30">
                        <Send className="h-3 w-3 text-sage-dark" />
                        <span>Dispatched to Telegram chat · Delivered</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Summary */}
          <div className="border-t border-border/60 bg-white p-3.5 text-center text-[10px] text-muted-foreground">
            Real Telegram Bot API integration via @{botStatus?.bot?.username || "Eventlauncher_bot"}. Updates synchronize directly with EventLauncher event workflow.
          </div>
        </div>
      )}
    </div>
  );
}
