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
// Use select_account so user can easily choose their account without repetitive re-consent issues
provider.setCustomParameters({
  prompt: "select_account",
});

const TOKEN_STORAGE_KEY = "eventlauncher_gmail_oauth_token";

export function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // OAuth access tokens are valid for up to 3 hours with leeway
    if (parsed.token && Date.now() - (parsed.savedAt || 0) < 3 * 3600 * 1000) {
      return parsed.token;
    }
  } catch (err) {
    console.debug("Failed to read stored OAuth token:", err);
  }
  return null;
}

export function saveStoredToken(token: string, user: User) {
  try {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({
        token,
        savedAt: Date.now(),
        email: user.email,
        displayName: user.displayName,
      })
    );
  } catch (err) {
    console.debug("Failed to persist OAuth token:", err);
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (err) {
    console.debug("Failed to clear OAuth token:", err);
  }
}

// In-memory access token cache initialized from storage if available
let cachedAccessToken: string | null = getStoredToken();
let isSigningIn = false;

export function initAuth(
  onSuccess: (user: User, token: string | null) => void,
  onFailure: () => void
) {
  return onAuthStateChanged(auth, async (user) => {
    const token = cachedAccessToken || getStoredToken();
    if (user) {
      if (token) {
        cachedAccessToken = token;
      }
      onSuccess(user, token);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      clearStoredToken();
      onFailure();
    }
  });
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;

    // Open popup for Google account authentication
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve Google OAuth access token from sign-in. Please ensure third-party cookies and popups are permitted.");
    }
    cachedAccessToken = credential.accessToken;
    saveStoredToken(cachedAccessToken, result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj?.code === "auth/popup-blocked") {
      throw new Error(
        "Popup was blocked by your browser. Please allow popups for this site (check the address bar icon) and click again to connect."
      );
    }
    if (errorObj?.code === "auth/popup-closed-by-user") {
      throw new Error(
        "Sign-in window was closed before finishing. Click Sign in with Email to try again."
      );
    }
    if (errorObj?.code === "auth/cancelled-popup-request") {
      throw new Error("Sign-in popup was cancelled. Please click Sign in with Email again.");
    }
    if (errorObj?.code === "auth/network-request-failed") {
      throw new Error("Network error during sign-in. Please check your connection and try again.");
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
  clearStoredToken();
}

export function getCachedToken(): string | null {
  return cachedAccessToken || getStoredToken();
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

export interface SearchThreadOptions {
  threadId?: string;
  recipientEmail?: string;
  subject?: string;
  userEmail?: string;
}

export async function searchAndFetchGmailThread(
  token: string,
  options: SearchThreadOptions
): Promise<{ threadId: string; messages: GmailMessageSummary[] } | null> {
  const { threadId, recipientEmail, subject, userEmail } = options;

  // 1. If threadId is already available, fetch directly
  if (threadId) {
    try {
      const messages = await fetchGmailThread(token, threadId, userEmail);
      if (messages.length > 0) {
        return { threadId, messages };
      }
    } catch (e) {
      console.warn("Direct thread fetch failed, attempting query search:", e);
    }
  }

  // 2. Query search by recipient or subject
  const queryTerms: string[] = [];
  if (recipientEmail) {
    const cleanEmail = recipientEmail.replace(/[<>]/g, "").trim();
    if (cleanEmail.includes("@")) {
      queryTerms.push(`(from:${cleanEmail} OR to:${cleanEmail})`);
    }
  }
  if (subject) {
    const cleanSub = subject.replace(/^(Re|Fwd):\s*/i, "").slice(0, 35).replace(/["']/g, "").trim();
    if (cleanSub) {
      queryTerms.push(`subject:"${cleanSub}"`);
    }
  }

  const q = queryTerms.join(" ");
  if (!q) return null;

  try {
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const threads = searchData.threads || [];
    if (threads.length === 0) return null;

    const matchedThreadId = threads[0].id;
    const messages = await fetchGmailThread(token, matchedThreadId, userEmail);
    return { threadId: matchedThreadId, messages };
  } catch (err) {
    console.warn("searchAndFetchGmailThread search error:", err);
    return null;
  }
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
