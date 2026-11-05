import { useEffect, useRef, useState, type Dispatch } from "react";
import {
  ArrowUp,
  Sparkles,
  CalendarDays,
  UsersRound,
  Building2,
  Mic,
  Loader2,
  ChevronRight,
  ClipboardList,
  RotateCcw,
} from "lucide-react";
import { type DemoAction, type DemoState, type View, formatDate } from "@/lib/event-demo";
import { ActionButton, Mark } from "./Primitives";
import { saveActiveEvent } from "@/lib/firestore-service";
import { AgentCreationActivityBox } from "./AgentCreationActivityBox";
import { cn } from "@/lib/utils";

interface Props {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  navigate: (view: View) => void;
  onEdit: () => void;
  onReview: () => void;
}

const DEMO_STARTER_QUESTIONS = [
  {
    prompt: "I want to organize an event",
    headline: "I want to organize an event",
    subtitle: "Start fresh with custom goals, date, and venue selection",
    icon: Sparkles,
    tag: "Recommended",
  },
  {
    prompt: "Create a specialized Catering & Hospitality Agent for our guest reception",
    headline: "Create a specialized agent",
    subtitle: "Lead Coordinator provisions a new micro-agent with real backend registration",
    icon: UsersRound,
    tag: "Agent Action",
  },
  {
    prompt: "Help me plan a campus tech seminar for 200 students",
    headline: "Plan a campus tech seminar",
    subtitle: "Keynote presentation, technical talks, and student reception",
    icon: CalendarDays,
    tag: "Seminar",
  },
  {
    prompt: "Host an alumni career panel at North Hall Auditorium",
    headline: "Host an alumni career panel",
    subtitle: "Auditorium staging, student moderator, and Q&A session",
    icon: UsersRound,
    tag: "Panel",
  },
  {
    prompt: "Coordinate a keynote guest lecture with Dr. Maya Chen",
    headline: "Keynote guest lecture with Dr. Maya Chen",
    subtitle: "Distinguished researcher keynote and AV rider specifications",
    icon: Mic,
    tag: "Keynote",
  },
  {
    prompt: "Organize a student hackathon and project showcase",
    headline: "Organize a student hackathon",
    subtitle: "Weekend lab access, mentor team, and final project demo",
    icon: Building2,
    tag: "Hackathon",
  },
];

