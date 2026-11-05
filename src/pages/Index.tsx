import { useReducer, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity, ArrowUpRight, ClipboardList, Link2, LogIn, LogOut, MessageSquare, Network, RotateCcw, ShieldCheck, UsersRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createInitialState, demoReducer, type View } from "@/lib/event-demo";
import { cn } from "@/lib/utils";
import { ActionButton, Mark } from "@/components/eventlauncher/Primitives";
import { Workspace } from "@/components/eventlauncher/Workspace";
import { EventBrief } from "@/components/eventlauncher/EventBrief";
import { EditEventDialog, EventPlan, PlanReviewDialog } from "@/components/eventlauncher/EventPlan";
import { Agents } from "@/components/eventlauncher/Agents";
import { PeopleTasks } from "@/components/eventlauncher/PeopleTasks";
import { ActivityView } from "@/components/eventlauncher/Activity";
import { IntegrationView } from "@/components/eventlauncher/Integration";
import { useAuth } from "@/lib/auth-context";

const navigation = [
  { name: "Workspace" as View, icon: MessageSquare, slug: "workspace" },
  { name: "Ecosystem" as View, icon: Link2, slug: "ecosystem" },
  { name: "Event Plan" as View, icon: ClipboardList, slug: "plan" },
  { name: "Agents" as View, icon: Network, slug: "agents" },
  { name: "People & Tasks" as View, icon: UsersRound, slug: "people" },
  { name: "Activity" as View, icon: Activity, slug: "activity" },
];
const Index = () => {
  const [state, dispatch] = useReducer(demoReducer, undefined, createInitialState);
  const [params, setParams] = useSearchParams();
  const routerNavigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signInWithGoogle, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const view = navigation.find(item => item.slug === params.get("view"))?.name || "Workspace";
  const navigate = (next: View) => setParams(next === "Workspace" ? {} : { view: navigation.find(item => item.name === next)!.slug });
  const reviewPlan = () => { if (state.plan !== "Not started") { dispatch({ type: "REVIEW_PLAN" }); setReviewOpen(true); } };
  const reset = () => { dispatch({ type: "RESET" }); setGeneration(g => g + 1); navigate("Workspace"); setReviewOpen(false); setEditOpen(false); setResetOpen(false); };

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("Sign in failed:", err);
    } finally {
      setSigningIn(false);
    }
  };

  const userInitials = (user?.displayName || user?.email || "JD")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return <div className="flex h-dvh min-h-[500px] overflow-hidden bg-background">
    <aside aria-label="Main navigation" className="flex w-[62px] shrink-0 flex-col border-r bg-[#FBFAF7] md:w-[218px]">
      <button onClick={() => navigate("Workspace")} aria-label="EventLauncher workspace" className="flex h-[76px] shrink-0 items-center gap-2.5 px-3 md:px-5"><Mark small className="rounded-lg"/><span className="hidden text-[18px] font-semibold tracking-[-.7px] md:inline">eventlauncher<span className="text-sage-dark">.</span></span></button>
      <div className="mt-2 px-2 md:px-3"><nav className="space-y-1">{navigation.map(item => <button key={item.name} onClick={() => navigate(item.name)} aria-current={view === item.name ? "page" : undefined} title={item.name} className={cn("relative flex h-10 w-full items-center justify-center gap-3 rounded-lg px-3 text-[12px] transition-colors md:justify-start", view === item.name ? "bg-sage-light font-medium text-sage-dark" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-4 w-4 shrink-0"/><span className="hidden md:inline">{item.name}</span>{item.name === "Agents" && <span className="ml-auto hidden text-[9px] text-muted-foreground md:block">4</span>}{item.name === "Workspace" && view === item.name && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-sage md:block"/>}</button>)}</nav></div>
      <div className="mt-7 hidden px-6 md:block"><p className="mb-3 text-[9px] font-medium uppercase tracking-[.15em] text-muted-foreground">Current event</p><button onClick={() => navigate("Workspace")} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-sage-dark"><span className="h-1.5 w-1.5 rounded-full bg-sage"/>Career Seminar</button></div>
      
      <div className="mt-auto px-2 pb-4 md:px-3 space-y-2">
        {/* Strictly hidden for normal users. Only displayed if isAdmin === true */}
        {isAdmin && (
          <button
            onClick={() => routerNavigate("/admin")}
            title="Admin Console"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors md:justify-start"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
            <span className="hidden md:inline font-semibold">Admin Console</span>
            <span className="ml-auto hidden rounded bg-emerald-200/70 px-1 py-0.2 text-[9px] font-bold text-emerald-900 md:inline">
              SECURE
            </span>
          </button>
        )}

        <button onClick={() => setResetOpen(true)} title="Reset demo" className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted md:justify-start">
          <RotateCcw className="h-3.5 w-3.5"/>
          <span className="hidden md:inline">Reset workspace</span>
        </button>

        {/* User Account / Google Sign-in */}
        <div className="border-t border-border/60 pt-3">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8DED2] text-[10px] font-medium text-[#655B50]">
                    {userInitials}
                  </span>
                )}
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-[11px] font-medium text-foreground">
                    {user.displayName || user.email?.split("@")[0] || "User"}
                  </p>
                  <p className="truncate text-[9px] text-muted-foreground">
                    {isAdmin ? (
                      <span className="font-semibold text-emerald-700">Administrator</span>
                    ) : (
                      user.email || "Signed in"
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                title="Sign out"
                className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn || authLoading}
                title="Sign in with Google"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-xs hover:bg-muted/50 transition-colors disabled:opacity-50 md:justify-start"
              >
                {signingIn || authLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span className="hidden md:inline">Sign in with Google</span>
              </button>
              <p className="hidden text-[9px] text-muted-foreground/80 text-center md:block">
                Normal sign-in for organizers
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <main className="flex min-h-0 flex-1 overflow-hidden"><div key={generation} className={cn("min-w-0 flex-1 bg-[#F2F5F0]", (view === "Workspace" || view === "Agents") ? "overflow-hidden" : "soft-scroll overflow-y-auto")}>
        {view === "Workspace" && <Workspace state={state} dispatch={dispatch} navigate={navigate} onEdit={() => setEditOpen(true)} onReview={reviewPlan}/>}
        {(view === "Ecosystem" || view === "Integration") && <IntegrationView state={state} onWorkspace={() => navigate("Workspace")} onNavigate={navigate}/>}
        {view === "Event Plan" && <EventPlan state={state} dispatch={dispatch} onEdit={() => setEditOpen(true)} onReview={reviewPlan}/>}
        {view === "Agents" && <Agents state={state} onPlan={() => navigate("Event Plan")}/>}
        {view === "People & Tasks" && <PeopleTasks state={state} dispatch={dispatch} onWorkspace={() => navigate("Workspace")}/>}
        {view === "Activity" && <ActivityView state={state} dispatch={dispatch} onWorkspace={() => navigate("Workspace")}/>}
      </div>{view === "Workspace" && <EventBrief state={state} navigate={navigate} onEdit={() => setEditOpen(true)}/>}</main>
    </div>
    <PlanReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} state={state} dispatch={dispatch}/><EditEventDialog open={editOpen} onOpenChange={setEditOpen} state={state} dispatch={dispatch}/>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent className="max-w-sm rounded-2xl bg-background"><DialogHeader><DialogTitle>A fresh start?</DialogTitle><DialogDescription className="pt-2 text-xs leading-relaxed">Reset the conversation, event details, approvals, assignments, demo connections, and clock. Entered information will be removed.</DialogDescription></DialogHeader><div className="mt-2 flex justify-end gap-2"><ActionButton variant="outline" onClick={() => setResetOpen(false)}>Keep exploring</ActionButton><ActionButton onClick={reset}><RotateCcw/>Reset demo</ActionButton></div></DialogContent></Dialog>
  </div>;
};
export default Index;
