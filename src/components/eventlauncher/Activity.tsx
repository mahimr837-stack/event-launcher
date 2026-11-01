import { useState, useEffect, type Dispatch } from "react";
import {
  Check,
  Mail,
  MessageSquare,
  ShieldCheck,
  User,
  Building2,
  Palette,
  UsersRound,
  Wrench,
  Sparkles,
  RotateCw,
  Loader2,
} from "lucide-react";
import { type Channel, type DemoAction, type DemoState } from "@/lib/event-demo";
import { cn } from "@/lib/utils";
import { getDispatchedThreads, saveDispatchedThread, type DispatchedLiveThread } from "@/lib/dispatched-threads";
import { getCachedToken, signInWithGoogle, searchAndFetchGmailThread, cleanEmailBody } from "@/lib/gmail-client";

interface Props {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  onWorkspace: () => void;
}

// Existing EventLauncher agents definitions for selection
export interface EventAgent {
  id: "guests" | "operations" | "design" | "venue";
  name: string;
  role: string;
  email: string;
  icon: typeof UsersRound;
  description: string;
  defaultTopic: string;
  sampleRecipientName: string;
  sampleRecipientEmail: string;
}

export const AVAILABLE_AGENTS: EventAgent[] = [
  {
    id: "guests",
    name: "Registration & Guests Agent",
    role: "Keynote & Guest Coordinator",
    email: "guests.agent@eventlauncher.ai",
    icon: UsersRound,
    description: "Coordinates keynote speaker technical riders, arrival timing, VIP hospitality, and attendee check-in specifications.",
    defaultTopic: "Keynote AV Specifications & Arrival Details for Dr. Maya Chen",
    sampleRecipientName: "Elena Woods",
    sampleRecipientEmail: "elena.woods@example.org",
  },
  {
    id: "operations",
    name: "Event-day Operations Agent",
    role: "AV & Technical Operations Lead",
    email: "operations.agent@eventlauncher.ai",
    icon: Wrench,
    description: "Manages main PA audio calibration, lapel microphones, projector routing, and room row safety staging.",
    defaultTopic: "Sound System & PA Testing — North Hall Stage Verification",
    sampleRecipientName: "Jordan Lee",
    sampleRecipientEmail: "jordan.lee@example.edu",
  },
  {
    id: "design",
    name: "Communications & Design Agent",
    role: "Creative & Print Production Lead",
    email: "design.agent@eventlauncher.ai",
    icon: Palette,
    description: "Handles A2 vector print proofs, exterior easel mounts, campus print lab orders, and promotional outreach.",
    defaultTopic: "Print Order Pre-flight Approval for Seminar Posters",
    sampleRecipientName: "Campus Print Desk",
    sampleRecipientEmail: "printshop@northbridge.edu",
  },
  {
    id: "venue",
    name: "Venue & Logistics Agent",
    role: "Facilities & Permits Specialist",
    email: "venue.agent@eventlauncher.ai",
    icon: Building2,
    description: "Handles Student Affairs reservation sign-offs, smart-card building access, stage layout permits, and HVAC scheduling.",
    defaultTopic: "Room Reservation Permit & Climate Schedule for North Hall",
    sampleRecipientName: "Facilities Coordinator",
    sampleRecipientEmail: "facilities@northbridge.edu",
  },
];

// Pre-existing reference threads
interface AgentConversationThread {
  id: string;
  agentId: "operations" | "guests" | "design" | "venue" | "lead";
  agentName: string;
  agentEmail: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  topic: string;
  channel: "Email" | "WhatsApp";
  agentIcon: typeof Wrench;
  isLiveDispatched?: boolean;
  threadId?: string;
  messages: Array<{
    id: string;
    sender: "agent" | "recipient";
    senderName: string;
    time: string;
    body: string;
  }>;
}

