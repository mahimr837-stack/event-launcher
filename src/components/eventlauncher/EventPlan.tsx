import { useState, type Dispatch } from "react";
import { CalendarDays, Check, ChevronRight, Clock, MapPin, Pencil, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { type DemoAction, type DemoState, type EventDetails, formatDate, offsetDate } from "@/lib/event-demo";
import { ActionButton, fieldClass, labelClass } from "./Primitives";
import { cn } from "@/lib/utils";

interface Props {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  onEdit: () => void;
  onReview: () => void;
}

export function milestones(state: DemoState) {
  const cleared = state.event.venueConfirmed && state.event.permission;
  const approved = state.plan === "Approved";
  return [
    {
      title: "Confirm venue & university clearance",
      owner: "Venue & Permissions",
      deadline: offsetDate(state.event.date, -10),
      dependency: "Room capacity and university sign-off",
      status: !approved ? "Proposed" : cleared ? "Completed" : state.venueRequest === "Not started" ? "Blocked" : state.venueRequest,
    },
    {
      title: "Prepare keynote speaker invitation",
      owner: "Registration & Guests",
      deadline: offsetDate(state.event.date, -9),
      dependency: "Plan approval · email connection for future send",
      status: state.invitation === "Prepared" ? "Completed" : "Proposed",
    },
    {
      title: "Design event poster & announcement",
      owner: "Communications & Design",
      deadline: offsetDate(state.event.date, -7),
      dependency: "Requires venue clearance before publishing",
      status: !approved ? "Proposed" : state.announcement === "Prepared" ? "Completed" : !cleared ? "Blocked" : "In progress",
    },
    {
      title: "Launch registration & attendee reception",
      owner: "Registration & Guests",
      deadline: offsetDate(state.event.date, -5),
      dependency: "Requires confirmed venue room",
      status: !approved ? "Proposed" : !cleared ? "Blocked" : "Pending",
    },
    {
      title: "Equipment sound check & room setup",
      owner: "Event-day Operations",
      deadline: offsetDate(state.event.date, -1),
      dependency: "AV testing and room arrangement",
      status: !approved ? "Proposed" : !cleared ? "Blocked" : state.tasks.filter(t => t.venueDependent).every(t => t.status === "Completed") ? "Completed" : "In progress",
    },
  ];
}

function StatusPill({ status }: { status: string }) {
  const isDone = status === "Completed" || status === "Approved" || status === "Simulated as completed";
  const isBlocked = status === "Blocked";
  const isInProgress = status === "In progress";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-tight",
        isDone && "bg-sage-light text-sage-dark ring-1 ring-primary/20",
        isBlocked && "bg-clay-light text-clay ring-1 ring-clay/20",
        isInProgress && "bg-white text-sage-dark ring-1 ring-primary/30",
        !isDone && !isBlocked && !isInProgress && "bg-muted text-muted-foreground"
      )}
    >
      {isDone && <Check className="h-3 w-3" />}
      {isBlocked && <ShieldAlert className="h-3 w-3" />}
      {isInProgress && <span className="h-1.5 w-1.5 rounded-full bg-sage" />}
      {status}
    </span>
  );
}

