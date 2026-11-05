import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  getDocFromServer,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { auth } from "./gmail-client";
import type { Task } from "./event-demo";
import type { InformationQuestionItem } from "@/components/eventlauncher/Integration";
import type { DispatchedLiveThread } from "./dispatched-threads";

// Initialize Firebase App & Firestore with specific Database ID
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn("Firestore Operation Notice:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connectivity on initial load
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Firestore client is offline. Falling back to local cache.");
    }
    return false;
  }
}

// Run connection test silently in background
testConnection().catch(() => {});

// Active Event Data Structure
export interface EventDoc {
  id: string;
  name: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  venueConfirmed: boolean;
  permission: boolean;
  speaker: string;
  audience: number;
  budget: string;
  status: string;
  updatedAt?: string;
}

export const DEFAULT_ACTIVE_EVENT: EventDoc = {
  id: "career-seminar",
  name: "Annual Career & Tech Seminar",
  category: "Computer Science & Engineering",
  date: "2026-11-24",
  time: "14:00",
  venue: "North Hall Auditorium (Capacity 250)",
  venueConfirmed: true,
  permission: true,
  speaker: "Dr. Maya Chen (Principal AI Researcher)",
  audience: 200,
  budget: "$3,500 approved",
  status: "In Planning",
  updatedAt: new Date().toISOString(),
};

/**
 * Fetch or bootstrap the primary active event document.
 */
export async function fetchActiveEvent(): Promise<EventDoc> {
  const eventDocRef = doc(db, "events", DEFAULT_ACTIVE_EVENT.id);
  try {
    const snap = await getDoc(eventDocRef);
    if (snap.exists()) {
      return snap.data() as EventDoc;
    }
    // Seed default if doc does not exist
    await setDoc(eventDocRef, DEFAULT_ACTIVE_EVENT);
    return DEFAULT_ACTIVE_EVENT;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.GET, `events/${DEFAULT_ACTIVE_EVENT.id}`);
    } catch {
      return DEFAULT_ACTIVE_EVENT;
    }
  }
}

/**
 * Update the primary active event document.
 */
export async function saveActiveEvent(updates: Partial<EventDoc>): Promise<void> {
  const eventDocRef = doc(db, "events", DEFAULT_ACTIVE_EVENT.id);
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(eventDocRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `events/${DEFAULT_ACTIVE_EVENT.id}`);
  }
}

/**
 * Subscribe to real-time changes on the active event document.
 */
export function subscribeActiveEvent(callback: (event: EventDoc) => void): () => void {
  const eventDocRef = doc(db, "events", DEFAULT_ACTIVE_EVENT.id);
  return onSnapshot(
    eventDocRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as EventDoc);
      } else {
        // Doc not created yet, seed it
        setDoc(eventDocRef, DEFAULT_ACTIVE_EVENT).catch(() => {});
        callback(DEFAULT_ACTIVE_EVENT);
      }
    },
    (err) => {
      console.warn("Event subscription fallback:", err.message);
      callback(DEFAULT_ACTIVE_EVENT);
    }
  );
}

// ==========================================
// TASKS PERSISTENCE
// ==========================================

export async function fetchTasks(): Promise<Task[]> {
  try {
    const snap = await getDocs(collection(db, "tasks"));
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as Task);
    }
    return [];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "tasks");
  }
}