const AGENT_THREADS: AgentConversationThread[] = [
  {
    id: "sound-check-thread",
    agentId: "operations",
    agentName: "Event-day Operations Agent",
    agentEmail: "operations.agent@eventlauncher.ai",
    recipientName: "Jordan Lee (Sound & AV Lead)",
    recipientEmail: "jordan.lee@example.edu",
    subject: "Sound System & PA Testing — North Hall Setup",
    topic: "Sound System Verification",
    channel: "Email",
    agentIcon: Wrench,
    messages: [
      {
        id: "msg-1",
        sender: "agent",
        senderName: "Event-day Operations Agent",
        time: "10:14 AM",
        body: "Hi Jordan,\n\nFollowing up on our AV readiness checklist for North Hall: can you verify if the main PA speakers, wireless lapel microphones, and auxiliary sound connections have been fully prepared and tested by the audio team?",
      },
      {
        id: "msg-2",
        sender: "recipient",
        senderName: "Jordan Lee",
        time: "10:18 AM",
        body: "Hi Operations Agent,\n\nYes! The sound system, main PA speakers, amplifier rack, and wireless microphones are completely tested and ready. We've also staged spare batteries and a DI box for Dr. Chen's laptop audio. Final sound check is set for 12:30 PM.",
      },
      {
        id: "msg-1-b",
        sender: "agent",
        senderName: "Event-day Operations Agent",
        time: "10:21 AM",
        body: "Thanks for the quick confirmation, Jordan. Could you also verify if the stage monitor speakers are routed to Aux 2 on the sound board so Dr. Chen can hear audience questions during the Q&A segment?",
      },
      {
        id: "msg-2-b",
        sender: "recipient",
        senderName: "Jordan Lee",
        time: "10:24 AM",
        body: "Just double-checked the routing — Aux 2 is patched directly to both front foldback monitors and levels are EQ-calibrated. We'll run a quick audio sweep with Dr. Chen at 12:30 PM.",
      },
      {
        id: "msg-1-c",
        sender: "agent",
        senderName: "Event-day Operations Agent",
        time: "10:25 AM",
        body: "Perfect. Updating the central event dashboard: Sound & AV status marked as 'Verified Ready'. We appreciate the audio team's thorough preparation.",
      },
    ],
  },
  {
    id: "speaker-rider-thread",
    agentId: "guests",
    agentName: "Registration & Guests Agent",
    agentEmail: "guests.agent@eventlauncher.ai",
    recipientName: "Elena Woods (Keynote Coordinator for Dr. Maya Chen)",
    recipientEmail: "dr.chen.assistant@keynote.org",
    subject: "Keynote AV Specifications & Arrival Details",
    topic: "Speaker Tech Rider Confirmation",
    channel: "Email",
    agentIcon: UsersRound,
    messages: [
      {
        id: "msg-3",
        sender: "agent",
        senderName: "Registration & Guests Agent",
        time: "10:05 AM",
        body: "Hello Elena,\n\nWe have finalized North Hall's technical staging for Dr. Chen's seminar. The console provides 16:9 HDMI video routing, dedicated 3.5mm direct audio return, and a 24-inch floor confidence monitor facing the podium.\n\nPlease let us know if this matches her presentation rider.",
      },
      {
        id: "msg-4",
        sender: "recipient",
        senderName: "Elena Woods",
        time: "10:11 AM",
        body: "Thank you for the detailed update! Those specifications match Dr. Chen's rider perfectly. We have her presentation slides in 16:9 format. Our team will arrive 45 minutes prior for the 10-minute sound check.",
      },
      {
        id: "msg-3-b",
        sender: "agent",
        senderName: "Registration & Guests Agent",
        time: "10:15 AM",
        body: "Understood Elena. We have also reserved front-row seating for Dr. Chen's research team and placed the wireless presentation clicker with fresh backup batteries directly on the podium.",
      },
      {
        id: "msg-4-b",
        sender: "recipient",
        senderName: "Elena Woods",
        time: "10:19 AM",
        body: "Wonderful. One small addition: could we have a fresh carafe of room-temperature water with two glasses on the podium side table?",
      },
      {
        id: "msg-3-c",
        sender: "agent",
        senderName: "Registration & Guests Agent",
        time: "10:20 AM",
        body: "Added to hospitality checklist and dispatched to catering staff. The podium will be prepared with water service prior to arrival.",
      },
    ],
  },
  {
    id: "poster-print-thread",
    agentId: "design",
    agentName: "Communications & Design Agent",
    agentEmail: "design.agent@eventlauncher.ai",
    recipientName: "Campus Print Lab Desk",
    recipientEmail: "printshop@northbridge.edu",
    subject: "Print Order #PL-882: Career Seminar A2 Posters",
    topic: "Poster Print Run Authorization",
    channel: "Email",
    agentIcon: Palette,
    messages: [
      {
        id: "msg-5",
        sender: "agent",
        senderName: "Communications & Design Agent",
        time: "09:48 AM",
        body: "Good morning,\n\nVenue clearance for North Hall has been confirmed. I am transmitting the finalized vector print proofs (A2, 300 DPI, CMYK) for the University Career Seminar. Quantity: 150 copies on satin heavy cardstock.",
      },
      {
        id: "msg-6",
        sender: "recipient",
        senderName: "Campus Print Lab Desk",
        time: "09:55 AM",
        body: "Order #PL-882 received and verified. Pre-flight checks passed with full bleed. Print run will be ready for pickup tomorrow at 2:00 PM.",
      },
      {
        id: "msg-5-b",
        sender: "agent",
        senderName: "Communications & Design Agent",
        time: "09:58 AM",
        body: "Thank you for the confirmation. Can we also include 2 foam-board mounted copies for the exterior entrance easels?",
      },
      {
        id: "msg-6-b",
        sender: "recipient",
        senderName: "Campus Print Lab Desk",
        time: "10:02 AM",
        body: "Mounted easel boards added to ticket #PL-882. All items will be boxed and ready together at the pickup counter tomorrow at 2:00 PM.",
      },
    ],
  },
  {
    id: "venue-permit-thread",
    agentId: "venue",
    agentName: "Venue & Logistics Agent",
    agentEmail: "venue.agent@eventlauncher.ai",
    recipientName: "Student Affairs Facilities Office",
    recipientEmail: "studentaffairs.facilities@northbridge.edu",
    subject: "Room Reservation Permit Request: North Hall",
    topic: "University Facility Sign-off",
    channel: "Email",
    agentIcon: Building2,
    messages: [
      {
        id: "msg-7",
        sender: "agent",
        senderName: "Venue & Logistics Agent",
        time: "09:15 AM",
        body: "Dear Facilities Coordinator,\n\nSubmitting reservation and university sign-off request for North Hall for the Career Development Club Seminar (expected: 150–200 students). Stage requirement: 24ft with center podium.",
      },
      {
        id: "msg-8",
        sender: "recipient",
        senderName: "Facilities Coordinator",
        time: "09:30 AM",
        body: "Permit #NH-2026 is officially approved. North Hall is reserved. Building card access will be activated 60 minutes prior to event start time.",
      },
      {
        id: "msg-7-b",
        sender: "agent",
        senderName: "Venue & Logistics Agent",
        time: "09:33 AM",
        body: "Thank you for the permit approval. Could facilities ensure the North Hall HVAC zone heating is turned on 45 minutes prior to attendee doors opening?",
      },
      {
        id: "msg-8-b",
        sender: "recipient",
        senderName: "Facilities Coordinator",
        time: "09:36 AM",
        body: "Automatic climate timer scheduled: North Hall HVAC will spool up at 12:15 PM to reach 70°F before doors open.",
      },
    ],
  },
  {
    id: "whatsapp-volunteer-thread",
    agentId: "operations",
    agentName: "Event-day Operations Agent",
    agentEmail: "operations.agent@eventlauncher.ai",
    recipientName: "Priya Shah (Room Setup Lead)",
    recipientEmail: "priya.shah@example.edu",
    subject: "Room Setup & Seating Row Arrangement",
    topic: "Volunteer Staging Sync",
    channel: "WhatsApp",
    agentIcon: Wrench,
    messages: [
      {
        id: "msg-9",
        sender: "agent",
        senderName: "Event-day Operations Agent",
        time: "10:22 AM",
        body: "Hi Priya, North Hall seating layout needs 200 chairs spaced in 10 rows with center aisle clear for fire safety. Are student volunteers ready for 1:00 PM setup?",
      },
      {
        id: "msg-10",
        sender: "recipient",
        senderName: "Priya Shah",
        time: "10:25 AM",
        body: "Yes! 4 volunteers confirmed for 1:00 PM. We'll set up row markers and keep the middle aisle 6 feet wide as requested.",
      },
      {
        id: "msg-9-b",
        sender: "agent",
        senderName: "Event-day Operations Agent",
        time: "10:27 AM",
        body: "Great! Name badges, volunteer clipboards, and row assignment maps are staged in the organizers' green room. Please have the team report there first.",
      },
      {
        id: "msg-10-b",
        sender: "recipient",
        senderName: "Priya Shah",
        time: "10:29 AM",
        body: "Understood! I will meet everyone in the green room at 12:50 PM for the briefing.",
      },
    ],
  },
];

