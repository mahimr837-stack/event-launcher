// Telegram client for EventLauncher real AI conversation demo
// Interacts securely through server-side /api/telegram proxy to protect the bot token

export interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
}

export interface TelegramStatusResponse {
  ok: boolean;
  configured: boolean;
  bot?: TelegramBotInfo;
  error?: string;
}

export interface TelegramChatSummary {
  chatId: string;
  username?: string;
  firstName?: string;
  lastMessageText?: string;
  date: number;
}

export interface TelegramMessageItem {
  id: string;
  messageId: number;
  sender: "agent" | "recipient";
  senderName: string;
  senderIdentifier: string;
  time: string;
  body: string;
  isAI?: boolean;
  timestamp: number;
}

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  try {
    const res = await fetch("/api/telegram/status");
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      configured: false,
      error: err instanceof Error ? err.message : "Failed to reach Telegram status API",
    };
  }
}

export async function fetchTelegramRecentChats(): Promise<TelegramChatSummary[]> {
  try {
    const res = await fetch("/api/telegram/recent-chats");
    if (!res.ok) return [];
    const data = await res.json();
    return data.chats || [];
  } catch (err) {
    console.warn("Failed to fetch recent Telegram chats:", err);
    return [];
  }
}

export async function sendTelegramMessage(params: {
  chatId: string;
  text: string;
  agentName: string;
  replyToMessageId?: number;
}): Promise<{ ok: boolean; messageId: number; date: number; error?: string }> {
  const fullText = `${params.text}\n\n—\n${params.agentName} · EventLauncher`;
  const res = await fetch("/api/telegram/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: params.chatId,
      text: fullText,
      replyToMessageId: params.replyToMessageId,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Telegram send failed (HTTP ${res.status})`);
  }

  return data;
}

export async function fetchTelegramUpdates(params: {
  chatId: string;
  sinceMessageId?: number;
}): Promise<TelegramMessageItem[]> {
  const query = new URLSearchParams({ chatId: params.chatId });
  if (params.sinceMessageId) {
    query.set("sinceMessageId", params.sinceMessageId.toString());
  }

  const res = await fetch(`/api/telegram/updates?${query.toString()}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch Telegram updates (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.messages || [];
}

export type RecipientInputMode = "auto" | "username" | "phone" | "chat_id";
export type RecipientDetectedType = "chat_id" | "username" | "phone" | "unknown";

export interface RecipientResolutionResult {
  ok: boolean;
  resolved: boolean;
  type: RecipientDetectedType;
  chatId?: string;
  name?: string;
  username?: string;
  phone?: string;
  verified?: boolean;
  worksImmediately?: boolean;
  message?: string;
  error?: string;
  needsBotStart?: boolean;
  botUsername?: string;
  actionUrl?: string;
}

export async function resolveTelegramRecipient(params: {
  input: string;
  mode?: RecipientInputMode;
}): Promise<RecipientResolutionResult> {
  try {
    const res = await fetch("/api/telegram/resolve-recipient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: params.input,
        mode: params.mode || "auto",
      }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    return {
      ok: false,
      resolved: false,
      type: "unknown",
      error: err instanceof Error ? err.message : "Failed to connect to Telegram resolution service",
    };
  }
}

