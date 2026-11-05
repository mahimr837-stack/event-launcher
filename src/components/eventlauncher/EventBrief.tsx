import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Mic,
  DollarSign,
  Pencil,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { type DemoState, type View, formatDate } from "@/lib/event-demo";
import { subscribeActiveEvent, type EventDoc } from "@/lib/firestore-service";

interface Props {
  state: DemoState;
  navigate: (view: View) => void;
  onEdit?: () => void;
}

export function EventBrief({ state, navigate, onEdit }: Props) {
  const [cloudEvent, setCloudEvent] = useState<EventDoc | null>(null);
  const [isSynced, setIsSynced] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeActiveEvent((event) => {
      setCloudEvent(event);
      setIsSynced(true);
    });
    return () => unsubscribe();
  }, []);

  const eventName = cloudEvent?.name || "Annual Career & Tech Seminar";
  const eventDate = state.event.date || cloudEvent?.date || "2026-11-24";
  const eventTime = state.event.time || cloudEvent?.time || "14:00";
  const venueName = state.event.venue || cloudEvent?.venue || "North Hall Auditorium";
  const speakerName = state.event.speaker || cloudEvent?.speaker || "Dr. Maya Chen";
  const audience = state.event.audience || cloudEvent?.audience || 200;
  const budget = cloudEvent?.budget || "$3,500 allocated";
  const category = cloudEvent?.category || "Computer Science & University Relations";
  const isVenueCleared = state.event.venueConfirmed && state.event.permission;

  return (
    <aside
      aria-label="Active event specification"
      className="hidden w-[290px] shrink-0 border-l border-border/80 bg-[#FAFAF8] p-5 lg:flex lg:flex-col xl:w-[320px]"
    >
      {/* Header with live cloud status */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sage-dark">
            Active Event
          </span>
          <h2 className="mt-0.5 text-sm font-semibold text-foreground line-clamp-1">
            {eventName}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-sage-light/80 px-2 py-0.5 text-[10px] font-medium text-sage-dark ring-1 ring-primary/20">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sage"></span>
          </span>
          <span>Cloud Synced</span>
        </div>
      </div>

      {/* Main Details Body */}
      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {/* Category & Status */}
        <div className="rounded-lg border border-border/60 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium text-foreground">{category}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
            <span className="text-muted-foreground">Plan Status</span>
            <span className="font-medium text-sage-dark">{state.plan}</span>
          </div>
        </div>

        {/* Date & Time */}
        <div className="rounded-lg border border-border/60 bg-white p-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sage-light text-sage-dark">
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Date & Schedule</p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                {formatDate(eventDate)}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {eventTime} (EST)
              </p>
            </div>
          </div>
        </div>

        {/* Venue & Capacity */}
        <div className="rounded-lg border border-border/60 bg-white p-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sage-light text-sage-dark">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Venue & Clearance</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                {venueName}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {isVenueCleared ? (
                  <span className="inline-flex items-center gap-1 text-sage-dark">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-clay">
                    <AlertCircle className="h-3 w-3" /> Approval in progress
                  </span>
                )}
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground">{audience} seats</span>
              </div>
            </div>
          </div>
        </div>

        {/* Keynote Speaker */}
        <div className="rounded-lg border border-border/60 bg-white p-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sage-light text-sage-dark">
              <Mic className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Keynote Speaker</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                {speakerName}
              </p>
              <p className="text-[11px] text-muted-foreground">Technical presentation</p>
            </div>
          </div>
        </div>

        {/* Budget Allocation */}
        <div className="rounded-lg border border-border/60 bg-white p-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sage-light text-sage-dark">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground">Budget Allocation</p>
              <p className="mt-0.5 text-xs font-semibold text-foreground">{budget}</p>
              <p className="text-[11px] text-muted-foreground">Audited by Student Council</p>
            </div>
          </div>
        </div>

        {/* Live Micro-Agents Counter */}
        <div className="rounded-lg border border-primary/20 bg-sage-light/40 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-sage-dark" />
              <span className="text-xs font-medium text-sage-dark">4 Micro-Agents Active</span>
            </div>
            <button
              onClick={() => navigate("Agents")}
              className="text-[11px] font-medium text-sage-dark hover:underline"
            >
              View
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Venue, Communications, Registration, and Operations drafting on standby.
          </p>
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-auto border-t border-border/60 pt-3">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground shadow-2xs hover:bg-[#F2F5F0] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Edit Event Parameters
          </button>
        )}
      </div>
    </aside>
  );
}
