import { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Link2,
  ClipboardList,
  CheckCircle2,
  Trash2,
  User,
  ArrowRight,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Check,
  Eye,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type DemoState, type View } from "@/lib/event-demo";
import { AVAILABLE_AGENTS } from "./Activity";
import { GmailConversationSection } from "./GmailConversationSection";
import { TelegramConversationSection } from "./TelegramConversationSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { initAuth, signInWithGoogle, signOutGoogle, sendGmailMessage, getCachedToken } from "@/lib/gmail-client";
import { fetchTelegramStatus, type TelegramStatusResponse } from "@/lib/telegram-client";
import { saveDispatchedThread, type DispatchedLiveThread } from "@/lib/dispatched-threads";
import {
  saveStakeholderInquiry,
  subscribeStakeholderInquiries,
  deleteStakeholderInquiry,
} from "@/lib/firestore-service";
import type { User as FirebaseUser } from "firebase/auth";

interface Props {
  state: DemoState;
  onWorkspace?: () => void;
  onNavigate?: (view: View) => void;
}

export type SupportedPlatform = "email" | "telegram" | "whatsapp";

export interface InformationQuestionItem {
  id: string;
  question: string;
  title: string;
  recipientName: string;
  recipientContact: string;
  platform: SupportedPlatform;
  agentId: "guests" | "operations" | "design" | "venue";
  topic: string;
  status: "ready" | "pending";
}

interface EmailDraft {
  subject: string;
  body: string;
  status: "draft" | "sending" | "sent" | "error";
  errorMessage?: string;
  sentAt?: string;
}

const DEFAULT_DRAFTS: Record<string, { subject: string; body: string }> = {
  "info-1": {
    subject: "AV Specifications & Arrival Details for Dr. Maya Chen's Keynote",
    body: "Dear Dr. Elena Woods,\n\nI hope this email finds you well. I'm reaching out on behalf of the Career Seminar organizing team regarding Dr. Maya Chen's upcoming keynote presentation.\n\nCould you please confirm the following technical requirements for the North Hall stage:\n1. Preferred microphone type (lapel / lavalier vs. handheld wireless vs. lectern podium mic)\n2. Presentation display connection (HDMI / USB-C direct feed or preloading presentation slides to our stage console)\n3. Estimated arrival time on Friday so our guest hospitality team can meet you at the North Hall main lobby\n\nThank you for your assistance, and we look forward to welcoming Dr. Chen!\n\nWarm regards,\nMaya Lin\nGuest Relations Agent · EventLauncher",
  },
  "info-2": {
    subject: "Sound System & PA Setup Verification — North Hall Stage",
    body: "Hi Jordan,\n\nFollowing up on our AV readiness checklist for North Hall: could you confirm that the main PA speakers, audio rack, and wireless microphones are calibrated?\n\nSpecifically:\n1. Confirmation of PA sound check schedule (proposed 8:30 AM - 9:00 AM)\n2. Aux 2 foldback stage monitors EQ test for clear audience Q&A feedback\n3. Fresh battery count on all wireless transmitters\n\nBest,\nAlex Rivera\nOperations Agent · EventLauncher",
  },
  "info-3": {
    subject: "Print Order Pre-flight Approval for Seminar Posters (Job #CB-481)",
    body: "Hello Campus Print Team,\n\nThis is Sarah from the Design team for the upcoming Career Seminar.\n\nWe have prepared the 24\" x 36\" high-resolution CMYK vector proofs for the directional signage and main hall backdrop. Could you confirm:\n1. Vector pre-flight inspection has cleared\n2. Turnaround schedule for Thursday afternoon pickup (by 4:00 PM)\n3. Stand and foam-core mounting hardware availability\n\nThanks so much for your assistance!\n\nBest regards,\nSarah Chen\nDesign Agent · EventLauncher",
  },
  "info-4": {
    subject: "North Hall Room Reservation Permit & HVAC Schedule Confirmation",
    body: "Dear Facilities Coordinator,\n\nMarcus here with the EventLauncher Venue coordination team.\n\nAhead of Friday's Career Seminar in North Hall (8:00 AM – 6:00 PM), we'd like to confirm:\n1. Main double-door unlocking at 7:30 AM for staging setup\n2. HVAC / climate control schedule programmed to 69°F from 8:00 AM onwards\n3. Pre-positioning of recycling stations and trash receptacles at entry points\n\nThank you for helping us ensure a comfortable and smooth event.\n\nSincerely,\nMarcus Vance\nVenue Agent · EventLauncher",
  },
  "info-5": {
    subject: "North Hall 200-chair Seating Arrangement and Fire Safety Aisles",
    body: "Hi Priya,\n\nNorth Hall seating layout needs 200 chairs spaced in 10 rows with center aisle clear for fire safety. Could you confirm volunteer staging availability for Friday at 1:00 PM?\n\nName badges, volunteer clipboards, and row assignment maps are staged in the organizers' green room.\n\nBest regards,\nAlex Rivera\nOperations Agent · EventLauncher",
  },
};

