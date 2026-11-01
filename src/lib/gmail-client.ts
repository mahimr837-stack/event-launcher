import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Scopes required for Gmail integration
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const provider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: "consent",
});

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function initAuth(
  onSuccess: (user: User, token: string) => void,
  onFailure: () => void
) {
  return onAuthStateChanged(auth, async (user) => {
    if (user && cachedAccessToken) {
      onSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onFailure();
    }
  });
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve Google OAuth access token from sign-in.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
}

export function getCachedToken(): string | null {
  return cachedAccessToken;
}

// Base64URL string encoder (handles UTF-8 strings properly)
function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Base64URL string decoder
function decodeBase64Url(base64UrlStr: string): string {
  const base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
  headers?: Array<{ name: string; value: string }>;
}

/**
 * Strips email quote headers, previous thread history, and mobile signatures
 * so only the person's actual reply content is preserved.
 */
export function cleanEmailBody(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText.replace(/\r\n/g, "\n");

  // Remove standard email reply headers and everything after them
  // e.g. "On Mon, Oct 26, 2026 at 10:14 AM Elena <...> wrote:"
  const quoteHeaderPatterns = [
    /\n\s*On\s+.+?\s+at\s+.+?,\s*.+?\s+wrote:\s*[\s\S]*/i,
    /\n\s*On\s+.+?\s+wrote:\s*[\s\S]*/i,
    /\n\s*---+\s*Original Message\s*---+[\s\S]*/i,
    /\n\s*_{10,}[\s\S]*/,
    /\n\s*From:\s+.+?\nSent:\s+[\s\S]*/i,
    /\n\s*From:\s+.+?\nDate:\s+[\s\S]*/i,
    /\n\s*Sent from my (iPhone|iPad|Galaxy|Android|mobile device)[\s\S]*/i,
    /\n\s*Get Outlook for (iOS|Android)[\s\S]*/i,
  ];

  for (const pattern of quoteHeaderPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Strip lines that begin with ">" (quoted text lines)
  const lines = cleaned.split("\n");
  const filteredLines = lines.filter((line) => !line.trim().startsWith(">"));
  cleaned = filteredLines.join("\n");

  // Strip trailing dash signatures (e.g. "-- \n...")
  cleaned = cleaned.replace(/\n\s*--\s*\n[\s\S]*/, "");

  cleaned = cleaned.trim();

  // If stripping emptied everything (rare edge case), fall back to original trimmed text
  return cleaned.length > 0 ? cleaned : rawText.trim();
}

// Helper to extract clean plain text body from Gmail message payload
function extractBodyFromPayload(payload: GmailPayload | undefined): string {
  if (!payload) return "";

  // 1. Check direct body data
  if (payload.body?.data && payload.mimeType === "text/plain") {
    return cleanEmailBody(decodeBase64Url(payload.body.data));
  }

  // 2. Check parts recursively
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain part
    const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plainPart?.body?.data) {
      return cleanEmailBody(decodeBase64Url(plainPart.body.data));
    }

    // Try text/html part if no plain text
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = decodeBase64Url(htmlPart.body.data);
      if (typeof document !== "undefined") {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        // Strip quote elements used by Gmail and other mail clients
        const quoteElements = tempDiv.querySelectorAll(
          ".gmail_quote, .gmail_attr, .gmail_extra, blockquote, div.quote, div#appendonsend"
        );
        quoteElements.forEach((el) => el.remove());
        const extracted = tempDiv.textContent || tempDiv.innerText || "";
        return cleanEmailBody(extracted);
      } else {
        const strippedHtml = html.replace(/<[^>]*>?/gm, " ");
        return cleanEmailBody(strippedHtml);
      }
    }

    // Check nested multipart
    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return cleanEmailBody(nested);
    }
  }

  if (payload.body?.data) {
    return cleanEmailBody(decodeBase64Url(payload.body.data));
  }

  return "";
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  isFromMe: boolean;
  rfcMessageId?: string;
  timestamp: number;
}

export interface SendMessageOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyToRfcId?: string;
  agentName: string;
}

