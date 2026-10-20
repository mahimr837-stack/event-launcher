import { useState, type Dispatch } from "react";
import { ArrowUpRight, Check, Clock3, ClipboardList, Pencil, UserRound, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type DemoAction, type DemoState, type Task, type TaskStatus, formatDate, taskStatus } from "@/lib/event-demo";
import { cn } from "@/lib/utils";
import { ActionButton, fieldClass, labelClass, SectionHeading, StatusBadge } from "./Primitives";

export function PeopleTasks({ state, dispatch, onWorkspace }: { state: DemoState; dispatch: Dispatch<DemoAction>; onWorkspace: () => void }) {
  const [filter, setFilter] = useState("All tasks");
  const [editing, setEditing] = useState<Task | null>(null);
  const tasks = state.tasks.filter(task => filter === "All tasks" || (filter === "Completed" ? task.status === "Completed" : ["Blocked", "Overdue"].includes(taskStatus(task, state))));
  const completed = state.tasks.filter(t => t.status === "Completed").length;
  const needsAttention = state.tasks.filter(t => ["Blocked", "Overdue"].includes(taskStatus(t, state))).length;
  const poster = state.tasks.find(t => t.id === "poster");
  const canAdvance = !!poster && poster.status !== "Completed" && poster.deadline >= state.now.slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-9">
      <SectionHeading eyebrow="Real people. Clear responsibilities." title="People & tasks" description="Offline work needs an owner, a deadline, and an explicit status update.">
        <span className="rounded-lg border bg-white px-3 py-2 text-[11px] text-muted-foreground">
          {completed} of {state.tasks.length} completed
        </span>
      </SectionHeading>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-white p-1">
          {[
            { label: "All tasks", count: state.tasks.length },
            { label: "Needs attention", count: needsAttention },
            { label: "Completed", count: completed },
          ].map(({ label, count }) => {
            const isActive = filter === label;
            return (
              <button
                key={label}
                onClick={() => setFilter(label)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? label === "Needs attention"
                      ? "bg-[#F7ECE9] text-clay ring-1 ring-clay/25"
                      : label === "Completed"
                      ? "bg-sage-light text-sage-dark ring-1 ring-primary/20"
                      : "bg-sage-light text-sage-dark"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold",
                    isActive
                      ? label === "Needs attention"
                        ? "bg-clay text-white"
                        : "bg-sage-dark text-white"
                      : label === "Needs attention" && count > 0
                      ? "bg-clay-light text-clay"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />Demo clock · {formatDate(state.now, true)}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="hidden grid-cols-[minmax(190px,1.5fr)_minmax(140px,1fr)_100px_115px_65px] gap-4 border-b bg-background/50 px-5 py-3 text-[9px] font-medium uppercase tracking-wider text-muted-foreground lg:grid">
          <span>Responsibility</span>
          <span>Owner</span>
          <span>Due date</span>
          <span>Status</span>
          <span className="text-right">Update</span>
        </div>
        <div className="divide-y">
          {tasks.map(task => {
            const status = taskStatus(task, state);
            const isAttention = status === "Blocked" || status === "Overdue";
            const isCompleted = status === "Completed";

            return (
              <div
                key={task.id}
                className={cn(
                  "grid items-center gap-4 px-5 py-4 transition-colors lg:grid-cols-[minmax(190px,1.5fr)_minmax(140px,1fr)_100px_115px_65px]",
                  isAttention
                    ? "bg-[#FCFAF9]/70 hover:bg-[#F9F5F3]"
                    : isCompleted
                    ? "bg-[#FAFBF9]/60 hover:bg-[#F4F6F2]"
                    : "hover:bg-muted/20"
                )}
              >
                <div>
                  <p className="text-xs font-medium text-foreground">{task.title}</p>
                  {status === "Blocked" && (
                    <p className="mt-1 text-[10px] leading-relaxed text-clay font-medium">
                      {task.venueDependent && (!state.event.venueConfirmed || !state.event.permission)
                        ? "Waiting for venue clearance"
                        : task.note || "Owner reported a blocker"}
                    </p>
                  )}
                  {status === "Overdue" && (
                    <p className="mt-1 text-[10px] leading-relaxed text-clay font-medium">
                      {task.note || "Task is past due date; awaiting completion report."}
                    </p>
                  )}
                  {status === "Completed" && task.note && (
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {task.note}
                    </p>
                  )}
                  {status !== "Blocked" && status !== "Overdue" && status !== "Completed" && task.note && (
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {task.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-sage-dark">
                    {task.owner.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium">{task.owner}</p>
                    <p className="mt-0.5 break-all text-[9px] text-muted-foreground">{task.email}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(task.deadline, true)}
                  <span className="ml-2 text-[9px] lg:ml-0 lg:block">
                    {task.id === "poster" ? "4:00 PM" : task.id === "av" ? "Before event day" : "Before doors open"}
                  </span>
                </p>
                <div>
                  <StatusBadge status={status} />
                </div>
                <button
                  onClick={() => setEditing(task)}
                  title="Update task"
                  className="flex items-center gap-1.5 text-[11px] font-medium text-sage-dark hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  Update
                </button>
              </div>
            );
          })}
          {!tasks.length && (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto h-7 w-7 text-sage-dark" />
              <p className="mt-3 text-sm font-medium">
                {filter === "Completed" ? "No completed tasks yet." : "No tasks need attention."}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {filter === "Completed" ? "Completion appears only after an explicit update." : "Check the other filters for your full task list."}
              </p>
            </div>
          )}
        </div>
      </div>
    {!poster && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-white/50 p-5"><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-sage-dark"/><div><p className="text-xs font-medium">The poster needs an owner.</p><p className="mt-1 text-[11px] text-muted-foreground">The coordinator collects their details after plan approval.</p></div></div><ActionButton variant="outline" onClick={onWorkspace}>Continue in Workspace<ArrowUpRight/></ActionButton></div>}
    {poster && <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-clay-light p-4"><div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 h-4 w-4 text-clay"/><div><p className="text-xs font-medium text-clay">Try a missed deadline</p><p className="mt-1 text-[11px] text-muted-foreground">Advance the demo clock beyond the poster deadline to see the coordinator’s response.</p></div></div><ActionButton variant="outline" disabled={!canAdvance} onClick={() => dispatch({ type: "ADVANCE_CLOCK" })}>{poster.status === "Completed" ? "Poster already completed" : canAdvance ? "Simulate overdue poster" : "Demo clock advanced"}</ActionButton></div>}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-background"><DialogHeader><DialogTitle>Update responsibility</DialogTitle><DialogDescription className="text-xs leading-relaxed">{editing?.title}. Physical completion must be explicitly reported; it is never inferred.</DialogDescription></DialogHeader>{editing && <TaskForm key={editing.id} task={editing} state={state} onSave={task => { dispatch({ type: "UPDATE_TASK", task }); setEditing(null); }}/>}</DialogContent></Dialog>
    </div>
  );
}
function TaskForm({ task, state, onSave }: { task: Task; state: DemoState; onSave: (task: Task) => void }) {
  const [draft, setDraft] = useState(task);
  const venueBlocked = task.venueDependent && (!state.event.venueConfirmed || !state.event.permission);
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave(draft); }}><div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Owner name</span><input className={fieldClass} required pattern=".*\S.*" maxLength={80} value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })}/></label><label><span className={labelClass}>Email address</span><input className={fieldClass} required type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}/></label></div><div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Deadline</span><input className={fieldClass} required type="date" value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })}/></label><label><span className={labelClass}>Reported status</span><select className={fieldClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as TaskStatus })}>{["Pending", "In progress", "Blocked", "Completed"].map(status => <option key={status} disabled={status === "Completed" && venueBlocked}>{status}</option>)}</select></label></div>{venueBlocked && <p className="rounded-lg bg-clay-light p-3 text-[11px] leading-relaxed text-clay">This task is blocked by venue clearance. You can record progress or a note, but completion is unavailable until the venue decision is confirmed.</p>}<label className="block"><span className={labelClass}>Completion or progress note <span className="font-normal">· optional</span></span><textarea className={`${fieldClass} h-20 resize-none py-2.5`} maxLength={300} value={draft.note} placeholder="What changed? What still needs attention?" onChange={e => setDraft({ ...draft, note: e.target.value })}/></label><ActionButton type="submit" className="w-full"><Check/>Save explicit update</ActionButton></form>;
}
