import { useState, useEffect, useRef } from "react";
import { ArrowUp, Building2, Palette, Pause, Play, RotateCcw, UsersRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentMessage {
  id: string;
  sender: "lead" | "venue" | "design" | "guests" | "operations" | "user";
  name: string;
  text: string;
}

const SIMULATED_SCRIPT: AgentMessage[] = [
  {
    id: "1",
    sender: "design",
    name: "Design Agent",
    text: "Lead Coordinator, the print shop needs the confirmed venue before locking the poster. Is North Hall approved?",
  },
  {
    id: "2",
    sender: "lead",
    name: "Lead Coordinator",
    text: "Checking clearance now. Venue Agent, has Student Affairs signed off on North Hall?",
  },
  {
    id: "3",
    sender: "venue",
    name: "Venue Agent",
    text: "Yes, approved this morning. North Hall is locked for 200 capacity with a 24ft stage.",
  },
  {
    id: "4",
    sender: "lead",
    name: "Lead Coordinator",
    text: "Clearance confirmed. Design Agent, you can output the final poster files. Operations Agent, please verify AV setup for that stage.",
  },
  {
    id: "5",
    sender: "operations",
    name: "Operations Agent",
    text: "On it. Lapel mic and projector checks are scheduled 90 minutes before doors open.",
  },
  {
    id: "6",
    sender: "lead",
    name: "Lead Coordinator",
    text: "Operations Agent, was the sound system prepared by the sound experts yet?",
  },
  {
    id: "7",
    sender: "operations",
    name: "Operations Agent",
    text: "I am going to email Jordan Lee at jordan.lee@example.edu to check on the progress.",
  },
  {
    id: "8",
    sender: "operations",
    name: "Operations Agent",
    text: "Jordan just confirmed: the sound system, amplifiers, and microphones are fully tested and ready.",
  },
  {
    id: "9",
    sender: "guests",
    name: "Guests Agent",
    text: "I'll notify Dr. Chen's arrival team and update student ticket confirmations.",
  },
  {
    id: "10",
    sender: "lead",
    name: "Lead Coordinator",
    text: "All tasks aligned. Poster files unlocked, sound verified, and venue preparations are active.",
  },
];

export function Agents(_props?: { state?: unknown; onPlan?: () => void }) {
  const [messages, setMessages] = useState<AgentMessage[]>([SIMULATED_SCRIPT[0]]);
  const [turn, setTurn] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-advance script
  useEffect(() => {
    if (!isPlaying) return;
    if (turn >= SIMULATED_SCRIPT.length) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setMessages(prev => [...prev, SIMULATED_SCRIPT[turn]]);
      setTurn(t => t + 1);
    }, 2400);

    return () => clearTimeout(timer);
  }, [isPlaying, turn]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  function handleReset() {
    setMessages([SIMULATED_SCRIPT[0]]);
    setTurn(1);
    setIsPlaying(true);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    setInput("");

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      name: "You",
      text: val,
    };

    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const lower = val.toLowerCase();
      let replier: "venue" | "design" | "guests" | "operations" = "venue";
      let replierName = "Venue Agent";
      let replyText = "Venue checked. Everything is on schedule.";

      if (lower.includes("poster") || lower.includes("print") || lower.includes("design")) {
        replier = "design";
        replierName = "Design Agent";
        replyText = "Print proofs are ready for export with confirmed university branding.";
      } else if (lower.includes("sound") || lower.includes("mic") || lower.includes("av")) {
        replier = "operations";
        replierName = "Operations Agent";
        replyText = "Sound check is ready. Microphone levels and backup HDMI are tested.";
      } else if (lower.includes("speaker") || lower.includes("guest") || lower.includes("rsvp")) {
        replier = "guests";
        replierName = "Guests Agent";
        replyText = "Speaker itinerary is confirmed and RSVP list has been refreshed.";
      }

      const leadResponse: AgentMessage = {
        id: `l-${Date.now()}`,
        sender: "lead",
        name: "Lead Coordinator",
        text: `Received: "${val}". ${replierName}, please give a status update.`,
      };

      setMessages(prev => [...prev, leadResponse]);

      setTimeout(() => {
        const microResponse: AgentMessage = {
          id: `m-${Date.now()}`,
          sender: replier,
          name: replierName,
          text: replyText,
        };
        setMessages(prev => [...prev, microResponse]);
      }, 1500);
    }, 800);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F4F6F2]">
      {/* Minimal Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-primary/10 px-5 py-3">
        <span className="text-xs font-medium text-foreground">Agents Chat</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/60 hover:text-foreground"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={handleReset}
            title="Reset conversation"
            className="rounded-md p-1 text-muted-foreground hover:bg-white/60 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messenger-style Chatbox */}
      <div
        ref={scrollRef}
        className="soft-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map(msg => {
            const isUser = msg.sender === "user";
            const isLead = msg.sender === "lead";

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end gap-2">
                  <div className="max-w-[75%]">
                    <div className="rounded-2xl rounded-tr-xs bg-sage px-3.5 py-2 text-xs text-white">
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                {/* Circle Avatar (Bigger for Big Agent) */}
                {isLead ? (
                  <div
                    title="Lead Coordinator"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-dark text-[11px] font-semibold text-white shadow-xs"
                  >
                    LC
                  </div>
                ) : (
                  <div
                    title={msg.name}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sage-dark shadow-xs ring-1 ring-border"
                  >
                    {msg.sender === "venue" && <Building2 className="h-3.5 w-3.5" />}
                    {msg.sender === "design" && <Palette className="h-3.5 w-3.5" />}
                    {msg.sender === "guests" && <UsersRound className="h-3.5 w-3.5" />}
                    {msg.sender === "operations" && <Wrench className="h-3.5 w-3.5" />}
                  </div>
                )}

                {/* Message & Name */}
                <div className="min-w-0 max-w-[80%]">
                  <p
                    className={cn(
                      "mb-1 text-[11px] font-medium leading-none",
                      isLead ? "text-sage-dark font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {msg.name}
                  </p>
                  <div
                    className={cn(
                      "rounded-2xl rounded-tl-xs px-3.5 py-2 text-xs leading-relaxed",
                      isLead
                        ? "bg-[#E3EBE0] text-[#1E261B]"
                        : "border border-border/60 bg-white text-foreground"
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Minimal Input Bar */}
      <div className="shrink-0 p-3 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 shadow-xs transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message the agents..."
              className="flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:bg-sage-dark disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
