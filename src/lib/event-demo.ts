export type View = "Workspace" | "Event Plan" | "Agents" | "People & Tasks" | "Activity";
export type Stage = "date" | "venue" | "speaker" | "permission" | "audience" | "email" | "plan" | "poster" | "channels" | "ready";
export type Channel = "Email" | "WhatsApp" | "Telegram";
export type TaskStatus = "Proposed" | "Pending" | "In progress" | "Blocked" | "Completed";
export type PlanStatus = "Not started" | "Proposed" | "Awaiting approval" | "Approved";
export interface EventDetails { date: string; time: string; venue: string; venueConfirmed: boolean; permission: boolean; speaker: string; audience: number }
export interface Task { id: string; title: string; owner: string; email: string; deadline: string; status: TaskStatus; note: string; venueDependent: boolean }
export interface Message { id: number; role: "user" | "assistant"; text: string; kind?: "risk" }
export interface Activity { id: number; text: string; category: "decision" | "agent" | "connection" | "task"; time: string }
export interface DemoState {
  stage: Stage; event: EventDetails; plan: PlanStatus; messages: Message[]; tasks: Task[];
  connections: Record<Channel, boolean>; activities: Activity[]; now: string;
  venueRequest: "Not started" | "Prepared" | "Awaiting approval" | "Simulated as completed";
  announcement: "Not started" | "Prepared"; invitation: "Not started" | "Prepared";
  riskShown: boolean;
}
export const DEMO_DATE = "2026-11-10T10:00:00Z";
export const SUGGESTED_DATE = "2026-11-24";
export const RISK_COMMAND = "Skip the venue approval and announce the seminar now.";
export function offsetDate(date: string, days: number): string {
  const value = new Date(`${date || SUGGESTED_DATE}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function formatDate(date: string, short = false): string {
  if (!date) return "To be decided";
  return new Intl.DateTimeFormat("en-US", { month: short ? "short" : "long", day: "numeric", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
export function taskStatus(task: Task, state: DemoState): TaskStatus | "Overdue" {
  if (task.status === "Completed" || task.status === "Proposed") return task.status;
  if (task.venueDependent && (!state.event.venueConfirmed || !state.event.permission)) return "Blocked";
  if (task.status === "Blocked") return "Blocked";
  return task.deadline < state.now.slice(0, 10) ? "Overdue" : task.status;
}
export function createInitialState(): DemoState {
  return {
    stage: "date", event: { date: "", time: "14:00", venue: "", venueConfirmed: false, permission: false, speaker: "", audience: 0 },
    plan: "Not started", connections: { Email: false, WhatsApp: false, Telegram: false }, now: DEMO_DATE,
    venueRequest: "Not started", announcement: "Not started", invitation: "Not started", riskShown: false,
    messages: [
      { id: 1, role: "user", text: "I want to organize a career seminar at my university." },
      { id: 2, role: "assistant", text: "Let’s bring it together. I’ll help you plan the seminar, coordinate your team, and keep an eye on the details.\n\nFirst, when would you like to hold it?" },
    ],
    tasks: [
      { id: "av", title: "Test the microphone & projector", owner: "Jordan Lee", email: "jordan.lee@example.edu", deadline: offsetDate(SUGGESTED_DATE, -1), status: "Proposed", note: "", venueDependent: true },
      { id: "room", title: "Prepare the seminar room", owner: "Priya Shah", email: "priya.shah@example.edu", deadline: SUGGESTED_DATE, status: "Proposed", note: "", venueDependent: true },
      { id: "guest", title: "Welcome the keynote speaker", owner: "Alex Morgan", email: "alex.morgan@example.edu", deadline: SUGGESTED_DATE, status: "Proposed", note: "", venueDependent: false },
      { id: "desk", title: "Set up the registration desk", owner: "Sam Rivera", email: "sam.rivera@example.edu", deadline: SUGGESTED_DATE, status: "Proposed", note: "", venueDependent: true },
    ],
    activities: [{ id: 1, text: "Career seminar workspace created. Sample club team available; no work assigned yet.", category: "decision", time: DEMO_DATE }],
  };
}
export type DemoAction =
  | { type: "ANSWER"; value: string; extra?: string }
  | { type: "CONNECT"; channel: Channel }
  | { type: "SKIP_EMAIL" }
  | { type: "REVIEW_PLAN" }
  | { type: "APPROVE_PLAN" }
  | { type: "EDIT_EVENT"; event: EventDetails }
  | { type: "RISK" }
  | { type: "PREPARE_ANNOUNCEMENT" }
  | { type: "PREPARE_VENUE" }
  | { type: "SUBMIT_VENUE" }
  | { type: "CONFIRM_VENUE" }
  | { type: "ASSIGN_POSTER"; owner: string; email: string; deadline: string }
  | { type: "UPDATE_TASK"; task: Task }
  | { type: "FINISH_CHANNELS" }
  | { type: "OPEN_CHANNELS" }
  | { type: "ADVANCE_CLOCK" }
  | { type: "SUMMARY" }
  | { type: "GUIDANCE"; text?: string }
  | { type: "RESET" };
function say(state: DemoState, role: Message["role"], text: string, kind?: "risk"): void {
  state.messages.push({ id: state.messages.length + 1, role, text, ...(kind ? { kind } : {}) });
}
function log(state: DemoState, text: string, category: Activity["category"]): void {
  state.activities.unshift({ id: state.activities.length + 1, text, category, time: state.now });
}
function propose(state: DemoState): void {
  state.stage = "plan"; state.plan = "Proposed";
  say(state, "assistant", `Here’s a proposed plan for ${state.event.audience} students on ${formatDate(state.event.date)}. ${state.event.venueConfirmed && state.event.permission ? "The venue and university permission are confirmed." : "Venue clearance comes first; public announcements depend on it."}\n\nReview the milestones below. I won’t prepare invitations or activate assignments until you approve.`);
  log(state, "Coordinator proposed the event plan. No consequential actions have started.", "decision");
}
export function demoReducer(previous: DemoState, action: DemoAction): DemoState {
  if (action.type === "RESET") return createInitialState();
  const state: DemoState = { ...previous, event: { ...previous.event }, messages: [...previous.messages], tasks: previous.tasks.map(t => ({ ...t })), connections: { ...previous.connections }, activities: [...previous.activities] };
  switch (action.type) {
    case "ANSWER": {
      const value = action.value.trim();
      if (!value) return previous;
      if (state.stage === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) || value <= state.now.slice(0, 10)) return previous;
        state.event.date = value; state.event.time = action.extra || "14:00";
        state.tasks.forEach(t => { t.deadline = offsetDate(value, t.id === "av" ? -1 : 0); });
        say(state, "user", `${formatDate(value)} at ${state.event.time}.`); state.stage = "venue";
        say(state, "assistant", "Great, I’ve noted the date. Have you confirmed a venue, or are you still finding a space?");
      } else if (state.stage === "venue") {
        state.event.venue = value;
        state.event.venueConfirmed = action.extra === "confirmed" || (!action.extra && /\bconfirmed\b/i.test(value) && !/not confirmed|unconfirmed|pending/i.test(value));
        say(state, "user", `${value}${action.extra ? ` — ${action.extra}.` : ""}`); state.stage = "speaker";
        say(state, "assistant", `${state.event.venueConfirmed ? "The room is confirmed. I’ll check university permission separately." : "I’ll keep the venue as unconfirmed and hold public announcements until it’s cleared."}\n\nWho would you like as the keynote speaker?`);
      } else if (state.stage === "speaker") {
        state.event.speaker = value; say(state, "user", value); state.stage = "permission";
        say(state, "assistant", "Do you already have permission from the university to run the seminar? This is separate from reserving a room.");
      } else if (state.stage === "permission") {
        state.event.permission = /^(yes|approved|permission confirmed)/i.test(value);
        say(state, "user", value); state.stage = "audience";
        say(state, "assistant", `${state.event.permission ? "University permission is noted as confirmed." : "We’ll include university permission in the venue approval milestone."}\n\nHow many students are you expecting?`);
      } else if (state.stage === "audience") {
        const count = Number(value.replace(/\s*students?$/i, ""));
        if (!Number.isInteger(count) || count < 1 || count > 2000) return previous;
        state.event.audience = count; say(state, "user", `${count} students.`); state.stage = "email";
        say(state, "assistant", `Got it — ${count} students. To prepare an invitation for ${state.event.speaker === "Not decided yet" ? "your future keynote speaker" : state.event.speaker}, email will be useful. Connect the demo email service, or keep the invitation as a local draft. No credentials are needed, and nothing will be sent.`);
      }
      break;
    }
    case "CONNECT":
      if (state.connections[action.channel]) return previous;
      state.connections[action.channel] = true;
      log(state, `${action.channel} demo-connected by you. No real account access or messages sent.`, "connection");
      if (state.stage === "email" && action.channel === "Email") {
        say(state, "user", "Connect Email for the demo.");
        say(state, "assistant", "Email is demo-connected. Any invitation will stay a prepared draft, not a sent message.");
        propose(state);
      }
      break;
    case "SKIP_EMAIL":
      if (state.stage !== "email") return previous;
      say(state, "user", "Keep the invitation as a local draft."); propose(state); break;
    case "REVIEW_PLAN":
      if (state.plan === "Proposed") { state.plan = "Awaiting approval"; log(state, "Plan reviewed; awaiting your explicit approval.", "decision"); }
      break;
    case "APPROVE_PLAN":
      if (state.plan !== "Awaiting approval") return previous;
      state.plan = "Approved"; state.stage = state.tasks.some(t => t.id === "poster") ? "channels" : "poster";
      state.invitation = "Prepared";
      state.tasks.forEach(t => { if (t.status === "Proposed") t.status = "Pending"; });
      say(state, "user", "I approve the plan.");
      say(state, "assistant", `Plan approved. I’ve activated the sample club-team assignments and prepared a speaker invitation draft. Nothing has been sent.\n\n${state.event.venueConfirmed && state.event.permission ? "Venue clearance is confirmed, so the specialists can prepare their work." : "Venue & Permissions flagged a dependency: Communications will hold publication, and Operations needs a confirmed room."}`);
      if (state.stage === "poster") say(state, "assistant", "Who will be responsible for designing the event poster? I need their name, email, and deadline to prepare an assignment and track follow-up. The demo won’t contact them.");
      log(state, "You approved the plan. Coordinator activated four simulated specialist assignments.", "decision");
      log(state, state.event.venueConfirmed && state.event.permission ? "Venue clearance confirmed; specialists can prepare their work." : "Venue → Communications & Operations: venue clearance unresolved. Publication and room-dependent work blocked.", "agent");
      log(state, "Communications & Design requested a poster owner. Speaker invitation prepared, not sent.", "agent");
      break;
    case "EDIT_EVENT":
      state.event = { ...action.event }; state.plan = "Proposed"; state.stage = "plan";
      state.venueRequest = "Not started"; state.announcement = "Not started"; state.invitation = "Not started";
      state.tasks.forEach(t => { t.deadline = offsetDate(state.event.date, t.id === "poster" ? -7 : t.id === "av" ? -1 : 0); if (t.status !== "Completed") t.status = "Proposed"; });
      say(state, "assistant", "I’ve updated the event details and revised the plan. Please review and approve it again before the specialists continue. Previous request and announcement drafts have been cleared.");
      log(state, "Event details revised. Previous plan approval withdrawn; revised plan proposed.", "decision"); break;
    case "RISK":
      say(state, "user", RISK_COMMAND); state.riskShown = true;
      say(state, "assistant", state.event.venueConfirmed && state.event.permission
        ? "Venue clearance is already confirmed. I can prepare an announcement for your review, but this demo cannot publish anything."
        : "I don’t recommend announcing the seminar yet. The venue is still unconfirmed or university permission is missing, so students could register without an approved room. Let’s prepare an unpublished draft or start venue approval instead.", "risk");
      log(state, "Coordinator checked the announce-now command against venue dependencies. No announcement published.", "decision"); break;
    case "PREPARE_ANNOUNCEMENT":
      if (state.plan !== "Approved" || state.announcement === "Prepared") return previous;
      state.announcement = "Prepared";
      say(state, "assistant", `Announcement draft prepared for ${state.event.audience} students. ${state.event.venueConfirmed && state.event.permission ? "Ready for a future publication review." : "It remains unpublished until venue clearance is confirmed."} No post was published.`);
      log(state, "Communications prepared an unpublished announcement draft. No external publication.", "agent"); break;
    case "PREPARE_VENUE":
      if (state.plan !== "Approved" || state.venueRequest !== "Not started") return previous;
      state.venueRequest = "Prepared";
      say(state, "assistant", "The venue approval request is prepared. Review the room, date, and capacity before approving a simulated submission in Event Plan.");
      log(state, "Venue & Permissions prepared a request. Your approval is required before simulated submission.", "agent"); break;
    case "SUBMIT_VENUE":
      if (state.plan !== "Approved" || state.venueRequest !== "Prepared") return previous;
      state.venueRequest = "Awaiting approval";
      say(state, "assistant", "You approved the venue request. Submission is simulated; we’re now awaiting a simulated university decision. No real request was sent.");
      log(state, "Venue request approved by you and simulated as submitted. Awaiting university approval.", "decision"); break;
    case "CONFIRM_VENUE":
      if (state.venueRequest !== "Awaiting approval" || state.plan !== "Approved") return previous;
      state.venueRequest = "Simulated as completed"; state.event.venueConfirmed = true; state.event.permission = true;
      say(state, "assistant", "University approval has been simulated. Venue clearance is now confirmed in this demo. Communications and room-dependent Operations tasks are unblocked; physical work still needs an explicit completion update.");
      log(state, "Simulated university approval received. Venue → Communications & Operations: dependencies cleared; physical tasks remain unfinished.", "agent"); break;
    case "ASSIGN_POSTER":
      if (state.plan !== "Approved" || state.stage !== "poster") return previous;
      if (!action.owner.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.email.trim()) || !action.deadline || action.deadline < state.now.slice(0, 10) || action.deadline > state.event.date) return previous;
      state.tasks.push({ id: "poster", title: "Design the event poster", owner: action.owner.trim(), email: action.email.trim(), deadline: action.deadline, status: "Pending", note: "", venueDependent: false });
      state.stage = "channels";
      say(state, "user", `Assign the poster to ${action.owner.trim()}, due ${formatDate(action.deadline)}.`);
      say(state, "assistant", `${action.owner.trim()} is assigned to the poster, due ${formatDate(action.deadline)} at 4 PM. The assignment is saved in this demo only.\n\nWhere should I prepare task assignments and deadline reminders? Choose only the channels you need.`);
      log(state, `Poster design assigned to ${action.owner.trim()}, due ${formatDate(action.deadline)} at 4 PM. Assignment saved locally, not sent.`, "task");
      log(state, "Communications received the poster-owner update. Publication still follows venue clearance.", "agent"); break;
    case "UPDATE_TASK": {
      const index = state.tasks.findIndex(t => t.id === action.task.id);
      if (index < 0 || state.plan !== "Approved" || !action.task.owner.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.task.email.trim()) || !action.task.deadline) return previous;
      if (action.task.status === "Completed" && action.task.venueDependent && (!state.event.venueConfirmed || !state.event.permission)) return previous;
      state.tasks[index] = { ...action.task, owner: action.task.owner.trim(), email: action.task.email.trim() };
      log(state, `${action.task.owner.trim()} updated “${action.task.title}” to ${taskStatus(state.tasks[index], state)}.${action.task.note ? ` Note: ${action.task.note}` : " Explicit user update; no work inferred."}`, "task"); break;
    }
    case "FINISH_CHANNELS":
      if (state.stage !== "channels") return previous;
      state.stage = "ready";
      say(state, "assistant", "Your workspace is ready. Notification previews now reflect the current assignments and blockers. Nothing is sent automatically.\n\nYou can test the venue-risk command below, review specialist updates, or explicitly update physical tasks in People & Tasks.");
      log(state, "Coordinator prepared notification previews from visible event and task data. No messages sent.", "agent"); break;
    case "OPEN_CHANNELS":
      if (state.plan !== "Approved" || !state.tasks.some(t => t.id === "poster") || state.stage === "channels") return previous;
      state.stage = "channels";
      say(state, "assistant", "Let’s review your reminder channels. Existing demo connections are remembered. Connect only the services you need; no real messages will be sent.");
      break;
    case "ADVANCE_CLOCK": {
      const poster = state.tasks.find(t => t.id === "poster");
      if (!poster || poster.status === "Completed" || poster.deadline < state.now.slice(0, 10)) return previous;
      state.now = `${offsetDate(poster.deadline, 1)}T10:00:00Z`;
      say(state, "assistant", `Demo clock advanced to ${formatDate(state.now)}. ${poster.owner}’s poster deadline has passed without a completion update. I recommend checking in or agreeing a new deadline — not marking the work complete.`);
      log(state, `Demo clock advanced. ${poster.owner}’s poster is overdue; coordinator recommends a check-in or revised deadline.`, "task"); break;
    }
    case "SUMMARY":
      say(state, "assistant", readinessSummary(state)); break;
    case "GUIDANCE":
      if (action.text) say(state, "user", action.text);
      say(state, "assistant", state.stage === "ready" ? "I can review dependencies, prepare an unpublished announcement, or show the current readiness summary. Use the suggested actions below; this is a guided simulation, not a live AI chat." : `We’re at the ${state.stage === "plan" ? "plan review" : state.stage === "poster" ? "poster assignment" : state.stage === "channels" ? "reminder preferences" : state.stage === "email" ? "email connection" : `${state.stage} question`} step. Use the inline controls or answer the current question. I’ll keep the next step focused.`); break;
  }
  return state;
}
export function readinessSummary(state: DemoState): string {
  const completed = state.tasks.filter(t => t.status === "Completed").length;
  const overdue = state.tasks.filter(t => taskStatus(t, state) === "Overdue");
  return `Career seminar · ${state.event.audience || "Audience to be confirmed"}${state.event.audience ? " students" : ""} · ${formatDate(state.event.date)}. Plan: ${state.plan.toLowerCase()}. ${completed}/${state.tasks.length} physical tasks explicitly completed. ${state.event.venueConfirmed && state.event.permission ? "Venue clearance confirmed." : "Venue clearance unresolved; publication and room-dependent tasks must wait."}${overdue.length ? ` ${overdue.map(t => `${t.owner}’s ${t.title.toLowerCase()}`).join(", ")} overdue. Recommend a check-in or revised deadline.` : " Next: review open assignments and dependencies."} All connections and activity are simulated.`;
}
export function getAgents(state: DemoState) {
  const active = state.plan === "Approved";
  const cleared = state.event.venueConfirmed && state.event.permission;
  const poster = state.tasks.find(t => t.id === "poster");
  return [
    { name: "Venue & Permissions", icon: "venue", responsibility: "Room reservation, capacity & university clearance", status: !active ? "Proposed" : cleared ? "Simulated as completed" : state.venueRequest === "Not started" ? "Blocked" : state.venueRequest, task: cleared ? "Venue clearance recorded. No physical work inferred." : `Prepare clearance for ${state.event.venue || "a suitable room"}, ${state.event.audience || 150} students.`, blocker: active && !cleared ? "University / room approval required" : "", update: cleared ? "Clearance update shared with Communications and Operations." : "Communications and Operations depend on this decision." },
    { name: "Communications & Design", icon: "design", responsibility: "Poster brief, announcement & reminder drafts", status: !active ? "Proposed" : !poster || !cleared ? "Blocked" : "Prepared", task: state.announcement === "Prepared" ? "Unpublished announcement draft prepared." : poster ? `Poster assigned to ${poster.owner}; ${taskStatus(poster, state).toLowerCase()}.` : "Prepare poster brief; request an accountable owner.", blocker: active ? !poster ? "Poster owner needed" : !cleared ? "Publication awaits venue clearance" : "" : "", update: poster ? `Owner update received. Draft deadline: ${formatDate(poster.deadline, true)}.` : "Coordinator asked to collect the poster owner’s details." },
    { name: "Registration & Guests", icon: "guests", responsibility: "Speaker invitation & student registration", status: !active ? "Proposed" : "Prepared", task: active ? `Invitation draft for ${state.event.speaker}; not sent.` : "Prepare speaker invitation and registration outline.", blocker: active && !state.connections.Email ? "Email not demo-connected; local draft only" : active && !cleared ? "Registration launch awaits venue clearance" : "", update: active ? "Guest invitation prepared. No invitation or registration link sent." : "Waiting for your plan approval." },
    { name: "Event-day Operations", icon: "operations", responsibility: "Room setup, AV testing & student reception", status: !active ? "Proposed" : !cleared ? "Blocked" : "In progress", task: `${state.tasks.filter(t => t.venueDependent && t.status === "Completed").length}/3 room-dependent tasks explicitly completed.`, blocker: active && !cleared ? "Confirmed room and permission needed" : "", update: !active ? "Sample team assignments proposed, not activated." : cleared ? "Room tasks unblocked. Waiting for people’s status updates." : "Venue blocker received. Room and equipment tasks held." },
  ];
}
