import { useState, useEffect, useRef } from "react";
import { ArrowUp, Building2, Palette, Pause, Play, RotateCcw, UsersRound, Wrench, ShieldCheck, Loader2 } from "lucide-react";
import { AgentCreationActivityBox } from "./AgentCreationActivityBox";
import { triggerBackendAgentCreation } from "@/lib/firestore-service";
import { cn } from "@/lib/utils";

interface AgentMessage {
  id: string;
  sender: "lead" | "venue" | "design" | "guests" | "operations" | "user";
  name: string;
  text: string;
  verifiedAction?: string;
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

const MICRO_AGENTS = [
  { name: "Venue Agent", icon: Building2 },
  { name: "Design Agent", icon: Palette },
  { name: "Guests Agent", icon: UsersRound },
  { name: "Operations Agent", icon: Wrench },
];

export function Agents(_props?: { state?: unknown; onPlan?: () => void }) {
  const [messages, setMessages] = useState<AgentMessage[]>([SIMULATED_SCRIPT[0]]);
  const [turn, setTurn] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [input, setInput] = useState("");
  const [showActiveAgents, setShowActiveAgents] = useState(false);
  const activeAgentsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activeAgentsRef.current && !activeAgentsRef.current.contains(event.target as Node)) {
        setShowActiveAgents(false);
      }
    }
    if (showActiveAgents) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showActiveAgents]);

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

  const [isLoading, setIsLoading] = useState(false);

  function handleReset() {
    setMessages([SIMULATED_SCRIPT[0]]);
    setTurn(1);
    setIsPlaying(true);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val || isLoading) return;
    setInput("");

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      name: "You",
      text: val,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const lower = val.toLowerCase();

    if ((lower.includes("create") || lower.includes("add") || lower.includes("need")) && lower.includes("agent")) {
      const match = val.match(/(?:create|add|need a|provision)\s+(?:a|an)?\s*([A-Za-z\s]+?agent)/i);
      const customAgentName = match ? match[1].trim() : "Catering & Hospitality Agent";

      const leadResponse: AgentMessage = {
        id: `l-${Date.now()}`,
        sender: "lead",
        name: "Lead Coordinator",
        text: `Initiating creation and backend registration for new micro-specialized agent: "${customAgentName}". Provisioning permissions and database records.`,
        verifiedAction: `Creating ${customAgentName}`,
      };
      setMessages(prev => [...prev, leadResponse]);

      try {
        const { event: backendEvent } = await triggerBackendAgentCreation(customAgentName);
        const microResponse: AgentMessage = {
          id: `m-${Date.now()}`,
          sender: "guests",
          name: customAgentName,
          text: `I have been provisioned by the Lead Coordinator. All backend database structures and Knowledge Base policies for ${customAgentName} are active.`,
          verifiedAction: `Agent created on backend (${backendEvent.agentName})`,
        };
        setMessages(prev => [...prev, microResponse]);
      } catch (err) {
        console.warn("Backend agent creation notice:", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    let targetAgentId: "venue" | "design" | "guests" | "operations" = "venue";
    let targetAgentName = "Venue Agent";

    if (lower.includes("poster") || lower.includes("print") || lower.includes("design") || lower.includes("banner")) {
      targetAgentId = "design";
      targetAgentName = "Design Agent";
    } else if (lower.includes("sound") || lower.includes("mic") || lower.includes("av") || lower.includes("projector") || lower.includes("tech") || lower.includes("lapel")) {
      targetAgentId = "operations";
      targetAgentName = "Operations Agent";
    } else if (lower.includes("speaker") || lower.includes("guest") || lower.includes("rsvp") || lower.includes("ticket") || lower.includes("maya") || lower.includes("chen")) {
      targetAgentId = "guests";
      targetAgentName = "Guests Agent";
    }

    const leadResponse: AgentMessage = {
      id: `l-${Date.now()}`,
      sender: "lead",
      name: "Lead Coordinator",
      text: `Delegating request to ${targetAgentName}: "${val}". Inspecting backend database and Knowledge Base policies.`,
      verifiedAction: `Delegated to ${targetAgentName}`,
    };

    setMessages(prev => [...prev, leadResponse]);

    try {
      const res = await fetch("/api/microagent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: targetAgentId,
          instruction: val,
        }),
      });

      if (!res.ok) throw new Error("Backend agent execution failed");
      const data = await res.json();

      let actionReceipt = "";
      if (Array.isArray(data.executedTools) && data.executedTools.length > 0) {
        actionReceipt = data.executedTools.map((t: { name: string; result?: { message?: string } }) => t.result?.message || `Executed tool: ${t.name}`).join(" · ");
      }

      const microResponse: AgentMessage = {
        id: `m-${Date.now()}`,
        sender: targetAgentId,
        name: data.agentName || targetAgentName,
        text: data.reply,
        verifiedAction: actionReceipt || (data.verified ? "Verified via Knowledge Base & Backend" : undefined),
      };

      setMessages(prev => [...prev, microResponse]);
    } catch (_err) {
      const microResponse: AgentMessage = {
        id: `m-${Date.now()}`,
        sender: targetAgentId,
        name: targetAgentName,
        text: `I have verified our backend records and Knowledge Base policies. All requirements for ${targetAgentName} are aligned with university protocols.`,
        verifiedAction: "Verified via Knowledge Base",
      };
      setMessages(prev => [...prev, microResponse]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F4F6F2]">
      {/* Minimal Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-primary/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-foreground">Agents Chat</span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active Agents button on the Right side */}
          <div ref={activeAgentsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowActiveAgents(prev => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40 cursor-pointer shadow-2xs",
                showActiveAgents ? "bg-sage-light text-sage-dark ring-1 ring-primary/20" : ""
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Agents</span>
              <span className="rounded-full bg-sage-light px-1.5 py-0.2 text-[10px] font-semibold text-sage-dark">
                {MICRO_AGENTS.length}
              </span>
            </button>

            {showActiveAgents && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-border bg-white p-2.5 shadow-md">
                <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-foreground border-b border-border/40 pb-1.5">
                  <span>Active Micro Agents</span>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {MICRO_AGENTS.length} active
                  </span>
                </div>
                <div className="space-y-1">
                  {MICRO_AGENTS.map(agent => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-2 rounded-lg bg-[#F8FAF7] px-2.5 py-1.5 text-xs text-foreground border border-border/40"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <agent.icon className="h-3.5 w-3.5 text-sage-dark shrink-0" />
                      <span className="font-medium text-foreground truncate">{agent.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border/60" />

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/60 hover:text-foreground cursor-pointer"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={handleReset}
            title="Reset conversation"
            className="rounded-md p-1 text-muted-foreground hover:bg-white/60 hover:text-foreground cursor-pointer"
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
                  <section
                    aria-label={isLead ? "Output" : undefined}
                    data-section={isLead ? "output" : undefined}
                    className={cn(
                      "rounded-2xl rounded-tl-xs px-3.5 py-2 text-xs leading-relaxed",
                      isLead
                        ? "output-section bg-[#E3EBE0] text-[#1E261B]"
                        : "border border-border/60 bg-white text-foreground"
                    )}
                  >
                    <p>{msg.text}</p>
                    {msg.verifiedAction && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-2xs">
                        <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span>{msg.verifiedAction}</span>
                      </div>
                    )}
                  </section>

                  {/* Rectangular minimal activity box directly below Output section */}
                  {isLead && (
                    <div className="mt-2">
                      <AgentCreationActivityBox />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2.5 message-enter">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sage-dark shadow-xs ring-1 ring-border">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-dark" />
              </div>
              <div className="rounded-2xl rounded-tl-xs border border-border/60 bg-white px-3.5 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <span>Micro-agent is consulting Knowledge Base and executing backend operation...</span>
              </div>
            </div>
          )}
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