export function IntegrationView({ state, onNavigate }: Props) {
  // Navigation between Information, Review, and Connect
  const [activeTab, setActiveTab] = useState<"information" | "review" | "connect">("information");

  // Selected integration channel to view/test live
  const [activeLiveChannel, setActiveLiveChannel] = useState<"email" | "telegram">("email");
  const [showLiveModal, setShowLiveModal] = useState(false);

  // Email Google Auth state for Connect section
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Telegram status state for Connect section
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusResponse | null>(null);

  // Modal recipient prefill
  const [modalPrefill, setModalPrefill] = useState<{
    recipientName: string;
    recipientContact: string;
    topic: string;
    agentId: string;
  } | null>(null);

  // Feedback for saved cards
  const [savedCardIds, setSavedCardIds] = useState<string[]>(["info-1", "info-2", "info-3", "info-4", "info-5"]);
  const [saveFeedbackId, setSaveFeedbackId] = useState<string | null>(null);

  // Rectangular information question boxes (styled similar to People & Tasks UI)
  const [infoCards, setInfoCards] = useState<InformationQuestionItem[]>([
    {
      id: "info-1",
      question: "Keynote Speaker Technical Specifications & Arrival",
      title: "Keynote Speaker Coordinator",
      recipientName: "Elena Woods",
      recipientContact: "elena.woods@example.org",
      platform: "email",
      agentId: "guests",
      topic: "Keynote AV Specifications & Arrival Details for Dr. Maya Chen",
      status: "ready",
    },
    {
      id: "info-2",
      question: "Sound System & PA Setup Verification",
      title: "Audio & AV Technical Lead",
      recipientName: "Jordan Lee",
      recipientContact: "@Eventlauncher_bot",
      platform: "telegram",
      agentId: "operations",
      topic: "Sound System & PA Testing — North Hall Stage Verification",
      status: "ready",
    },
    {
      id: "info-3",
      question: "Poster Print Run & Vector Proof Approval",
      title: "Campus Print Lab Desk",
      recipientName: "Campus Print Desk",
      recipientContact: "printshop@northbridge.edu",
      platform: "email",
      agentId: "design",
      topic: "Print Order Pre-flight Approval for Seminar Posters",
      status: "ready",
    },
    {
      id: "info-4",
      question: "Room Reservation Permit & Climate Schedule",
      title: "Facilities & Venue Coordinator",
      recipientName: "Facilities Coordinator",
      recipientContact: "facilities@northbridge.edu",
      platform: "email",
      agentId: "venue",
      topic: "Room Reservation Permit & Climate Schedule for North Hall",
      status: "ready",
    },
    {
      id: "info-5",
      question: "Room Staging & Fire Safety Aisle Setup",
      title: "Volunteer Staging Lead",
      recipientName: "Priya Shah",
      recipientContact: "+1 555-0192",
      platform: "whatsapp",
      agentId: "operations",
      topic: "North Hall 200-chair seating arrangement and fire safety aisles",
      status: "ready",
    },
  ]);

  // Drafts state for Review tab
  const [drafts, setDrafts] = useState<Record<string, EmailDraft>>(() => {
    const init: Record<string, EmailDraft> = {};
    const defaultIds = ["info-1", "info-2", "info-3", "info-4", "info-5"];
    defaultIds.forEach((id) => {
      const def = DEFAULT_DRAFTS[id];
      if (def) {
        init[id] = {
          subject: def.subject,
          body: def.body,
          status: "draft",
        };
      }
    });
    return init;
  });

  // Listen to Google Auth state
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      (user, _token) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
      },
      () => {
        setCurrentUser(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to Firestore stakeholder inquiries
  useEffect(() => {
    const unsubscribe = subscribeStakeholderInquiries((cloudInquiries) => {
      if (cloudInquiries && cloudInquiries.length > 0) {
        setInfoCards(cloudInquiries);
        setDrafts((prev) => {
          const next = { ...prev };
          cloudInquiries.forEach((item) => {
            if (item.draftSubject || item.draftBody) {
              next[item.id] = {
                subject: item.draftSubject || next[item.id]?.subject || "",
                body: item.draftBody || next[item.id]?.body || "",
                status: next[item.id]?.status || "draft",
              };
            }
          });
          return next;
        });
      }
    }, infoCards);
    return () => unsubscribe();
  }, []);

  // Fetch Telegram bot status
  useEffect(() => {
    async function loadTelegram() {
      const res = await fetchTelegramStatus();
      setTelegramStatus(res);
    }
    loadTelegram();
  }, []);

  const handleSignInGoogle = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      const res = await signInWithGoogle();
      setCurrentUser(res.user);
    } catch (err: unknown) {
      console.error("Sign in failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to sign in with Google.";
      setAuthError(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await signOutGoogle();
    setCurrentUser(null);
  };

  const updateInfoCard = (id: string, updates: Partial<InformationQuestionItem>) => {
    setInfoCards((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleSaveCard = (id: string) => {
    if (!savedCardIds.includes(id)) {
      setSavedCardIds((prev) => [...prev, id]);
    }
    setSaveFeedbackId(id);
    setTimeout(() => {
      setSaveFeedbackId((curr) => (curr === id ? null : curr));
    }, 2500);

    // Ensure draft is prepared for this card
    const card = infoCards.find((c) => c.id === id);
    if (card) {
      const currentDraft = drafts[id] || {
        subject: DEFAULT_DRAFTS[id]?.subject || `Regarding: ${card.topic || card.question}`,
        body:
          DEFAULT_DRAFTS[id]?.body ||
          `Dear ${card.recipientName || "Colleague"},\n\nI am contacting you regarding ${card.topic || card.question} for the upcoming event.\n\nPlease confirm availability and details at your earliest convenience.\n\nBest regards,\nEventLauncher Coordination Agent`,
        status: "draft",
      };

      if (!drafts[id]) {
        setDrafts((prev) => ({
          ...prev,
          [id]: currentDraft,
        }));
      }

      // Persist to Firestore cloud database
      saveStakeholderInquiry({
        ...card,
        draftSubject: currentDraft.subject,
        draftBody: currentDraft.body,
      }).catch((e) => console.warn("Firestore inquiry save notice:", e));
    }
  };

  const handleAddNewQuestionBox = () => {
    const newId = `info-${Date.now()}`;
    const newCard: InformationQuestionItem = {
      id: newId,
      question: "New Stakeholder Information & Requirements",
      title: "New Coordinator / Stakeholder",
      recipientName: "",
      recipientContact: "",
      platform: "email",
      agentId: "guests",
      topic: "Event coordination specifications and confirmation",
      status: "pending",
    };
    setInfoCards((prev) => [...prev, newCard]);
    const initDraft: EmailDraft = {
      subject: "Regarding: Event coordination specifications and confirmation",
      body: "Hello,\n\nI am reaching out regarding event coordination specifications for the upcoming event.\n\nPlease confirm your availability and requirements.\n\nBest regards,\nEventLauncher Coordination Agent",
      status: "draft",
    };
    setDrafts((prev) => ({
      ...prev,
      [newId]: initDraft,
    }));
    // Save to Firestore
    saveStakeholderInquiry({
      ...newCard,
      draftSubject: initDraft.subject,
      draftBody: initDraft.body,
    }).catch((e) => console.warn("Firestore new card save notice:", e));
  };

  const handleDeleteCard = (id: string) => {
    setInfoCards((prev) => prev.filter((item) => item.id !== id));
    deleteStakeholderInquiry(id).catch((e) => console.warn("Firestore delete inquiry notice:", e));
  };

  const updateDraft = (cardId: string, updates: Partial<EmailDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [cardId]: { ...prev[cardId], ...updates },
    }));
  };

  const handleApproveAndSend = async (card: InformationQuestionItem) => {
    const draft = drafts[card.id] || {
      subject: DEFAULT_DRAFTS[card.id]?.subject || `Regarding: ${card.topic}`,
      body: DEFAULT_DRAFTS[card.id]?.body || `Hello ${card.recipientName},\n\nFollowing up on ${card.topic}.`,
      status: "draft",
    };

    const assignedAgent =
      AVAILABLE_AGENTS.find((a) => a.id === card.agentId) || AVAILABLE_AGENTS[0];

    updateDraft(card.id, { status: "sending", errorMessage: undefined });

    try {
      const token = getCachedToken();

      // If user is connected to Google and card is email, try real Gmail sending
      let sentThreadId: string | undefined;
      if (card.platform === "email" && token && card.recipientContact.includes("@")) {
        try {
          const sendRes = await sendGmailMessage(token, {
            to: card.recipientContact,
            subject: draft.subject,
            body: draft.body,
            agentName: assignedAgent.name,
          });
          sentThreadId = sendRes?.threadId;
        } catch (e) {
          console.warn("Gmail API direct dispatch warning:", e);
        }
      }

      // Save to dispatched live threads for Activity section observable tracking
      const newLiveThread: DispatchedLiveThread = {
        id: `live-${card.id}-${Date.now()}`,
        agentId: card.agentId,
        agentName: assignedAgent.name,
        agentEmail: assignedAgent.email,
        recipientName: card.recipientName || "Recipient",
        recipientEmail: card.recipientContact || "recipient@example.org",
        subject: draft.subject,
        topic: card.topic || card.question,
        channel: card.platform === "telegram" ? "Telegram" : "Email",
        threadId: sentThreadId,
        dispatchedAt: Date.now(),
        messages: [
          {
            id: `msg-${Date.now()}-1`,
            sender: "agent",
            senderName: assignedAgent.name,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            body: draft.body,
            isAI: true,
          },
        ],
      };

      saveDispatchedThread(newLiveThread);

      updateDraft(card.id, {
        status: "sent",
        sentAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve and dispatch.";
      updateDraft(card.id, { status: "error", errorMessage: msg });
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-7 lg:p-9 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Ecosystem & Information Center
          </h1>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THREE BUTTONS CONTAINER: INFORMATION, REVIEW (IN BETWEEN), AND CONNECT */}
      {/* ========================================================================= */}
      <div className="flex w-full items-center gap-2 rounded-xl border border-border/80 bg-white p-1.5 shadow-2xs">
        {/* 1. Information Button */}
        <button
          type="button"
          onClick={() => setActiveTab("information")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "information"
              ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-sage-dark" />
          <span>Information</span>
        </button>

        {/* 2. Review Button (In between Information and Connect) */}
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "review"
              ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Eye className="h-4 w-4 shrink-0 text-sage-dark" />
          <span>Review</span>
          <span className="rounded-full bg-sage-light text-sage-dark border border-primary/25 px-1.5 py-0.2 text-[10px] font-bold">
            {infoCards.length}
          </span>
        </button>

        {/* 3. Connect Button */}
        <button
          type="button"
          onClick={() => setActiveTab("connect")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "connect"
              ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Link2 className="h-4 w-4 shrink-0 text-sage-dark" />
          <span>Connect</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: INFORMATION BOX */}
      {/* ========================================================================= */}
      {activeTab === "information" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Event Recipient Questions ({infoCards.length})
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddNewQuestionBox}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-sage-dark hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Question Box
            </button>
          </div>

          <div className="space-y-3.5">
            {infoCards.map((card, idx) => {
              const assignedAgent =
                AVAILABLE_AGENTS.find((a) => a.id === card.agentId) ||
                AVAILABLE_AGENTS[0];
              const AgentIcon = assignedAgent.icon;

              return (
                <div
                  key={card.id}
                  className="rounded-2xl border border-border/80 bg-white p-4 sm:p-5 shadow-2xs hover:border-primary/40 transition-all space-y-3.5"
                >
                  {/* Top Header of Question Box */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sage-light text-sage-dark text-xs font-bold">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={card.question}
                        onChange={(e) =>
                          updateInfoCard(card.id, { question: e.target.value })
                        }
                        className="text-xs sm:text-sm font-semibold text-foreground bg-transparent border-0 focus:outline-hidden focus:ring-1 focus:ring-primary/40 rounded px-1 -ml-1 w-full max-w-md"
                        placeholder="Enter question/responsibility title..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteCard(card.id)}
                        className="text-muted-foreground hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                        title="Delete question box"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Form fields perfectly aligned in a line */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-start">
                    {/* Recipient Name */}
                    <div className="space-y-1.5">
                      <label className="flex h-5 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                        <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>Recipient Name</span>
                      </label>
                      <input
                        type="text"
                        value={card.recipientName}
                        onChange={(e) =>
                          updateInfoCard(card.id, { recipientName: e.target.value })
                        }
                        placeholder="e.g. Elena Woods"
                        className="h-9 w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                      />
                    </div>

                    {/* Recipient Contact / Email */}
                    <div className="space-y-1.5">
                      <label className="flex h-5 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                        <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>
                          {card.platform === "email"
                            ? "Email Address"
                            : card.platform === "telegram"
                            ? "Username / Chat ID"
                            : "Phone Number"}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={card.recipientContact}
                        onChange={(e) =>
                          updateInfoCard(card.id, {
                            recipientContact: e.target.value,
                          })
                        }
                        placeholder={
                          card.platform === "email"
                            ? "name@example.org"
                            : card.platform === "telegram"
                            ? "@username or +1... or Chat ID"
                            : "+1 555-0192"
                        }
                        className="h-9 w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                      />
                    </div>

                    {/* Platform Selector Dropdown */}
                    <div className="space-y-1.5">
                      <label className="flex h-5 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>Platform</span>
                      </label>
                      <select
                        value={card.platform}
                        onChange={(e) =>
                          updateInfoCard(card.id, {
                            platform: e.target.value as SupportedPlatform,
                          })
                        }
                        className="h-9 w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-2.5 text-xs font-medium text-foreground focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40 cursor-pointer"
                      >
                        <option value="email">Email (Gmail API)</option>
                        <option value="telegram">Telegram (@Eventlauncher_bot)</option>
                        <option value="whatsapp">WhatsApp Business</option>
                      </select>
                    </div>

                    {/* Assigned Agent */}
                    <div className="space-y-1.5">
                      <label className="flex h-5 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                        <AgentIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span>Assigned Agent</span>
                      </label>
                      <select
                        value={card.agentId}
                        onChange={(e) =>
                          updateInfoCard(card.id, {
                            agentId: e.target.value as InformationQuestionItem["agentId"],
                          })
                        }
                        className="h-9 w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-2.5 text-xs font-medium text-foreground focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40 cursor-pointer"
                      >
                        {AVAILABLE_AGENTS.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name.replace(" Agent", "")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Topic / Details field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Communication Topic & Specifications
                    </label>
                    <input
                      type="text"
                      value={card.topic}
                      onChange={(e) =>
                        updateInfoCard(card.id, { topic: e.target.value })
                      }
                      placeholder="Specify what the agent needs to verify or request from this recipient..."
                      className="w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40"
                    />
                  </div>

                  {/* Bottom Action Footer for this Question Box */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30 text-[11px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Target Integration:
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[10px]">
                        {card.platform === "email" ? (
                          <Mail className="h-3 w-3 text-rose-500" />
                        ) : card.platform === "telegram" ? (
                          <Send className="h-3 w-3 text-sky-500" />
                        ) : (
                          <Link2 className="h-3 w-3 text-emerald-500" />
                        )}
                        {card.platform === "email"
                          ? "Gmail Integration"
                          : card.platform === "telegram"
                          ? "Telegram Integration"
                          : "WhatsApp Integration"}
                      </span>
                      {saveFeedbackId === card.id && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 animate-in fade-in duration-200">
                          <Check className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveCard(card.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                    >
                      <Save className="h-3 w-3" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: REVIEW BOX (WHERE WE REVIEW WRITTEN EMAILS AND APPROVE) */}
      {/* ========================================================================= */}
      {activeTab === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Review Written Agent Emails
              </h2>
              <p className="text-xs text-muted-foreground">
                Specialist micro-agents have composed outreach emails. Review each message, customize if needed, and approve to dispatch.
              </p>
            </div>
            {Object.values(drafts).some((d) => d.status === "sent") && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("Activity")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-sage-dark hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <span>View Live Conversations in Activity</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {infoCards.map((card, idx) => {
              const assignedAgent =
                AVAILABLE_AGENTS.find((a) => a.id === card.agentId) ||
                AVAILABLE_AGENTS[0];
              const AgentIcon = assignedAgent.icon;
              const draft = drafts[card.id] || {
                subject: DEFAULT_DRAFTS[card.id]?.subject || `Regarding: ${card.topic || card.question}`,
                body:
                  DEFAULT_DRAFTS[card.id]?.body ||
                  `Dear ${card.recipientName || "Colleague"},\n\nI am contacting you regarding ${card.topic || card.question}.\n\nPlease let us know if you need any adjustments.\n\nBest regards,\n${assignedAgent.name}`,
                status: "draft" as const,
              };

              const isSent = draft.status === "sent";
              const isSending = draft.status === "sending";

              return (
                <div
                  key={`review-${card.id}`}
                  className="rounded-2xl border border-border/80 bg-white p-5 shadow-2xs space-y-4 hover:border-primary/40 transition-all"
                >
                  {/* Review Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sage-light text-sage-dark text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-sage-light px-2 py-0.5 text-xs font-medium text-sage-dark">
                          <AgentIcon className="h-3 w-3" />
                          <span>{assignedAgent.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs font-semibold text-foreground">
                          {card.recipientName || "Recipient"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({card.recipientContact || "No contact set"})
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isSent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved & Sent {draft.sentAt ? `(${draft.sentAt})` : ""}
                        </span>
                      ) : isSending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sending via Gmail...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 border border-sky-200">
                          <Sparkles className="h-3.5 w-3.5" />
                          Draft Ready for Review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subject Line Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      disabled={isSent || isSending}
                      value={draft.subject}
                      onChange={(e) =>
                        updateDraft(card.id, { subject: e.target.value })
                      }
                      className="w-full rounded-lg border border-border/70 bg-[#FAFAF8] px-3 py-2 text-xs font-medium text-foreground focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40 disabled:opacity-80"
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Written Email Body Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Written Email Body (Drafted by {assignedAgent.name})
                    </label>
                    <textarea
                      rows={6}
                      disabled={isSent || isSending}
                      value={draft.body}
                      onChange={(e) =>
                        updateDraft(card.id, { body: e.target.value })
                      }
                      className="w-full rounded-lg border border-border/70 bg-[#FAFAF8] p-3 text-xs leading-relaxed text-foreground focus:bg-white focus:outline-hidden focus:ring-1.5 focus:ring-primary/40 disabled:opacity-80 font-mono text-[11px]"
                      placeholder="Compose or edit email content..."
                    />
                  </div>

                  {/* Review Action Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                    <div className="text-[11px] text-muted-foreground">
                      {isSent ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Email sent! Real-time conversation is now observable in the Activity section.
                        </span>
                      ) : (
                        <span>
                          Approving will send this email to{" "}
                          <strong className="text-foreground">
                            {card.recipientContact || "recipient"}
                          </strong>{" "}
                          and initialize real-time observation in Activity.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isSent ? (
                        onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate("Activity")}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                          >
                            <span>Open in Activity</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => handleApproveAndSend(card)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          {isSending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Approve & Send</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: CONNECT SECTION (ONLY EMAIL AND TELEGRAM - NOTHING ELSE) */}
      {/* ========================================================================= */}
      {activeTab === "connect" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. EMAIL (GMAIL) CONNECTION CARD */}
            <div className="rounded-2xl border border-border/80 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 shadow-2xs">
                    <Mail className="h-6 w-6 text-rose-600" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium border",
                      currentUser && getCachedToken()
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : currentUser
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-muted text-muted-foreground border-transparent"
                    )}
                  >
                    {currentUser && getCachedToken()
                      ? "Connected & Active"
                      : currentUser
                      ? "Session Needs Renewal"
                      : "Not connected"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Email
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Connect your email account to let agents send emails and track replies directly.
                  </p>
                </div>

                {currentUser && (
                  <div className="rounded-xl border border-border/60 bg-[#FAFAF8] p-3 flex items-center gap-3">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || "User"}
                        className="h-8 w-8 rounded-full border border-border"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sage-light text-sage-dark font-bold text-xs">
                        {currentUser.displayName ? currentUser.displayName[0] : "U"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {currentUser.displayName || "Google User"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                )}

                {authError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-1.5 text-xs text-rose-700">
                    <p className="font-semibold text-rose-800">
                      Unable to complete Google sign-in
                    </p>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      {authError}
                    </p>
                    <p className="text-[10px] text-rose-600/90 pt-1 border-t border-rose-200/60">
                      💡 Tip: If a popup was blocked, look for the popup icon in your browser's address bar to allow popups for this app, then click Sign in again.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/40">
                {currentUser ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {getCachedToken() ? "Email connected" : "Session active"}
                    </span>
                    <div className="flex items-center gap-2">
                      {!getCachedToken() && (
                        <button
                          type="button"
                          onClick={handleSignInGoogle}
                          disabled={isAuthLoading}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                        >
                          Renew Token
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOutGoogle}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignInGoogle}
                    disabled={isAuthLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isAuthLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    <span>Sign in with Email</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. TELEGRAM CONNECTION CARD */}
            <div className="rounded-2xl border border-border/80 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 shadow-2xs">
                    <Send className="h-5 w-5 -translate-x-0.5 translate-y-0.5 text-sky-600" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium border",
                      telegramStatus?.configured
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground border-transparent"
                    )}
                  >
                    {telegramStatus?.configured ? "Connected" : "Active"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Telegram
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Connect with the official event bot <strong>@Eventlauncher_bot</strong> for two-way agent messaging.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-[#FAFAF8] p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bot Account:</span>
                    <span className="font-semibold text-sage-dark">
                      @{telegramStatus?.bot?.username || "Eventlauncher_bot"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-emerald-700 font-medium">
                      {telegramStatus?.configured ? "Authorized & Active" : "Bot Active"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40">
                <a
                  href="https://t.me/Eventlauncher_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Connect Telegram (@Eventlauncher_bot)</span>
                  <ExternalLink className="h-3 w-3 ml-0.5 opacity-80" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG FOR LIVE AI AGENT CONVERSATION (GMAIL / TELEGRAM) */}
      {/* ========================================================================= */}
      <Dialog open={showLiveModal} onOpenChange={setShowLiveModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FAFAF8] p-5 sm:p-7">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage-light text-sage-dark">
                  {activeLiveChannel === "email" ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    {activeLiveChannel === "email"
                      ? "Gmail AI Email Agent"
                      : "Telegram Bot AI Agent"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {activeLiveChannel === "email"
                      ? "Autonomous agent drafting, real Gmail sending, and recipient reply tracking."
                      : "Real two-way messaging through official Telegram bot @Eventlauncher_bot."}
                  </DialogDescription>
                </div>
              </div>

              {/* Quick channel switch inside dialog */}
              <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setActiveLiveChannel("email")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    activeLiveChannel === "email"
                      ? "bg-sage-light text-sage-dark ring-1 ring-primary/20 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLiveChannel("telegram")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    activeLiveChannel === "telegram"
                      ? "bg-sage-light text-sage-dark ring-1 ring-primary/20 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Telegram
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Active section mount */}
          <div className="pt-2">
            {activeLiveChannel === "email" ? (
              <GmailConversationSection
                eventDetails={{
                  ...state.event,
                  topic: modalPrefill?.topic || state.event.topic,
                }}
              />
            ) : (
              <TelegramConversationSection
                eventDetails={{
                  ...state.event,
                  topic: modalPrefill?.topic || state.event.topic,
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