export function Workspace({ state, dispatch, navigate, onReview }: Props) {
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([
    "November 24, 2026 at 2:00 PM",
    "North Hall Auditorium",
    "Around 200 students",
    "Review our current event plan",
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [state.messages.length, isThinking]);

  const handleSendMessage = async (userText: string) => {
    const text = userText.trim();
    if (!text || isThinking) return;

    setInput("");
    setIsThinking(true);

    // 1. Add user message to conversation
    dispatch({ type: "ADD_USER_MESSAGE", text });

    // Prepare message history for backend
    const updatedMessages = [
      ...state.messages.map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text },
    ];

    try {
      const response = await fetch("/api/coordinator/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          currentEvent: {
            date: state.event.date,
            time: state.event.time,
            venue: state.event.venue,
            speaker: state.event.speaker,
            audience: state.event.audience,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Coordinator service returned HTTP ${response.status}`);
      }

      const data = await response.json();
      let reply = data.reply || "I've noted that down. What else can I help you coordinate?";
      const extracted = data.extractedDetails || {};

      if (Array.isArray(data.executedTools) && data.executedTools.length > 0) {
        const receipts = data.executedTools
          .map((t: { name: string; result?: { message?: string; executionReceipt?: string } }) =>
            t.result?.message || t.result?.executionReceipt || `Executed tool: ${t.name}`
          )
          .join("\n• ");
        if (!reply.includes("Verified Backend Action")) {
          reply = `${reply}\n\nVerified Backend Operations:\n• ${receipts}`;
        }
      }

      // 2. Dispatch assistant response & extracted details
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        text: reply,
        extractedDetails: extracted,
      });

      // 3. Persist extracted details to Firestore cloud if detected
      if (
        extracted.date ||
        extracted.time ||
        extracted.venue ||
        extracted.speaker ||
        extracted.audience ||
        extracted.name
      ) {
        saveActiveEvent({
          ...(extracted.name ? { name: extracted.name } : {}),
          ...(extracted.date ? { date: extracted.date } : {}),
          ...(extracted.time ? { time: extracted.time } : {}),
          ...(extracted.venue ? { venue: extracted.venue, venueConfirmed: true } : {}),
          ...(extracted.speaker ? { speaker: extracted.speaker } : {}),
          ...(extracted.audience ? { audience: extracted.audience } : {}),
          ...(extracted.category ? { category: extracted.category } : {}),
        }).catch((e) => console.warn("Live event sync notice:", e));
      }

      // 4. Update suggested prompt chips
      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length > 0) {
        setActiveSuggestions(data.suggestedPrompts);
      }
    } catch (err: unknown) {
      console.warn("Coordinator fallback reply generation:", err);
      // Deterministic immediate response
      const fallbackReply =
        "I've noted that down! As your lead coordinator, I'll align our specialist micro-agents across Venue Clearance, Communications, and Operations.\n\nWhat target date or preferred campus space are you leaning toward?";
      dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        text: fallbackReply,
      });
      setActiveSuggestions([
        "November 24 at 2:00 PM",
        "North Hall Auditorium",
        "Around 200 attendees",
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const isConversationStarted = state.messages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F4F6F2]">
      {/* Scrollable Chat & Starters Area */}
      <div ref={scrollRef} className="soft-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-[760px] space-y-6">
          {/* ========================================================================= */}
          {/* STARTER SCREEN WHEN USER HAS NOT YET STARTED THE CONVERSATION */}
          {/* ========================================================================= */}
          {!isConversationStarted && (
            <div className="space-y-6 py-6 sm:py-10 animate-in fade-in duration-300">
              {/* Welcome Badge & Title */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-sage-light px-3 py-1 text-xs font-semibold text-sage-dark border border-primary/20 shadow-2xs">
                  <Sparkles className="h-3.5 w-3.5 text-sage-dark" />
                  <span>Lead Event Coordinator</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  What event would you like to organize?
                </h1>
                <p className="mx-auto max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Start the conversation below, or choose a starter question to explore how your lead coordinator plans, asks questions, and aligns specialist micro-agents.
                </p>
              </div>

              {/* Demo Questions Starter Grid */}
              <div className="space-y-2.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center sm:text-left">
                  Demo Starter Questions — Click to Start
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {DEMO_STARTER_QUESTIONS.map((item, idx) => {
                    const Icon = item.icon;
                    const isFirst = idx === 0;

                    return (
                      <button
                        key={item.prompt}
                        type="button"
                        onClick={() => handleSendMessage(item.prompt)}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer shadow-2xs",
                          isFirst
                            ? "sm:col-span-2 border-primary/40 bg-white hover:border-primary hover:bg-[#F9FCF8] hover:shadow-xs ring-1 ring-primary/20"
                            : "border-border/80 bg-white hover:border-primary/40 hover:bg-[#F9FCF8] hover:shadow-xs"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isFirst
                              ? "bg-sage-light text-sage-dark group-hover:bg-primary group-hover:text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-sage-light group-hover:text-sage-dark"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground group-hover:text-sage-dark">
                              {item.headline}
                            </span>
                            <span className="rounded bg-sage-light/70 px-1.5 py-0.2 text-[9px] font-medium text-sage-dark border border-primary/15">
                              {item.tag}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                            {item.subtitle}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-sage-dark group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coordinator Output Section & Real-time Activity Box */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-sage-dark font-medium">
                    <Sparkles className="h-3 w-3" />
                    Coordinator Output & Agent Deployment
                  </span>
                  <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Real-time Backend Stream
                  </span>
                </div>
                <section
                  aria-label="Output"
                  data-section="output"
                  className="output-section rounded-xl border border-border/80 bg-white p-3.5 shadow-2xs"
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Lead Event Coordinator oversees all micro-agents and autonomous backend operations. Specialist agents are provisioned and registered in Firestore in real time.
                  </p>
                </section>
                {/* Rectangular minimal activity box directly below the Output section */}
                <AgentCreationActivityBox />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACTIVE CONVERSATION STREAM */}
          {/* ========================================================================= */}
          {isConversationStarted && (
            <div
              role="log"
              aria-label="Event coordination conversation"
              aria-live="polite"
              className="space-y-6 pt-2"
            >
              {state.messages.map((message, index) => {
                const isUser = message.role === "user";

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end gap-3 message-enter">
                      <div className="max-w-[85%] sm:max-w-[78%]">
                        <p className="mb-1.5 text-right text-[10px] font-medium text-muted-foreground">
                          You <span className="ml-1.5 font-normal">Organizer</span>
                        </p>
                        <div className="rounded-2xl rounded-tr-md border border-primary/20 bg-sage-light px-4 py-3 text-[13px] leading-relaxed text-sage-dark shadow-2xs">
                          {message.text}
                        </div>
                      </div>
                      <div
                        className="mt-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8DED2] text-[10px] font-semibold text-[#655B50]"
                        aria-label="You"
                      >
                        JD
                      </div>
                    </div>
                  );
                }

                // Assistant / Coordinator message
                const isLatestAssistant = index === state.messages.length - 1;

                return (
                  <div key={message.id} className="flex gap-3 message-enter">
                    <Mark small className="mt-1 h-7 w-7 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-sage-dark">
                          Lead Event Coordinator
                        </span>
                        <span className="rounded bg-sage-light px-1.5 py-0.2 text-[9px] font-medium text-sage-dark">
                          Coordinator
                        </span>
                      </div>

                      {/* Output section */}
                      <section
                        aria-label="Output"
                        data-section="output"
                        className="output-section rounded-2xl rounded-tl-md border border-border/80 bg-white p-4 shadow-2xs"
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                          <span className="flex items-center gap-1.5 text-sage-dark">
                            <Sparkles className="h-3 w-3" />
                            Output
                          </span>
                          <span className="text-[9px] font-normal text-muted-foreground">Lead Coordinator</span>
                        </div>
                        <p className="whitespace-pre-line text-[13px] leading-[1.8] text-foreground">
                          {message.text}
                        </p>
                      </section>

                      {/* Rectangular, minimal activity box directly below the Output section */}
                      <AgentCreationActivityBox />

                      {/* Interactive prompt chips under latest coordinator reply */}
                      {isLatestAssistant && !isThinking && activeSuggestions.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Suggested Quick Answers:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => handleSendMessage(suggestion)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-foreground hover:border-primary/40 hover:bg-sage-light hover:text-sage-dark transition-colors cursor-pointer shadow-2xs"
                              >
                                <span>{suggestion}</span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Thinking / Typing indicator */}
              {isThinking && (
                <div className="flex gap-3 message-enter animate-in fade-in">
                  <Mark small className="mt-1 h-7 w-7 rounded-lg shrink-0" />
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border/70 bg-white px-4 py-3 shadow-2xs">
                    <Loader2 className="h-4 w-4 animate-spin text-sage-dark" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Lead Coordinator is thinking and coordinating with micro-agents...
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Navigation Cards if Plan is active */}
              {state.event.date && (
                <div className="mt-4 rounded-xl border border-border/70 bg-white/90 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <ClipboardList className="h-4 w-4 text-sage-dark" />
                    <span className="font-semibold text-foreground">
                      {state.event.venue
                        ? `${state.event.venue} · ${formatDate(state.event.date)}`
                        : `Target Date: ${formatDate(state.event.date)}`}
                    </span>
                    <span className="text-muted-foreground">· Milestones synchronized</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("Event Plan")}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <span>View Event Plan</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    {state.plan !== "Approved" && (
                      <button
                        type="button"
                        onClick={onReview}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                      >
                        <span>Review Plan</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Form at Bottom */}
      <div className="shrink-0 bg-transparent px-4 pb-4 pt-2 sm:px-8">
        <div className="mx-auto max-w-[760px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="surface-shadow rounded-2xl border border-primary/20 bg-white p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
          >
            <label className="sr-only" htmlFor="message">
              Message your event coordinator
            </label>
            <div className="flex items-end gap-3">
              <textarea
                id="message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                rows={2}
                maxLength={800}
                placeholder={
                  !isConversationStarted
                    ? 'Start by typing: "I want to organize an event..." or pick a demo prompt above'
                    : "Tell your lead coordinator what you'd like to plan, adjust, or ask..."
                }
                className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-xs sm:text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/75 focus-visible:outline-none"
              />
              <ActionButton
                type="submit"
                aria-label="Send message"
                disabled={!input.trim() || isThinking}
                className="h-8 w-8 shrink-0 rounded-xl p-0 bg-primary text-primary-foreground hover:bg-sage-dark disabled:opacity-40 cursor-pointer"
              >
                {isThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </ActionButton>
            </div>
          </form>

          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>
              The Lead Coordinator has full autonomy to converse, question, and plan dynamically.
            </span>
            {isConversationStarted && (
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET" })}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Start New Conversation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
