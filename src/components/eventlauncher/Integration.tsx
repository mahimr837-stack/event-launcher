import { useState } from "react";
import {
  ChevronDown,
  Check,
  Mail,
  Send,
  Calendar,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Presentation,
  ListTodo,
  MessageCircle,
  Plus,
  Sparkles,
  Link2,
  ClipboardList,
  CheckCircle2,
  Trash2,
  User,
  ArrowRight,
  ExternalLink,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type DemoState } from "@/lib/event-demo";
import { AVAILABLE_AGENTS } from "./Activity";
import { GmailConversationSection } from "./GmailConversationSection";
import { TelegramConversationSection } from "./TelegramConversationSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  state: DemoState;
  onWorkspace?: () => void;
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

interface IntegrationCardDef {
  id: string;
  name: string;
  subtitle: string;
  status: "Connected" | "Active" | "Ready" | "Available";
  platformKey?: SupportedPlatform;
  category: "Google Workspace" | "Direct Messaging";
  iconType:
    | "drive"
    | "sheets"
    | "calendar"
    | "docs"
    | "slides"
    | "tasks"
    | "chat"
    | "forms"
    | "email"
    | "telegram"
    | "whatsapp";
}

const INTEGRATION_CATALOG: IntegrationCardDef[] = [
  {
    id: "gmail",
    name: "Email (Gmail)",
    subtitle: "Draft and send real event emails with live reply tracking",
    status: "Connected",
    platformKey: "email",
    category: "Google Workspace",
    iconType: "email",
  },
  {
    id: "telegram",
    name: "Telegram Bot API",
    subtitle: "Two-way messaging with recipients via @Eventlauncher_bot",
    status: "Active",
    platformKey: "telegram",
    category: "Direct Messaging",
    iconType: "telegram",
  },
  {
    id: "drive",
    name: "Google Drive",
    subtitle: "Access Drive files and event folders",
    status: "Connected",
    category: "Google Workspace",
    iconType: "drive",
  },
  {
    id: "sheets",
    name: "Google Sheets",
    subtitle: "Transform your spreadsheet data & attendee lists",
    status: "Connected",
    category: "Google Workspace",
    iconType: "sheets",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    subtitle: "Create & manage scheduled milestones",
    status: "Active",
    category: "Google Workspace",
    iconType: "calendar",
  },
  {
    id: "docs",
    name: "Google Docs",
    subtitle: "Build custom Google Docs workflows & run-of-show",
    status: "Active",
    category: "Google Workspace",
    iconType: "docs",
  },
  {
    id: "slides",
    name: "Google Slides",
    subtitle: "Integrate your slide decks & keynote presentations",
    status: "Ready",
    category: "Google Workspace",
    iconType: "slides",
  },
  {
    id: "tasks",
    name: "Google Tasks",
    subtitle: "Create and manage operational checklists",
    status: "Connected",
    category: "Google Workspace",
    iconType: "tasks",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    subtitle: "Direct mobile messaging for coordinators and volunteers",
    status: "Ready",
    platformKey: "whatsapp",
    category: "Direct Messaging",
    iconType: "whatsapp",
  },
  {
    id: "forms",
    name: "Google Forms",
    subtitle: "Collect attendee responses simply & effectively",
    status: "Available",
    category: "Google Workspace",
    iconType: "forms",
  },
];

