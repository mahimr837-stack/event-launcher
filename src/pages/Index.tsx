import { useReducer, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, ArrowUpRight, CalendarDays, ChevronRight, ClipboardList, LayoutGrid, Leaf, MessageSquare, Network, RotateCcw, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createInitialState, demoReducer, type View } from "@/lib/event-demo";
import { cn } from "@/lib/utils";
import { ActionButton, Mark, StatusBadge } from "@/components/eventlauncher/Primitives";
import { Workspace } from "@/components/eventlauncher/Workspace";
import { EventBrief } from "@/components/eventlauncher/EventBrief";
import { EditEventDialog, EventPlan, PlanReviewDialog } from "@/components/eventlauncher/EventPlan";
import { Agents } from "@/components/eventlauncher/Agents";
import { PeopleTasks } from "@/components/eventlauncher/PeopleTasks";
import { ActivityView } from "@/components/eventlauncher/Activity";

const navigation = [
  { name: "Workspace" as View, icon: MessageSquare, slug: "workspace" },
  { name: "Event Plan" as View, icon: ClipboardList, slug: "plan" },
  { name: "Agents" as View, icon: Network, slug: "agents" },
  { name: "People & Tasks" as View, icon: UsersRound, slug: "people" },
  { name: "Activity" as View, icon: Activity, slug: "activity" },
];
const Index = () => {
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialState);
  const [params, setParams] = useSearchParams();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const view = navigation.find(item => item.slug === params.get("view"))?.name || "Workspace";
  const navigate = (next: View) => setParams(next === "Workspace" ? {} : { view: navigation.find(item => item.name === next)!.slug });
  const reviewPlan = () => { if (state.plan !== "Not started") { dispatch({ type: "REVIEW_PLAN" }); setReviewOpen(true); } };
  const reset = () => { dispatch({ type: "RESET" }); setGeneration(g => g + 1); navigate("Workspace"); setReviewOpen(false); setEditOpen(false); setResetOpen(false); };
  return <div className="flex h-dvh min-h-[500px] overflow-hidden bg-background">
    <aside aria-label="Main navigation" className="flex w-[62px] shrink-0 flex-col border-r bg-[#FBFAF7] md:w-[218px]">
      <button onClick={() => navigate("Workspace")} aria-label="EventLauncher workspace" className="flex h-[76px] shrink-0 items-center gap-2.5 px-3 md:px-5"><Mark small className="rounded-lg"/><span className="hidden text-[18px] font-semibold tracking-[-.7px] md:inline">eventlauncher<span className="text-sage-dark">.</span></span></button>
      <div className="px-2 md:px-4"><div className="flex items-center gap-2.5 rounded-lg border bg-white px-2.5 py-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted"><LayoutGrid className="h-3.5 w-3.5 text-sage-dark"/></span><div className="hidden min-w-0 md:block"><p className="truncate text-[11px] font-medium">Career Development Club</p><p className="mt-0.5 text-[9px] text-muted-foreground">Northbridge University · demo</p></div></div></div>
      <div className="mt-7 px-2 md:px-3"><p className="mb-3 hidden px-3 text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground md:block">Your workspace</p><nav className="space-y-1">{navigation.map(item => <button key={item.name} onClick={() => navigate(item.name)} aria-current={view === item.name ? "page" : undefined} title={item.name} className={cn("relative flex h-10 w-full items-center justify-center gap-3 rounded-lg px-3 text-[12px] transition-colors md:justify-start", view === item.name ? "bg-sage-light font-medium text-sage-dark" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-4 w-4 shrink-0"/><span className="hidden md:inline">{item.name}</span>{item.name === "Agents" && <span className="ml-auto hidden text-[9px] text-muted-foreground md:block">4</span>}{item.name === "Workspace" && view === item.name && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-sage md:block"/>}</button>)}</nav></div>
      <div className="mt-7 hidden px-6 md:block"><p className="mb-3 text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground">Current event</p><button onClick={() => navigate("Workspace")} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-sage-dark"><span className="h-1.5 w-1.5 rounded-full bg-sage"/>Career Seminar<span className="ml-1 rounded bg-muted px-1 py-0.5 text-[8px]">{state.plan === "Approved" ? "Active" : "Draft"}</span></button></div>
      <div className="mt-auto px-2 pb-4 md:px-4"><div className="mb-4 hidden rounded-xl border bg-[#F3F1E9] p-3.5 md:block"><Leaf className="mb-2.5 h-4 w-4 text-sage-dark"/><p className="text-[11px] font-medium">Less juggling. More possibility.</p><p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">A little structure for your next big idea. This is a guided, local demo.</p></div><button onClick={() => setResetOpen(true)} title="Reset demo" className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] text-muted-foreground hover:bg-muted md:justify-start"><RotateCcw className="h-3.5 w-3.5"/><span className="hidden md:inline">Reset demo</span></button><div className="flex items-center justify-center gap-2.5 border-t pt-4 md:justify-start"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8DED2] text-[10px] font-medium text-[#655B50]">JD</span><div className="hidden md:block"><p className="text-[11px] font-medium">Jordan Davis</p><p className="mt-0.5 text-[9px] text-muted-foreground">Student organizer · demo</p></div></div></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b bg-[#FBFAF7] px-4 sm:px-7"><div className="flex min-w-0 items-center gap-3"><span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white sm:flex"><CalendarDays className="h-4 w-4 text-sage-dark"/></span><div className="min-w-0"><div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="hidden sm:inline">Events</span><ChevronRight className="hidden h-3 w-3 sm:inline"/><span className="truncate">University Career Seminar</span></div><p className="mt-1 text-xs font-medium">{view}</p></div></div><div className="flex shrink-0 items-center gap-3"><div className="hidden sm:block"><StatusBadge status={state.plan === "Approved" ? "Plan approved" : "Draft event"}/></div><span className="flex items-center gap-1.5 rounded-md border border-primary/15 bg-sage-light px-2.5 py-1.5 text-[9px] font-medium text-sage-dark"><span className="h-1.5 w-1.5 rounded-full bg-sage"/>Interactive demo</span></div></header>
      <main className="flex min-h-0 flex-1 overflow-hidden"><div key={generation} className={cn("min-w-0 flex-1", view === "Workspace" ? "overflow-hidden" : "soft-scroll overflow-y-auto")}>
        {view === "Workspace" && <Workspace state={state} dispatch={dispatch} navigate={navigate} onEdit={() => setEditOpen(true)} onReview={reviewPlan}/>}
        {view === "Event Plan" && <EventPlan state={state} dispatch={dispatch} onEdit={() => setEditOpen(true)} onReview={reviewPlan}/>}
        {view === "Agents" && <Agents state={state} onPlan={() => navigate("Event Plan")}/>}
        {view === "People & Tasks" && <PeopleTasks state={state} dispatch={dispatch} onWorkspace={() => navigate("Workspace")}/>}
        {view === "Activity" && <ActivityView state={state} dispatch={dispatch} onWorkspace={() => navigate("Workspace")}/>}
      </div>{view === "Workspace" && <EventBrief state={state} navigate={navigate}/>}</main>
    </div>
    <PlanReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} state={state} dispatch={dispatch}/><EditEventDialog open={editOpen} onOpenChange={setEditOpen} state={state} dispatch={dispatch}/>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent className="max-w-sm rounded-2xl bg-background"><DialogHeader><DialogTitle>A fresh start?</DialogTitle><DialogDescription className="pt-2 text-xs leading-relaxed">Reset the conversation, event details, approvals, assignments, demo connections, and clock. Entered information will be removed.</DialogDescription></DialogHeader><div className="mt-2 flex justify-end gap-2"><ActionButton variant="outline" onClick={() => setResetOpen(false)}>Keep exploring</ActionButton><ActionButton onClick={reset}><RotateCcw/>Reset demo</ActionButton></div></DialogContent></Dialog>
  </div>;
};
export default Index;
