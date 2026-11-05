import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import {
  subscribeLatestAgentCreationEvent,
  fetchLatestAgentCreationEvent,
  type AgentCreationEventDoc,
  DEFAULT_AGENT_CREATION_EVENT,
} from "@/lib/firestore-service";
import { cn } from "@/lib/utils";

interface Props {
  customEvent?: AgentCreationEventDoc | null;
  className?: string;
  showCoordinatorBadge?: boolean;
}

export function AgentCreationActivityBox({ customEvent, className, showCoordinatorBadge = true }: Props) {
  const [event, setEvent] = useState<AgentCreationEventDoc>(customEvent || DEFAULT_AGENT_CREATION_EVENT);

  useEffect(() => {
    if (customEvent) {
      setEvent(customEvent);
      return;
    }

    // Hydrate initial real backend event from Firestore
    fetchLatestAgentCreationEvent().then((evt) => {
      if (evt && evt.agentName) {
        setEvent(evt);
      }
    });

    // Subscribe to live Firestore stream for actual backend events
    const unsubscribe = subscribeLatestAgentCreationEvent((liveEvt) => {
      if (liveEvt && liveEvt.agentName) {
        setEvent(liveEvt);
      }
    });

    return () => unsubscribe();
  }, [customEvent]);

  const isCreating = event.status === "creating";
  const agentName = event.agentName || "Specialist Agent";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rectangular-activity-box flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-white/95 px-3.5 py-2.5 shadow-2xs transition-all duration-200",
        isCreating ? "border-amber-300/80 bg-amber-50/40" : "border-emerald-200/80 bg-emerald-50/20",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Subtle animation when creating / Simple completion indicator when done */}
        {isCreating ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
        ) : (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <Check className="h-2.5 w-2.5 stroke-[2.5]" />
          </span>
        )}

        {/* Real-time status text and agent name */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs leading-normal">
          <span className={cn("font-medium", isCreating ? "text-amber-900" : "text-emerald-900")}>
            {isCreating ? "Creating agent..." : "Agent created."}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="font-semibold text-foreground truncate max-w-[240px] sm:max-w-none">
            {agentName}
          </span>
        </div>
      </div>

      {showCoordinatorBadge && (
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
          Lead Coordinator
        </span>
      )}
    </div>
  );
}