export async function sendGmailMessage(
  token: string,
  options: SendMessageOptions
): Promise<{ id: string; threadId: string }> {
  const { to, subject, body, threadId, inReplyToRfcId, agentName } = options;

  let headers = `To: ${to}\r\n`;
  headers += `Subject: ${subject}\r\n`;
  headers += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  headers += `MIME-Version: 1.0\r\n`;

  if (inReplyToRfcId) {
    headers += `In-Reply-To: ${inReplyToRfcId}\r\n`;
    headers += `References: ${inReplyToRfcId}\r\n`;
  }

  // Add signature mentioning the agent
  const emailText = `${headers}\r\n${body}\r\n\r\n—\r\n${agentName} · EventLauncher`;
  const raw = encodeBase64Url(emailText);

  const requestBody: { raw: string; threadId?: string } = { raw };
  if (threadId) {
    requestBody.threadId = threadId;
  }

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to send email (HTTP ${response.status})`
    );
  }

  return await response.json();
}

export async function fetchGmailThread(
  token: string,
  threadId: string,
  myEmail?: string
): Promise<GmailMessageSummary[]> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to fetch thread ${threadId} (HTTP ${response.status})`
    );
  }

  interface GmailRawMessage {
    id: string;
    threadId: string;
    internalDate?: string;
    snippet?: string;
    labelIds?: string[];
    payload?: GmailPayload;
  }

  const data = await response.json();
  const rawMessages: GmailRawMessage[] = data.messages || [];

  return rawMessages.map((msg) => {
    const headersList: Array<{ name: string; value: string }> = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headersList.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const from = getHeader("From");
    const to = getHeader("To");
    const subject = getHeader("Subject");
    const date = getHeader("Date");
    const rfcMessageId = getHeader("Message-ID");
    const labelIds: string[] = msg.labelIds || [];

    const isFromMe =
      labelIds.includes("SENT") ||
      (myEmail ? from.toLowerCase().includes(myEmail.toLowerCase()) : false);

    const body = extractBodyFromPayload(msg.payload) || msg.snippet || "";
    const timestamp = parseInt(msg.internalDate || "0", 10) || Date.now();

    return {
      id: msg.id,
      threadId: msg.threadId,
      from,
      to,
      subject,
      date,
      snippet: msg.snippet || "",
      body: body.trim(),
      isFromMe,
      rfcMessageId,
      timestamp,
    };
  });
}

export interface ComposeAgentEmailPayload {
  agentId: string;
  agentName: string;
  recipientEmail: string;
  recipientName: string;
  eventDetails: {
    date?: string;
    time?: string;
    venue?: string;
    speaker?: string;
    audience?: number;
    topic?: string;
  };
  conversationHistory: Array<{ sender: string; body: string }>;
  isFollowUp: boolean;
}

export async function composeAgentEmail(
  payload: ComposeAgentEmailPayload
): Promise<{ subject: string; body: string }> {
  try {
    const res = await fetch("/api/agent/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Direct /api/agent/compose fallback:", err);
  }

  // Graceful deterministic fallback if backend endpoint cannot be reached
  const { agentName, recipientName, isFollowUp, conversationHistory, eventDetails } = payload;
  if (isFollowUp) {
    const lastUserMsg = conversationHistory
      .slice()
      .reverse()
      .find((m) => m.sender !== agentName)?.body || "";
    const cleanLast = cleanEmailBody(lastUserMsg).toLowerCase();

    // Check if recipient gave a brief confirmation / acknowledgment
    const isAffirmative =
      /\b(yes|fine|ok|okay|all good|sounds good|looks good|confirmed|approved|perfect|great|no problem|thank you|thanks|agreed)\b/i.test(
        cleanLast
      );

    if (isAffirmative) {
      return {
        subject: `Re: Coordination Update — North Hall Seminar`,
        body: `Hi ${recipientName || "there"},\n\nThank you for confirming! I have noted your confirmation and marked the checklist as verified in our event dashboard.\n\nPlease let us know if anything else arises prior to the event.\n\nBest regards,\n${agentName}`,
      };
    }

    if (/\b(time|when|schedule|hour|arrival)\b/i.test(cleanLast)) {
      return {
        subject: `Re: Coordination Update — Schedule Details`,
        body: `Hi ${recipientName || "there"},\n\nThe seminar is scheduled for ${eventDetails?.date || "November 24"} at ${eventDetails?.time || "2:00 PM"} in ${eventDetails?.venue || "North Hall Auditorium"}. Doors open 30 minutes prior.\n\nBest regards,\n${agentName}`,
      };
    }

    return {
      subject: `Re: Coordination Update — North Hall Seminar`,
      body: `Hi ${recipientName || "there"},\n\nThank you for getting back to us. I have registered your update in the EventLauncher central system.\n\nPlease reach out if you need any further assistance.\n\nBest regards,\n${agentName}`,
    };
  }

  return {
    subject: `Event Coordination Checklist — North Hall Seminar`,
    body: `Dear ${recipientName || "Colleague"},\n\nI am contacting you on behalf of the EventLauncher team regarding the upcoming Career Seminar at North Hall auditorium.\n\nCould you please confirm your readiness and check if you require any specific staging or technical arrangements from our coordination team?\n\nLooking forward to your update.\n\nBest regards,\n${agentName}`,
  };
}
