import { saveLiveThreadToFirestore, fetchDispatchedThreads } from "./firestore-service";

export interface DispatchedLiveThread {
  id: string;
  agentId: "operations" | "guests" | "design" | "venue";
  agentName: string;
  agentEmail: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  topic: string;
  channel: "Email" | "Telegram" | "WhatsApp";
  threadId?: string;
  messages: Array<{
    id: string;
    sender: "agent" | "recipient";
    senderName: string;
    time: string;
    body: string;
    isAI?: boolean;
  }>;
  dispatchedAt: number;
}

const STORAGE_KEY = "eventlauncher_dispatched_threads";

export function getDispatchedThreads(): DispatchedLiveThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDispatchedThread(thread: DispatchedLiveThread): void {
  try {
    const current = getDispatchedThreads();
    const updated = [
      thread,
      ...current.filter((t) => t.id !== thread.id && t.recipientEmail !== thread.recipientEmail),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("eventlauncher_threads_updated"));

    // Async persist to Firestore cloud database
    saveLiveThreadToFirestore(thread).catch((e) => {
      console.warn("Firestore thread sync notice:", e);
    });
  } catch (err) {
    console.error("Failed to save dispatched thread:", err);
  }
}

/**
 * Hydrate local cache from Firestore on startup
 */
export async function syncThreadsFromFirestore(): Promise<DispatchedLiveThread[]> {
  try {
    const cloudThreads = await fetchDispatchedThreads();
    if (cloudThreads && cloudThreads.length > 0) {
      const local = getDispatchedThreads();
      // Merge unique
      const mergedMap = new Map<string, DispatchedLiveThread>();
      local.forEach((t) => mergedMap.set(t.id, t));
      cloudThreads.forEach((t) => mergedMap.set(t.id, t));
      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => b.dispatchedAt - a.dispatchedAt
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event("eventlauncher_threads_updated"));
      return merged;
    }
  } catch (err) {
    console.debug("Hydrating threads notice:", err);
  }
  return getDispatchedThreads();
}