export function PlanMilestones({ state }: { state: DemoState }) {
  const items = milestones(state);

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-white">
      <div className="divide-y divide-border/60">
        {items.map((item, index) => {
          const isDone = item.status === "Completed" || item.status === "Simulated as completed";
          const isBlocked = item.status === "Blocked";

          return (
            <div key={item.title} className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/30 sm:px-6 sm:py-4">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  isDone
                    ? "bg-sage text-white"
                    : isBlocked
                    ? "bg-clay-light text-clay"
                    : "border border-border bg-background text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className={cn("text-xs font-medium sm:text-sm", isDone ? "text-foreground font-semibold" : "text-foreground")}>
                    {item.title}
                  </h3>
                  <StatusPill status={item.status} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{item.owner}</span>
                  <span className="text-border">·</span>
                  <span>Due {formatDate(item.deadline, true)}</span>
                  {item.dependency && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-muted-foreground/80">{item.dependency}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlanCard({ state, dispatch, onEdit, onReview }: Props) {
  const items = milestones(state).slice(0, 3);

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Event Milestones</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Key dependencies and schedule</p>
        </div>
        <StatusPill status={state.plan} />
      </div>

      <div className="space-y-3 py-4">
        {items.map((item, idx) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{item.owner} · by {formatDate(item.deadline, true)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3.5">
        <ActionButton onClick={onReview} className="bg-primary text-white hover:bg-sage-dark">
          {state.plan === "Approved" ? "View plan" : "Review plan"}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton variant="outline" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3 w-3" />
          Edit
        </ActionButton>
        {state.plan === "Awaiting approval" && (
          <ActionButton onClick={() => dispatch({ type: "APPROVE_PLAN" })} className="bg-sage text-white">
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Approve plan
          </ActionButton>
        )}
      </div>
    </div>
  );
}

export function EventPlan({ state, dispatch, onEdit, onReview }: Props) {
  const cleared = state.event.venueConfirmed && state.event.permission;
  const isApproved = state.plan === "Approved";

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10">
      {/* Clean Header Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Event Plan</h1>
          <p className="mt-1 text-xs text-muted-foreground">Milestones, schedules, and active dependencies.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={state.plan} />
          {state.plan !== "Not started" && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit Details</span>
            </button>
          )}
        </div>
      </div>

      {state.plan === "Not started" ? (
        <div className="rounded-2xl border border-border/80 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage-light text-sage-dark">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Plan will appear here</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Enter your event date and room details in the Workspace to generate the plan.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Overview Metric Strip */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-white p-4 sm:grid-cols-4 sm:p-5">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3 text-sage-dark" />
                Date & Time
              </p>
              <p className="mt-1.5 text-xs font-semibold text-foreground">
                {state.event.date ? `${formatDate(state.event.date, true)}` : "TBD"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{state.event.time || "14:00"}</p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <MapPin className="h-3 w-3 text-sage-dark" />
                Venue
              </p>
              <p className="mt-1.5 truncate text-xs font-semibold text-foreground">
                {state.event.venue || "TBD"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {cleared ? "Clearance confirmed" : "Approval needed"}
              </p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Users className="h-3 w-3 text-sage-dark" />
                Capacity
              </p>
              <p className="mt-1.5 text-xs font-semibold text-foreground">
                {state.event.audience ? `${state.event.audience} attendees` : "TBD"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Expected students</p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3 text-sage-dark" />
                Keynote
              </p>
              <p className="mt-1.5 truncate text-xs font-semibold text-foreground">
                {state.event.speaker || "Not selected"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Main speaker</p>
            </div>
          </div>

          {/* Milestones Timeline */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-foreground">Milestones</h2>
              <span className="text-[10px] text-muted-foreground">5 Key Milestones</span>
            </div>
            <PlanMilestones state={state} />
          </div>

          {/* Approval Prompt when Awaiting Approval */}
          {!isApproved && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-sage-light/60 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-sage-dark">Review & Approve Plan</p>
                  <p className="text-[11px] text-muted-foreground">
                    Approving activates specialist assignments and unlocks poster production.
                  </p>
                </div>
              </div>
              <ActionButton onClick={onReview} className="bg-primary text-white hover:bg-sage-dark">
                Review & Approve
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </ActionButton>
            </div>
          )}

          {/* Venue Approval Action Card */}
          {isApproved && !cleared && (
            <div className="rounded-xl border border-border/80 bg-white p-5">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-clay" />
                  <h3 className="text-xs font-semibold text-foreground">Venue Clearance Request</h3>
                </div>
                <StatusPill status={state.venueRequest} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                University clearance for {state.event.venue || "the hall"} ({state.event.audience || 150} students).
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {state.venueRequest === "Not started" && (
                  <ActionButton onClick={() => dispatch({ type: "PREPARE_VENUE" })} className="bg-primary text-white">
                    Prepare clearance request
                  </ActionButton>
                )}
                {state.venueRequest === "Prepared" && (
                  <ActionButton onClick={() => dispatch({ type: "SUBMIT_VENUE" })} className="bg-primary text-white">
                    Submit request for review
                  </ActionButton>
                )}
                {state.venueRequest === "Awaiting approval" && (
                  <ActionButton onClick={() => dispatch({ type: "CONFIRM_VENUE" })} className="bg-primary text-white">
                    Simulate university clearance
                  </ActionButton>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlanReviewDialog({
  open,
  onOpenChange,
  state,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-xl gap-4 overflow-y-auto rounded-2xl bg-white p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {state.plan === "Approved" ? "Approved Event Plan" : "Review Event Plan"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {formatDate(state.event.date)} · {state.event.audience} attendees · {state.event.venue || "Venue TBD"}
          </DialogDescription>
        </DialogHeader>

        <PlanMilestones state={state} />

        <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
          <StatusPill status={state.plan} />
          {state.plan !== "Approved" ? (
            <ActionButton
              onClick={() => {
                dispatch({ type: "APPROVE_PLAN" });
                onOpenChange(false);
              }}
              className="bg-primary text-white hover:bg-sage-dark"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Approve Plan
            </ActionButton>
          ) : (
            <ActionButton variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </ActionButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditEventDialog({
  open,
  onOpenChange,
  state,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit Event Details</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update event parameters. Revisions update dependent milestones automatically.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EventDetailsForm
            key={`${state.event.date}-${state.plan}`}
            event={state.event}
            now={state.now}
            onSave={event => {
              dispatch({ type: "EDIT_EVENT", event });
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventDetailsForm({
  event,
  now,
  onSave,
}: {
  event: EventDetails;
  now: string;
  onSave: (event: EventDetails) => void;
}) {
  const [draft, setDraft] = useState(event);

  return (
    <form
      className="mt-2 space-y-4"
      onSubmit={e => {
        e.preventDefault();
        onSave({ ...draft, venue: draft.venue.trim(), speaker: draft.speaker.trim() });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>Event date</span>
          <input
            aria-label="Event date"
            className={fieldClass}
            required
            type="date"
            min={offsetDate(now.slice(0, 10), 1)}
            value={draft.date}
            onChange={e => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
        <label>
          <span className={labelClass}>Start time</span>
          <input
            aria-label="Start time"
            className={fieldClass}
            required
            type="time"
            value={draft.time}
            onChange={e => setDraft({ ...draft, time: e.target.value })}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Venue name</span>
        <input
          className={fieldClass}
          required
          maxLength={100}
          pattern=".*\S.*"
          value={draft.venue}
          onChange={e => setDraft({ ...draft, venue: e.target.value })}
        />
      </label>

      <div className="space-y-2.5 rounded-lg border border-border/80 bg-[#FBFBFA] p-3 text-xs">
        <label className="flex items-center gap-2">
          <Checkbox
            className="rounded border-border"
            checked={draft.venueConfirmed}
            onCheckedChange={checked => setDraft({ ...draft, venueConfirmed: checked === true })}
          />
          Room reservation confirmed
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            className="rounded border-border"
            checked={draft.permission}
            onCheckedChange={checked => setDraft({ ...draft, permission: checked === true })}
          />
          University clearance confirmed
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Keynote speaker</span>
        <input
          className={fieldClass}
          required
          maxLength={100}
          pattern=".*\S.*"
          value={draft.speaker}
          onChange={e => setDraft({ ...draft, speaker: e.target.value })}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Expected attendees</span>
        <input
          className={fieldClass}
          required
          type="number"
          min={1}
          max={2000}
          value={draft.audience}
          onChange={e => setDraft({ ...draft, audience: Number(e.target.value) })}
        />
      </label>

      <ActionButton type="submit" className="w-full bg-primary text-white hover:bg-sage-dark">
        Save & Update Plan
      </ActionButton>
    </form>
  );
}