export function IntegrationView({ state }: Props) {
  // Navigation between Information (70%) and Integration (30%)
  const [activeTab, setActiveTab] = useState<"information" | "integration">("information");

  // Selected integration channel to view/test live
  const [activeLiveChannel, setActiveLiveChannel] = useState<"email" | "telegram">("email");
  const [showLiveModal, setShowLiveModal] = useState(false);

  // Modal recipient prefill from information box
  const [modalPrefill, setModalPrefill] = useState<{
    recipientName: string;
    recipientContact: string;
    topic: string;
    agentId: string;
  } | null>(null);

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

  const updateInfoCard = (id: string, updates: Partial<InformationQuestionItem>) => {
    setInfoCards((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
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
  };

  const handleDeleteCard = (id: string) => {
    setInfoCards((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLaunchFromCard = (card: InformationQuestionItem) => {
    if (card.platform === "email" || card.platform === "telegram") {
      setActiveLiveChannel(card.platform);
      setModalPrefill({
        recipientName: card.recipientName,
        recipientContact: card.recipientContact,
        topic: card.topic,
        agentId: card.agentId,
      });
      setShowLiveModal(true);
    } else {
      // WhatsApp note
      alert("WhatsApp Business API integration is configured for outgoing alerts. To test two-way AI conversations, select Email (Gmail) or Telegram.");
    }
  };

  // Render branded icons matching the reference image style
  const renderBrandedIcon = (iconType: IntegrationCardDef["iconType"]) => {
    switch (iconType) {
      case "drive":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-2xs">
            <svg className="h-6 w-6" viewBox="0 0 87.3 78" fill="none">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
              <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 49.9 0 51.45 0 53h27.5z" fill="#00AC47" />
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15z" fill="#EA4335" />
              <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832D" />
              <path d="M59.8 53H87.3c0-1.55-.4-3.1-1.2-4.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L56.35 46.7z" fill="#FFBA00" />
              <path d="M27.5 53h32.3l-13.75-23.8H13.75z" fill="#2684FC" />
            </svg>
          </div>
        );
      case "sheets":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <div className="flex h-7 w-6 flex-col justify-center rounded-sm bg-emerald-600 p-1 text-white shadow-xs">
              <div className="grid grid-cols-2 gap-0.5 border border-white/70 p-0.5">
                <div className="h-1 bg-white/70" />
                <div className="h-1 bg-white/70" />
                <div className="h-1 bg-white/70" />
                <div className="h-1 bg-white/70" />
              </div>
            </div>
          </div>
        );
      case "calendar":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <div className="flex h-7 w-7 flex-col items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
              <span className="text-[10px] leading-none">31</span>
            </div>
          </div>
        );
      case "docs":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <div className="flex h-7 w-6 flex-col justify-center rounded-sm bg-blue-600 p-1.5 text-white shadow-xs">
              <div className="space-y-1">
                <div className="h-0.5 w-full bg-white/90" />
                <div className="h-0.5 w-3/4 bg-white/90" />
                <div className="h-0.5 w-4/5 bg-white/90" />
              </div>
            </div>
          </div>
        );
      case "slides":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-2xs">
            <div className="flex h-6 w-7 items-center justify-center rounded-sm bg-amber-500 p-1 text-white shadow-xs">
              <Presentation className="h-4 w-4" />
            </div>
          </div>
        );
      case "tasks":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
          </div>
        );
      case "chat":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <MessageCircle className="h-6 w-6 text-emerald-600 fill-emerald-600" />
          </div>
        );
      case "forms":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 shadow-2xs">
            <ListTodo className="h-6 w-6 text-purple-600" />
          </div>
        );
      case "email":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 shadow-2xs">
            <Mail className="h-6 w-6 text-rose-600" />
          </div>
        );
      case "telegram":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white shadow-xs">
              <Send className="h-3.5 w-3.5 -translate-x-0.5 translate-y-0.5" />
            </div>
          </div>
        );
      case "whatsapp":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
              <MessageCircle className="h-4 w-4 fill-white" />
            </div>
          </div>
        );
      default:
        return <Link2 className="h-5 w-5 text-muted-foreground" />;
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
      {/* TWO BUTTONS CONTAINER: INFORMATION (70%) & INTEGRATION (30%) */}
      {/* ========================================================================= */}
      <div className="flex w-full items-center gap-2 rounded-xl border border-border/80 bg-white p-1.5 shadow-2xs">
        {/* Left: Information Button (~70%) */}
        <button
          type="button"
          onClick={() => setActiveTab("information")}
          className={cn(
            "w-[70%] flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "information"
              ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-sage-dark" />
          <span>Information</span>
        </button>

        {/* Right: Integration Button (~30%) */}
        <button
          type="button"
          onClick={() => setActiveTab("integration")}
          className={cn(
            "w-[30%] flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "integration"
              ? "bg-sage-light text-sage-dark ring-1 ring-primary/25 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Link2 className="h-4 w-4 shrink-0 text-sage-dark" />
          <span>Connect</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: INFORMATION BOX (Rectangular question boxes like People & Tasks) */}
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

                    {/* Assigned Agent (Registration dropdown) */}
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
                          <MessageCircle className="h-3 w-3 text-emerald-500" />
                        )}
                        {card.platform === "email"
                          ? "Gmail Integration"
                          : card.platform === "telegram"
                          ? "Telegram Integration"
                          : "WhatsApp Integration"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLaunchFromCard(card)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                    >
                      <span>Launch Agent Conversation</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: INTEGRATION BOX (Matching the user's reference image) */}
      {/* ========================================================================= */}
      {activeTab === "integration" && (
        <div className="space-y-6">
          {/* Header matching image: Available integrations ⌵ */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground cursor-pointer">
              <span>Available integrations</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {INTEGRATION_CATALOG.length} integrations connected
            </span>
          </div>

          {/* Integration Cards Grid matching image_858c4aa4.png */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {INTEGRATION_CATALOG.map((item) => {
              const isInteractive =
                item.platformKey === "email" || item.platformKey === "telegram";

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.platformKey === "email" || item.platformKey === "telegram") {
                      setActiveLiveChannel(item.platformKey);
                      setModalPrefill(null);
                      setShowLiveModal(true);
                    }
                  }}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border border-border/80 bg-white p-5 transition-all",
                    isInteractive
                      ? "cursor-pointer hover:border-primary/50 hover:shadow-xs"
                      : "hover:border-border"
                  )}
                >
                  <div className="space-y-3">
                    {/* Top row: App icon and status badge */}
                    <div className="flex items-center justify-between">
                      {renderBrandedIcon(item.iconType)}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium border",
                          item.status === "Connected" || item.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-muted text-muted-foreground border-transparent"
                        )}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* App Name and Subtitle */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Interactive trigger if Email or Telegram */}
                  {isInteractive && (
                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-sage-dark font-medium">
                      <span>Open Live AI Agent Studio</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}
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
