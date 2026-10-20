import { useEffect, useRef, useState, type Dispatch } from "react";
import { ArrowUp } from "lucide-react";
import { type DemoAction, type DemoState, type View, offsetDate } from "@/lib/event-demo";
import { ActionButton, Mark } from "./Primitives";
import { ConversationActions, RiskCard } from "./ConversationActions";

interface Props { state: DemoState; dispatch: Dispatch<DemoAction>; navigate: (view: View) => void; onEdit: () => void; onReview: () => void }
export function Workspace({ state, dispatch, navigate, onEdit, onReview }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const lastRiskId = state.messages.filter(m => m.kind === "risk").at(-1)?.id;
  useEffect(() => { if (state.messages.length > 2) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }); }, [state.messages.length, state.stage]);
  function submit(text = input) {
    const value = text.trim();
    if (!value) return;
    setError("");
    if (/skip.*venue|announce.*now/i.test(value)) dispatch({ type: "RISK" });
    else if (/review.*plan|approve.*plan/i.test(value)) { if (state.plan !== "Not started") onReview(); else dispatch({ type: "GUIDANCE" }); }
    else if (/summary|progress|review.*details/i.test(value)) dispatch({ type: "SUMMARY" });
    else if (/help|what can/i.test(value)) dispatch({ type: "GUIDANCE" });
    else if (state.stage === "date") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) < offsetDate(state.now.slice(0, 10), 1)) { setError("Enter a future date, like November 24, 2026, or use the date card above."); return; }
      dispatch({ type: "ANSWER", value: date.toISOString().slice(0, 10) });
    } else if (state.stage === "audience") {
      const count = Number(value.replace(/\s*students?$/i, ""));
      if (!Number.isInteger(count) || count < 1 || count > 2000) { setError("Enter the expected number of students, from 1 to 2,000."); return; }
      dispatch({ type: "ANSWER", value });
    } else if (["venue", "speaker"].includes(state.stage)) dispatch({ type: "ANSWER", value });
    else if (state.stage === "permission") {
      if (!/^(yes|no|not yet|approved|permission confirmed)/i.test(value)) { setError("Answer yes or not yet, or use the suggested answers above."); return; }
      dispatch({ type: "ANSWER", value });
    } else if (state.stage === "email" && /connect.*email/i.test(value)) dispatch({ type: "CONNECT", channel: "Email" });
    else if (state.stage === "email" && /skip|draft|local/i.test(value)) dispatch({ type: "SKIP_EMAIL" });
    else if (state.stage === "ready" && /draft|prepare.*announcement/i.test(value)) dispatch({ type: "PREPARE_ANNOUNCEMENT" });
    else dispatch({ type: "GUIDANCE" });
    setInput("");
  }
  return <div className="flex h-full min-h-0 flex-col">
    <div ref={scroll} className="soft-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"><div className="mx-auto max-w-[720px] space-y-7">
      <div role="log" aria-label="Event coordination conversation" aria-live="polite" aria-relevant="additions" className="space-y-7">{state.messages.map((message, index) => message.role === "user" ? <div key={message.id} className="message-enter flex justify-end gap-3"><div className="max-w-[85%]"><p className="mb-2 text-right text-[10px] font-medium text-muted-foreground">You <span className="ml-2 font-normal">{index === 0 ? "10:00 AM" : "Demo"}</span></p><div className="rounded-2xl rounded-tr-md border border-primary/20 bg-sage-light px-4 py-3 text-[13px] leading-relaxed text-sage-dark">{message.text}</div></div><div className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8DED2] text-[9px] font-semibold text-[#655B50]" aria-label="You">JD</div></div> : <div key={message.id} className="message-enter flex gap-3"><Mark small className="mt-0.5 h-7 w-7 rounded-lg"/><div className="min-w-0 flex-1"><div className="mb-2 flex items-center gap-2"><span className="text-[11px] font-semibold text-sage-dark">Event coordinator</span></div><p className="whitespace-pre-line text-[13px] leading-[1.8]">{message.text}</p>{message.kind === "risk" && message.id === lastRiskId && <div className="mt-4"><RiskCard state={state} dispatch={dispatch} onPlan={() => navigate("Event Plan")}/></div>}</div></div>)}</div>
      <div className="ml-10"><ConversationActions key={state.stage} state={state} dispatch={dispatch} onEdit={onEdit} onReview={onReview} onPlan={() => navigate("Event Plan")} onActivity={() => navigate("Activity")}/></div><div ref={bottom}/>
    </div></div>
    <div className="shrink-0 bg-transparent px-4 pb-4 pt-2 sm:px-8"><div className="mx-auto max-w-[720px]">
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="surface-shadow rounded-xl border border-primary/20 bg-white p-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"><label className="sr-only" htmlFor="message">Message your event coordinator</label><div className="flex items-end gap-3"><textarea id="message" value={input} onChange={e => { setInput(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} rows={2} maxLength={500} placeholder={state.stage === "date" ? "Tell me a date, or use the card above…" : "Message your event coordinator…"} className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/80 focus-visible:outline-none"/><ActionButton type="submit" aria-label="Send message" disabled={!input.trim()} className="h-8 w-8 shrink-0 rounded-lg p-0 bg-primary text-primary-foreground hover:bg-sage-dark"><ArrowUp className="h-4 w-4"/></ActionButton></div></form>{error && <p role="alert" className="mt-2 text-xs text-clay">{error}</p>}<p className="mt-2 text-center text-[9px] text-muted-foreground">You stay in control. Nothing is sent or published without an explicit decision.</p>
    </div></div>
  </div>;
}