export function notificationText(state: DemoState, _channel: Channel): string {
  if (state.plan !== "Approved") {
    return "Event plan is in draft mode. Specialist agents will initiate dispatch once the plan is approved.";
  }
  return "Agent dispatches are synchronized with active dependencies.";
}

export function ActivityView({ _state }: { _state?: DemoState; [key: string]: unknown }) {
  const [liveDispatches, setLiveDispatches] = useState<DispatchedLiveThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("sound-check-thread");
  const [channelFilter, setChannelFilter] = useState<"All" | "Email" | "WhatsApp">("All");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    const list = getDispatchedThreads();
    setLiveDispatches(list);
    if (list.length > 0) {
      setSelectedThreadId(list[0].id);
    }

    const handler = () => {
      const updated = getDispatchedThreads();
      setLiveDispatches(updated);
      if (updated.length > 0) {
        setSelectedThreadId(updated[0].id);
      }
    };
    window.addEventListener("eventlauncher_threads_updated", handler);
    return () => window.removeEventListener("eventlauncher_threads_updated", handler);
  }, []);

  const agentIconMap = {
    guests: UsersRound,
    operations: Wrench,
    design: Palette,
    venue: Building2,
  };

  const combinedThreads: AgentConversationThread[] = [
    ...liveDispatches.map((t) => ({
      id: t.id,
      agentId: t.agentId,
      agentName: t.agentName,
      agentEmail: t.agentEmail,
      recipientName: t.recipientName,
      recipientEmail: t.recipientEmail,
      subject: t.subject,
      topic: t.topic,
      channel: (t.channel === "Telegram" ? "WhatsApp" : "Email") as "Email" | "WhatsApp",
      agentIcon: agentIconMap[t.agentId] || UsersRound,
      isLiveDispatched: true,
      threadId: t.threadId,
      messages: t.messages,
    })),
    ...AGENT_THREADS,
  ];

  const filteredThreads = combinedThreads.filter(
    (t) => channelFilter === "All" || t.channel === channelFilter
  );
  const activeThread = combinedThreads.find((t) => t.id === selectedThreadId) || combinedThreads[0] || AGENT_THREADS[0];
  const AgentIcon = activeThread.agentIcon;

  const handleRefreshReplies = async (thread: AgentConversationThread) => {
    setIsRefreshing(true);
    setRefreshMessage(null);

    try {
      let token = getCachedToken();
      if (!token) {
        try {
          const authRes = await signInWithGoogle();
          token = authRes.accessToken;
        } catch {
          setRefreshMessage("Please connect your Google account in Ecosystem → Connect to fetch live replies.");
          setIsRefreshing(false);
          return;
        }
      }

      if (!token) {
        setRefreshMessage("No active Gmail session found. Connect Google in Ecosystem → Connect.");
        setIsRefreshing(false);
        return;
      }

      const result = await searchAndFetchGmailThread(token, {
        threadId: thread.threadId,
        recipientEmail: thread.recipientEmail,
        subject: thread.subject,
      });

      if (!result || !result.messages || result.messages.length === 0) {
        setRefreshMessage(`Checked Gmail (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}) — no replies found yet.`);
        return;
      }

      // Filter messages that are incoming from recipient (not from me)
      const incomingReplies = result.messages.filter((m) => !m.isFromMe);

      // Check which ones are not yet in thread.messages
      const existingIds = new Set(thread.messages.map((m) => m.id));
      const existingCleanBodies = new Set(
        thread.messages.map((m) => cleanEmailBody(m.body).toLowerCase().trim())
      );

      const newReplies = incomingReplies.filter((reply) => {
        const cleanB = cleanEmailBody(reply.body || reply.snippet).toLowerCase().trim();
        return !existingIds.has(reply.id) && !existingCleanBodies.has(cleanB) && cleanB.length > 0;
      });

      if (newReplies.length === 0) {
        setRefreshMessage(`Checked Gmail (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}) — no new replies yet.`);
        return;
      }

      // Format incoming replies into messages
      const newReplyMessages = newReplies.map((reply) => ({
        id: reply.id,
        sender: "recipient" as const,
        senderName: thread.recipientName || reply.from.split("<")[0].trim() || "Recipient",
        time: new Date(reply.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        body: cleanEmailBody(reply.body) || reply.snippet || "(No content)",
      }));

      // Generate automatic AI agent acknowledgment
      const replyBodyClean = newReplyMessages[newReplyMessages.length - 1].body;
      const autoAckTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const autoAckMessage = {
        id: `ack-${Date.now()}`,
        sender: "agent" as const,
        senderName: thread.agentName,
        time: autoAckTime,
        body: `Thank you for your response, ${thread.recipientName.split(" ")[0] || "there"}!\n\nI have registered your update: "${replyBodyClean.slice(0, 140)}${replyBodyClean.length > 140 ? "..." : ""}" into our event management system. Our coordination team has marked this item as verified.`,
      };

      const updatedAllMessages = [...thread.messages, ...newReplyMessages, autoAckMessage];

      // Save to localStorage and notify UI
      saveDispatchedThread({
        id: thread.id,
        agentId: (thread.agentId as "guests" | "operations" | "design" | "venue") || "guests",
        agentName: thread.agentName,
        agentEmail: thread.agentEmail,
        recipientName: thread.recipientName,
        recipientEmail: thread.recipientEmail,
        subject: thread.subject,
        topic: thread.topic,
        channel: thread.channel === "WhatsApp" ? "Telegram" : "Email",
        threadId: result.threadId || thread.threadId,
        dispatchedAt: Date.now(),
        messages: updatedAllMessages,
      });

      setRefreshMessage(`Retrieved new reply from ${thread.recipientName}! Agent has indexed the response.`);
    } catch (err: unknown) {
      console.error("Refresh error:", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch replies.";
      setRefreshMessage(`Could not fetch replies: ${msg}`);
    } finally {
      setIsRefreshing(false);
      setTimeout(() => {
        setRefreshMessage(null);
      }, 6000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8 lg:p-10 space-y-7">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Activity & Agent Communications
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Reference event communications between specialized campus agents and coordinators.
          </p>
        </div>
      </div>

      {/* SECTION: REFERENCE THREADS */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Reference event communications between specialized campus agents and coordinators.
          </p>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-[#FAFAF8] p-1">
            {(["All", "Email", "WhatsApp"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setChannelFilter(tab)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  channelFilter === tab
                    ? "bg-sage-light text-sage-dark ring-1 ring-primary/20 shadow-2xs"
                    : "bg-white/80 text-muted-foreground border border-border/50 hover:bg-sage-light/40 hover:text-foreground"
                )}
              >
                {tab === "Email" ? "Emails" : tab === "WhatsApp" ? "Direct Messages" : "All Threads"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Threads Selector (5 cols) */}
          <div className="space-y-2 lg:col-span-5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agent Communication Threads ({filteredThreads.length})
            </p>
            <div className="space-y-2">
              {filteredThreads.map((thread) => {
                const isSelected = thread.id === activeThread.id;
                const Icon = thread.agentIcon;
                const lastMessage = thread.messages[thread.messages.length - 1];

                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      "flex w-full flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary/50 bg-[#E5EFE0] shadow-xs ring-1.5 ring-primary/30"
                        : "border-[#D6E2D3] bg-[#EEF4EA] hover:border-primary/40 hover:bg-[#E5EFE0]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          {thread.agentName.replace(" Agent", "")}
                        </span>
                        {thread.isLiveDispatched && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
                            <Check className="h-2.5 w-2.5" />
                            Live
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                        {thread.channel === "Email" ? <Mail className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                        {thread.channel}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-1 text-xs font-medium text-foreground">
                      {thread.topic}
                    </p>

                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      To: {thread.recipientName}
                    </p>

                    <div className="mt-2 flex w-full items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                      <span className="truncate">
                        {lastMessage.senderName}: {lastMessage.body.split("\n")[0]}
                      </span>
                      <span className="shrink-0">{lastMessage.time}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Conversation View (7 cols) */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-xs">
              {/* Header info */}
              <div className="border-b border-border/60 bg-[#FBFAF7] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-light text-sage-dark">
                      <AgentIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="inline-flex items-center rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                        {activeThread.subject}
                      </h2>
                      <p className="mt-1 text-[10px] text-muted-foreground">Topic: {activeThread.topic}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Small tiny refresh button */}
                    {activeThread.channel === "Email" && (
                      <button
                        type="button"
                        onClick={() => handleRefreshReplies(activeThread)}
                        disabled={isRefreshing}
                        title="Check Gmail for replies from this recipient"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-white px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-sage-light hover:text-sage-dark hover:border-primary/40 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                      >
                        <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin text-primary")} />
                        <span>{isRefreshing ? "Checking..." : "Refresh"}</span>
                      </button>
                    )}

                    {activeThread.isLiveDispatched && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                        <Check className="h-3 w-3 text-emerald-600" />
                        Approved & Dispatched via Gmail API
                      </span>
                    )}
                  </div>
                </div>

                {/* Feedback message banner if refreshed */}
                {refreshMessage && (
                  <div className="mt-2.5 rounded-lg border border-primary/25 bg-sage-light/60 px-3 py-1.5 text-[11px] text-sage-dark flex items-center justify-between animate-in fade-in">
                    <span>{refreshMessage}</span>
                  </div>
                )}

                {/* Sender & Recipient Metadata */}
                <div className="mt-3.5 grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-white p-3 text-[11px] sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Sending Agent: </span>
                    <p className="font-semibold text-sage-dark">{activeThread.agentName}</p>
                    <p className="text-[10px] text-muted-foreground">{activeThread.agentEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recipient: </span>
                    <p className="font-medium text-foreground">{activeThread.recipientName}</p>
                    <p className="text-[10px] text-muted-foreground">{activeThread.recipientEmail}</p>
                  </div>
                </div>
              </div>

              {/* Back-and-forth Conversation Stream */}
              <div className="space-y-4 p-4 sm:p-6 bg-[#FAFAF8]">
                {activeThread.messages.map((message, index) => {
                  const isAgent = message.sender === "agent";
                  const isLast = index === activeThread.messages.length - 1;

                  return (
                    <div key={message.id} className="relative pl-7 sm:pl-8">
                      {/* Connection line extending to next message node */}
                      {!isLast && (
                        <div
                          className="absolute left-[7px] sm:left-[9px] top-5 -bottom-4 w-[2px] bg-primary/35"
                          aria-hidden="true"
                        />
                      )}

                      {/* Node dot */}
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
                              {isAgent ? "(AI Agent)" : "(Contact)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{message.time}</span>
                            {/* Small tiny refresh button on the last message */}
                            {activeThread.channel === "Email" && isLast && (
                              <button
                                type="button"
                                onClick={() => handleRefreshReplies(activeThread)}
                                disabled={isRefreshing}
                                title="Refresh to fetch latest email replies"
                                className="inline-flex items-center gap-1 rounded border border-border/70 bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                              >
                                <RotateCw className={cn("h-2.5 w-2.5", isRefreshing && "animate-spin text-primary")} />
                                <span>{isRefreshing ? "..." : "Refresh"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Message Body */}
                        <div className="pt-2 text-xs leading-relaxed text-foreground whitespace-pre-line">
                          {message.body}
                        </div>

                        {/* Reply Indicator if from contact */}
                        {!isAgent && (
                          <div className="mt-2 flex items-center gap-1.5 pt-1 text-[10px] text-sage-dark font-medium">
                            <Check className="h-3 w-3" />
                            <span>Verified response received and indexed by coordinator</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bottom live sync banner for Email channel */}
                {activeThread.channel === "Email" && (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-white/70 p-3 text-[11px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Sent a reply to this email? Click to sync your incoming reply:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRefreshReplies(activeThread)}
                      disabled={isRefreshing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 shadow-2xs"
                    >
                      <RotateCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                      <span>{isRefreshing ? "Checking inbox..." : "Refresh Replies"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Summary */}
              <div className="border-t border-border/60 bg-white p-3.5 text-center text-[10px] text-muted-foreground">
                Dispatched via {activeThread.channel} by {activeThread.agentName}. Updates feed directly into event dependencies.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Note */}
      <div className="flex items-center justify-between rounded-xl border border-primary/15 bg-white p-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-sage-dark shrink-0" />
          <p className="text-xs text-muted-foreground">
            All AI agent communications are recorded with full attribution, timestamps, and verifiable recipient replies via official channels.
          </p>
        </div>
      </div>
    </div>
  );
}