export async function saveTask(task: Task): Promise<void> {
  const taskRef = doc(db, "tasks", task.id);
  try {
    await setDoc(taskRef, task, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const taskRef = doc(db, "tasks", taskId);
  try {
    await deleteDoc(taskRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export function subscribeTasks(
  callback: (tasks: Task[]) => void,
  initialSeed?: Task[]
): () => void {
  return onSnapshot(
    collection(db, "tasks"),
    (snap) => {
      if (snap.empty && initialSeed && initialSeed.length > 0) {
        // Seed default tasks
        initialSeed.forEach((t) => {
          setDoc(doc(db, "tasks", t.id), t).catch(() => {});
        });
        callback(initialSeed);
      } else {
        const tasks = snap.docs.map((d) => d.data() as Task);
        callback(tasks);
      }
    },
    (err) => {
      console.warn("Tasks subscription fallback:", err.message);
      if (initialSeed) callback(initialSeed);
    }
  );
}

// ==========================================
// STAKEHOLDER INQUIRIES PERSISTENCE
// ==========================================

export async function fetchStakeholderInquiries(): Promise<InformationQuestionItem[]> {
  try {
    const snap = await getDocs(collection(db, "stakeholder_inquiries"));
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as InformationQuestionItem);
    }
    return [];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "stakeholder_inquiries");
  }
}

export async function saveStakeholderInquiry(
  item: InformationQuestionItem & { draftSubject?: string; draftBody?: string }
): Promise<void> {
  const inquiryRef = doc(db, "stakeholder_inquiries", item.id);
  try {
    await setDoc(inquiryRef, item, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stakeholder_inquiries/${item.id}`);
  }
}

export async function deleteStakeholderInquiry(inquiryId: string): Promise<void> {
  const inquiryRef = doc(db, "stakeholder_inquiries", inquiryId);
  try {
    await deleteDoc(inquiryRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `stakeholder_inquiries/${inquiryId}`);
  }
}

export function subscribeStakeholderInquiries(
  callback: (items: (InformationQuestionItem & { draftSubject?: string; draftBody?: string })[]) => void,
  initialSeed?: InformationQuestionItem[]
): () => void {
  return onSnapshot(
    collection(db, "stakeholder_inquiries"),
    (snap) => {
      if (snap.empty && initialSeed && initialSeed.length > 0) {
        initialSeed.forEach((item) => {
          setDoc(doc(db, "stakeholder_inquiries", item.id), item).catch(() => {});
        });
        callback(initialSeed);
      } else {
        const items = snap.docs.map(
          (d) => d.data() as InformationQuestionItem & { draftSubject?: string; draftBody?: string }
        );
        callback(items);
      }
    },
    (err) => {
      console.warn("Inquiries subscription fallback:", err.message);
      if (initialSeed) callback(initialSeed);
    }
  );
}

// ==========================================
// DISPATCHED THREADS PERSISTENCE
// ==========================================

export async function fetchDispatchedThreads(): Promise<DispatchedLiveThread[]> {
  try {
    const snap = await getDocs(collection(db, "dispatched_threads"));
    if (!snap.empty) {
      return snap.docs
        .map((d) => d.data() as DispatchedLiveThread)
        .sort((a, b) => b.dispatchedAt - a.dispatchedAt);
    }
    return [];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "dispatched_threads");
  }
}

export async function saveLiveThreadToFirestore(thread: DispatchedLiveThread): Promise<void> {
  const threadRef = doc(db, "dispatched_threads", thread.id);
  try {
    await setDoc(threadRef, thread, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `dispatched_threads/${thread.id}`);
  }
}

export function subscribeDispatchedThreads(
  callback: (threads: DispatchedLiveThread[]) => void
): () => void {
  return onSnapshot(
    collection(db, "dispatched_threads"),
    (snap) => {
      const threads = snap.docs
        .map((d) => d.data() as DispatchedLiveThread)
        .sort((a, b) => b.dispatchedAt - a.dispatchedAt);
      callback(threads);
    },
    (err) => {
      console.warn("Dispatched threads subscription fallback:", err.message);
    }
  );
}

// ==========================================
// ADMIN-ONLY PERSISTENCE (mahimr837@gmail.com)
// ==========================================

export interface AdminSettingDoc {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AdminAuditLogDoc {
  id: string;
  action: string;
  adminEmail: string;
  details: string;
  timestamp: string;
}

export async function fetchAdminSettings(): Promise<AdminSettingDoc[]> {
  try {
    const snap = await getDocs(collection(db, "admin_settings"));
    return snap.docs.map((d) => d.data() as AdminSettingDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "admin_settings");
  }
}

export async function saveAdminSetting(key: string, value: string, adminEmail: string): Promise<void> {
  const settingRef = doc(db, "admin_settings", key);
  const data: AdminSettingDoc = {
    id: key,
    key,
    value,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };
  try {
    await setDoc(settingRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admin_settings/${key}`);
  }
}

export async function fetchAdminAuditLogs(): Promise<AdminAuditLogDoc[]> {
  try {
    const snap = await getDocs(collection(db, "admin_audit_logs"));
    return snap.docs
      .map((d) => d.data() as AdminAuditLogDoc)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "admin_audit_logs");
  }
}

export async function logAdminAction(action: string, details: string, adminEmail: string): Promise<void> {
  const logId = `log-${Date.now()}`;
  const logRef = doc(db, "admin_audit_logs", logId);
  const payload: AdminAuditLogDoc = {
    id: logId,
    action,
    adminEmail,
    details,
    timestamp: new Date().toISOString(),
  };
  try {
    await setDoc(logRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admin_audit_logs/${logId}`);
  }
}

// ==========================================
// KNOWLEDGE BASE PERSISTENCE
// ==========================================

export interface KnowledgeBaseEntryDoc {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_KNOWLEDGE_BASE_ENTRIES: KnowledgeBaseEntryDoc[] = [
  {
    id: "kb-venue-clearance",
    title: "University Campus Venue & Noise Clearance Protocols",
    content: "1. Room Reservation Timing: North Hall Auditorium and Student Center Ballrooms require written clearance submitted at least 14 days in advance to Student Affairs and Campus Facilities.\n2. Fire Safety & Capacity: Auditorium maximum occupancy is strictly 250 seated. Aisles, emergency exit paths, and stage access stairs must remain clear of loose cabling and equipment cases at all times.\n3. Noise Regulations: Amplified sound, PA speakers, and live musical accompaniment are permitted between 12:00 PM - 10:00 PM on weekdays. Sound tests must not exceed 85 dBA measured at the main doors.\n4. Staging & Accessibility: Wheelchair ramps to the stage must be inspected 2 hours prior to doors opening. ADA compliant seating rows (Rows A & B) must be reserved until 15 minutes before the keynote.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kb-speaker-hospitality",
    title: "Keynote Speaker & Guest Hospitality Best Practices",
    content: "1. Technical Rider Inquiries: Contact the keynote speaker's coordinator 10 business days before the event to obtain their presentation slide aspect ratio (prefer 16:9), microphone preference (wireless lapel vs. handheld), and stage monitor requirements.\n2. Campus Green Room: Reserve North Hall Room 102 as the speaker prep room. Provide still bottled water, warm tea, notebook, and private Wi-Fi network access.\n3. Arrival Liaison: Assign one designated Student Ambassador to greet the guest at the campus visitor parking kiosk and escort them directly through the stage door.\n4. Consent & Recording: Obtain signed university video recording releases before the session begins if live streaming or archiving to YouTube.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kb-budget-procurement",
    title: "Student Organization Budget & Vendor Procurement Workflow",
    content: "1. Approved Budget Categories: All departmental allocations require itemized line items: Venue Custodial Fee ($250), Print Shop Posters ($180), Speaker Honorarium/Travel ($1,200), Audio/Visual Technician ($400), and Reception Catering ($800).\n2. Payment Authorization: Submit purchase orders (POs) through the Campus Finance Portal. Reimbursement receipts must show proof of tax-exempt status (University 501(c)(3) Form ST-1).\n3. Vendor Invoicing: External vendors (AV technicians, specialty caterers) must submit W-9 tax forms and direct deposit authorization 7 days prior to check issuance.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function fetchKnowledgeBaseEntries(): Promise<KnowledgeBaseEntryDoc[]> {
  try {
    const snap = await getDocs(collection(db, "knowledge_base"));
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as KnowledgeBaseEntryDoc);
    }
    return DEFAULT_KNOWLEDGE_BASE_ENTRIES;
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, "knowledge_base");
    } catch {
      return DEFAULT_KNOWLEDGE_BASE_ENTRIES;
    }
  }
}

export async function saveKnowledgeBaseEntry(entry: {
  id?: string;
  title: string;
  content: string;
}): Promise<KnowledgeBaseEntryDoc> {
  const entryId = entry.id && entry.id.trim() ? entry.id.trim() : `kb-${Date.now()}`;
  const entryRef = doc(db, "knowledge_base", entryId);
  const now = new Date().toISOString();
  const payload: KnowledgeBaseEntryDoc = {
    id: entryId,
    title: entry.title.trim(),
    content: entry.content.trim(),
    updatedAt: now,
    createdAt: now,
  };
  try {
    await setDoc(entryRef, payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `knowledge_base/${entryId}`);
  }
}

export async function deleteKnowledgeBaseEntry(id: string): Promise<void> {
  const entryRef = doc(db, "knowledge_base", id);
  try {
    await deleteDoc(entryRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `knowledge_base/${id}`);
  }
}

export function subscribeKnowledgeBase(
  callback: (entries: KnowledgeBaseEntryDoc[]) => void
): () => void {
  return onSnapshot(
    collection(db, "knowledge_base"),
    (snap) => {
      if (snap.empty) {
        DEFAULT_KNOWLEDGE_BASE_ENTRIES.forEach((kb) => {
          setDoc(doc(db, "knowledge_base", kb.id), kb).catch(() => {});
        });
        callback(DEFAULT_KNOWLEDGE_BASE_ENTRIES);
      } else {
        const entries = snap.docs.map((d) => d.data() as KnowledgeBaseEntryDoc);
        callback(entries);
      }
    },
    (err) => {
      console.warn("Knowledge base subscription notice:", err.message);
      callback(DEFAULT_KNOWLEDGE_BASE_ENTRIES);
    }
  );
}

// =========================================================================
// AGENT CREATION REAL-TIME EVENTS
// =========================================================================
export interface AgentCreationEventDoc {
  id: string;
  agentId?: string;
  agentName: string;
  domain?: string;
  status: "creating" | "created";
  stateText: "Creating agent..." | "Agent created.";
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_AGENT_CREATION_EVENT: AgentCreationEventDoc = {
  id: "latest",
  agentId: "operations",
  agentName: "Operations Agent",
  domain: "AV & Technical Operations",
  status: "created",
  stateText: "Agent created.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Fetch the latest real-time agent creation event recorded by the Lead Coordinator.
 */
export async function fetchLatestAgentCreationEvent(): Promise<AgentCreationEventDoc> {
  const eventRef = doc(db, "agent_creation_events", "latest");
  try {
    const snap = await getDoc(eventRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.agentName && data.status) {
        return data as AgentCreationEventDoc;
      }
    }
    const res = await fetch("/api/agent/latest-creation-event").catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.status) return data;
    }
    return DEFAULT_AGENT_CREATION_EVENT;
  } catch (_err) {
    return DEFAULT_AGENT_CREATION_EVENT;
  }
}

/**
 * Subscribe to real-time agent creation events from the backend Firestore stream.
 */
export function subscribeLatestAgentCreationEvent(
  callback: (event: AgentCreationEventDoc) => void
): () => void {
  const eventRef = doc(db, "agent_creation_events", "latest");
  return onSnapshot(
    eventRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.agentName && (data.status === "creating" || data.status === "created")) {
          callback(data as AgentCreationEventDoc);
        }
      }
    },
    (err) => {
      console.warn("Agent creation event snapshot notice:", err.message);
      fetchLatestAgentCreationEvent().then(callback);
    }
  );
}

/**
 * Trigger real backend agent creation.
 */
export async function triggerBackendAgentCreation(
  agentName: string,
  domain: string = "Specialized Event Operations"
): Promise<{ success: boolean; event: AgentCreationEventDoc }> {
  const res = await fetch("/api/agent/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName, domain }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create agent: HTTP ${res.status}`);
  }
  return await res.json();
}
