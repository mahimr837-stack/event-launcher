import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTelegramToken(): string {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN.trim();
  if (process.env.VITE_TELEGRAM_BOT_TOKEN) return process.env.VITE_TELEGRAM_BOT_TOKEN.trim();
  if (process.env.TELEGRAM_TOKEN) return process.env.TELEGRAM_TOKEN.trim();
  try {
    if (fs.existsSync("/app/.dev.env.json")) {
      const devEnv = JSON.parse(fs.readFileSync("/app/.dev.env.json", "utf8"));
      if (devEnv.TELEGRAM_BOT_TOKEN) return String(devEnv.TELEGRAM_BOT_TOKEN).trim();
    }
  } catch (_e) {
    // Optional fallback file, ignore if unavailable
  }
  try {
    if (fs.existsSync(path.resolve(__dirname, ".env"))) {
      const envContent = fs.readFileSync(path.resolve(__dirname, ".env"), "utf8");
      const match = envContent.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
      if (match && match[1]) return match[1].trim();
    }
  } catch (_e) {
    // Optional .env file, ignore if unavailable
  }
  try {
    if (fs.existsSync("/etc/secrets/TELEGRAM_BOT_TOKEN")) {
      return fs.readFileSync("/etc/secrets/TELEGRAM_BOT_TOKEN", "utf8").trim();
    }
    if (fs.existsSync("/secrets/TELEGRAM_BOT_TOKEN")) {
      return fs.readFileSync("/secrets/TELEGRAM_BOT_TOKEN", "utf8").trim();
    }
  } catch (_e) {
    // Optional secret paths, ignore if unavailable
  }
  return "";
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const ai = geminiApiKey
    ? new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

function cleanEmailBody(rawText: string): string {
  if (!rawText) return "";
  let cleaned = rawText.replace(/\r\n/g, "\n");

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

  const lines = cleaned.split("\n");
  const filteredLines = lines.filter((line) => !line.trim().startsWith(">"));
  cleaned = filteredLines.join("\n");
  cleaned = cleaned.replace(/\n\s*--\s*\n[\s\S]*/, "");
  cleaned = cleaned.trim();
  return cleaned.length > 0 ? cleaned : rawText.trim();
}

  app.post("/api/agent/compose", async (req, res) => {
    try {
      const {
        agentId,
        agentName,
        recipientEmail,
        recipientName,
        eventDetails,
        conversationHistory,
        isFollowUp,
      } = req.body;

      if (!recipientEmail) {
        return res.status(400).json({ error: "recipientEmail is required" });
      }

      // Extract and clean latest recipient response if follow up
      let latestRecipientText = "";
      if (isFollowUp && Array.isArray(conversationHistory)) {
        const lastMsg = conversationHistory
          .slice()
          .reverse()
          .find((m: { sender?: string; body?: string }) => m.sender !== agentName);
        if (lastMsg?.body) {
          latestRecipientText = cleanEmailBody(lastMsg.body);
        }
      }

      // 1. Try Gemini API with strict anti-hallucination prompt and 3.5s timeout
      if (ai) {
        try {
          const systemPrompt = `You are the ${agentName || "EventLauncher AI Agent"} in the EventLauncher university coordination app.
Event context:
- Event: Career Seminar on ${eventDetails?.date || "November 24, 2026"} at ${eventDetails?.time || "14:00 (2:00 PM)"}
- Venue: ${eventDetails?.venue || "North Hall Auditorium"}
- Keynote Speaker: ${eventDetails?.speaker || "Dr. Maya Chen"}

CRITICAL RULES:
- Focus STRICTLY on what the recipient actually said.
- If the recipient simply agreed or said something brief (e.g. "yes, this is fine", "looks good", "confirmed", "sounds good", "okay"): ONLY acknowledge their confirmation cleanly in 1-2 polite sentences.
- NEVER invent, assume, or promise new tasks, staff dispatching (such as catering, water service, technical crews), arrival windows, or equipment that were not specifically requested.
- Return ONLY valid JSON with keys "subject" and "body". No markdown wrapping.`;

          const userPrompt = isFollowUp
            ? `The recipient (${recipientName || recipientEmail}) sent this reply:
"${latestRecipientText || "Yes, this is fine"}"

Task:
Compose a concise, polite follow-up from ${agentName}.
If they simply confirmed/agreed, acknowledge their confirmation briefly. Do NOT add extra unrequested staff or equipment.
Return valid JSON with "subject" (e.g. "Re: ...") and "body".`
            : `Compose an initial outreach email from ${agentName} to ${recipientName || "Colleague"} (${recipientEmail}) regarding the seminar.
Keep it concise, collegiate, and under 100 words.
Return valid JSON with "subject" and "body".`;

          // Add 3.5s abort timeout so endpoint never hangs
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              abortSignal: controller.signal,
            },
          });
          clearTimeout(timer);

          const text = response.text || "{}";
          const parsed = JSON.parse(text);
          if (parsed.subject && parsed.body) {
            return res.json({
              subject: parsed.subject,
              body: parsed.body,
            });
          }
        } catch (genError) {
          // Log and continue to smart intent-based generator below
          console.log("Using smart intent-based response generator:", genError instanceof Error ? genError.message : genError);
        }
      }

      // 2. High-precision contextual intent generator (No fabricated catering/staff/riders)
      let responseSubject = "";
      let responseBody = "";

      if (isFollowUp) {
        const lowerText = latestRecipientText.toLowerCase();

        // Check for affirmative confirmation: "yes", "fine", "ok", "all good", "confirmed", etc.
        const isAffirmative =
          /\b(yes|fine|ok|okay|all good|sounds good|looks good|confirmed|approved|perfect|great|no problem|thank you|thanks|agreed|that works|works for me)\b/i.test(
            lowerText
          ) || lowerText.length < 25;

        // Check for time/schedule questions
        const isTimeQuery = /\b(time|when|schedule|timing|hour|what time|arrival|arrive)\b/i.test(lowerText);

        // Check for venue/location questions
        const isVenueQuery = /\b(where|venue|location|room|auditorium|building|hall|directions|parking)\b/i.test(lowerText);

        // Check for conflict or decline
        const isConflict = /\b(reschedule|change|cannot|can't|delay|postpone|cancel|conflict|unable)\b/i.test(lowerText);

        if (isAffirmative && !isTimeQuery && !isVenueQuery && !isConflict) {
          responseSubject = `Re: Coordination Update — North Hall Seminar`;
          responseBody = `Hi ${recipientName || "there"},\n\nThank you for confirming! I have noted your confirmation and marked the checklist as verified in our event dashboard.\n\nPlease feel free to reach out if anything else arises prior to event day.\n\nBest regards,\n${agentName}`;
        } else if (isTimeQuery) {
          responseSubject = `Re: Event Schedule & Timing — North Hall Seminar`;
          responseBody = `Hi ${recipientName || "there"},\n\nThe seminar is scheduled for ${eventDetails?.date || "November 24, 2026"} at ${eventDetails?.time || "2:00 PM"} in ${eventDetails?.venue || "North Hall Auditorium"}. Doors open 30 minutes prior.\n\nPlease let us know if you have any scheduling questions.\n\nBest regards,\n${agentName}`;
        } else if (isVenueQuery) {
          responseSubject = `Re: Venue Details — North Hall Seminar`;
          responseBody = `Hi ${recipientName || "there"},\n\nThe event takes place at ${eventDetails?.venue || "North Hall Auditorium"}. Main lobby and stage access will be open for attendees and staff.\n\nBest regards,\n${agentName}`;
        } else if (isConflict) {
          responseSubject = `Re: Coordination Update — North Hall Seminar`;
          responseBody = `Hi ${recipientName || "there"},\n\nThank you for letting us know. I have notified our event coordination team to look into alternative arrangements.\n\nWe will follow up with updated options shortly.\n\nBest regards,\n${agentName}`;
        } else {
          responseSubject = `Re: Coordination Update — North Hall Seminar`;
          responseBody = `Hi ${recipientName || "there"},\n\nThank you for the update! I have noted this in our EventLauncher coordination log and updated the team status.\n\nPlease reach out if any other requirements come up.\n\nBest regards,\n${agentName}`;
        }
      } else {
        // Initial outreach email
        if (agentId === "guests") {
          responseSubject = `Keynote Staging & Details — Dr. Maya Chen`;
          responseBody = `Hello ${recipientName || "Elena"},\n\nWe are preparing the staging for Dr. Chen's upcoming seminar at ${eventDetails?.venue || "North Hall"} on ${eventDetails?.date || "November 24"}.\n\nPlease let us know if you have any specific presentation preferences or equipment requirements.\n\nBest regards,\n${agentName}`;
        } else if (agentId === "operations") {
          responseSubject = `Sound System & PA Testing — North Hall Setup`;
          responseBody = `Hi ${recipientName || "Jordan"},\n\nFollowing up on our AV readiness checklist for North Hall: could you please confirm if the main PA speakers and wireless microphones are ready for testing?\n\nPlease advise if any staging adjustments are needed before sound check.\n\nBest regards,\n${agentName}`;
        } else if (agentId === "design") {
          responseSubject = `Print Order: Seminar Posters & Signage`;
          responseBody = `Good morning ${recipientName || "Print Desk"},\n\nTransmitting our seminar signage order for the University Career Seminar on ${eventDetails?.date || "November 24"}.\n\nPlease confirm when pre-flight checks are complete.\n\nBest regards,\n${agentName}`;
        } else {
          responseSubject = `Room Reservation Request: North Hall`;
          responseBody = `Dear ${recipientName || "Facilities Coordinator"},\n\nSubmitting reservation confirmation for North Hall for the Career Development Club Seminar on ${eventDetails?.date || "November 24"}.\n\nPlease confirm room access and readiness.\n\nBest regards,\n${agentName}`;
        }
      }

      return res.json({ subject: responseSubject, body: responseBody });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate email";
      console.error("Error generating agent email:", err);
      return res.status(500).json({ error: errorMessage });
    }
  });

  // =========================================================================
  // TELEGRAM BOT API ENDPOINTS
  // =========================================================================

  // 1. Check Telegram Bot Status and Verify Connection
  app.get("/api/telegram/status", async (_req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.json({
        ok: false,
        configured: false,
        error: "TELEGRAM_BOT_TOKEN secret is not set in the server environment.",
      });
    }

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await tgRes.json()) as {
        ok: boolean;
        description?: string;
        result?: { id: number; username: string; first_name: string };
      };

      if (data.ok && data.result) {
        return res.json({
          ok: true,
          configured: true,
          bot: {
            id: data.result.id,
            username: data.result.username,
            firstName: data.result.first_name,
          },
        });
      }

      return res.json({
        ok: false,
        configured: true,
        error: data.description || "Telegram API rejected the bot token.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Telegram Bot API";
      return res.status(502).json({
        ok: false,
        configured: true,
        error: msg,
      });
    }
  });

  // In-memory cache of Telegram users who contacted the bot
  interface TelegramKnownUser {
    chatId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phoneNumber?: string;
    lastSeen: number;
    lastMessageText?: string;
  }
  const knownTelegramUsers = new Map<string, TelegramKnownUser>();

  // Synchronize updates from Telegram Bot API to keep knownTelegramUsers up to date
  async function syncTelegramUsers(token: string): Promise<TelegramKnownUser[]> {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
      const data = (await tgRes.json()) as {
        ok: boolean;
        description?: string;
        result?: Array<{
          message?: {
            message_id: number;
            chat?: { id: number; username?: string; first_name?: string; title?: string };
            from?: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean };
            text?: string;
            date?: number;
            contact?: { phone_number: string; first_name?: string; last_name?: string; user_id?: number };
          };
        }>;
      };

      if (!data.ok || !data.result) return Array.from(knownTelegramUsers.values());

      for (const update of data.result) {
        const msg = update.message;
        if (!msg || !msg.chat) continue;
        const chatId = String(msg.chat.id);
        const username = msg.from?.username || msg.chat.username;
        const firstName = msg.from?.first_name || msg.chat.first_name || msg.chat.title || "";
        const lastName = msg.from?.last_name || "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || "User";

        let phoneNumber = msg.contact?.phone_number || undefined;
        if (!phoneNumber && msg.text) {
          // Check if message text contained an international phone format
          const phoneMatch = msg.text.match(/\+?[1-9]\d{7,14}/);
          if (phoneMatch) {
            phoneNumber = phoneMatch[0];
          }
        }

        const existing = knownTelegramUsers.get(chatId);
        knownTelegramUsers.set(chatId, {
          chatId,
          username: username || existing?.username,
          firstName: firstName || existing?.firstName,
          lastName: lastName || existing?.lastName,
          fullName: fullName || existing?.fullName,
          phoneNumber: phoneNumber || existing?.phoneNumber,
          lastSeen: msg.date ? msg.date * 1000 : existing?.lastSeen || Date.now(),
          lastMessageText: msg.text || existing?.lastMessageText || "",
        });
      }
    } catch (err) {
      console.warn("Failed to sync Telegram updates:", err);
    }
    return Array.from(knownTelegramUsers.values());
  }

  // 2. Fetch recent chats/users who messaged the bot (for easy recipient linking)
  app.get("/api/telegram/recent-chats", async (_req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(400).json({ ok: false, error: "Telegram bot token not configured" });
    }

    try {
      const users = await syncTelegramUsers(token);
      const chats = users
        .map((u) => ({
          chatId: u.chatId,
          username: u.username,
          firstName: u.fullName || u.firstName || "User",
          phoneNumber: u.phoneNumber,
          lastMessageText: u.lastMessageText || "",
          date: u.lastSeen,
        }))
        .sort((a, b) => b.date - a.date);

      return res.json({ ok: true, chats });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Failed to fetch chats" });
    }
  });

  // 2b. Flexible Recipient Resolution: Supports Chat ID, Username (@username or t.me/...), and Phone Number
  app.post("/api/telegram/resolve-recipient", async (req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(400).json({ ok: false, resolved: false, error: "Telegram bot token not configured" });
    }

    const { input, mode } = req.body as { input?: string; mode?: "auto" | "username" | "phone" | "chat_id" };
    const rawInput = (input || "").trim();

    if (!rawInput) {
      return res.status(400).json({ ok: false, resolved: false, error: "Recipient input is required" });
    }

    // Always sync latest updates so any recent /start or bot interactions are immediately captured
    await syncTelegramUsers(token);

    // Auto-detect format if mode is not explicitly pinned
    let resolvedType: "chat_id" | "username" | "phone" = "chat_id";
    if (mode && mode !== "auto") {
      resolvedType = mode;
    } else {
      const cleaned = rawInput.replace(/\s+/g, "");
      if (rawInput.startsWith("+")) {
        resolvedType = "phone";
      } else if (rawInput.startsWith("@") || rawInput.includes("t.me/")) {
        resolvedType = "username";
      } else if (/^-?\d{4,16}$/.test(cleaned)) {
        resolvedType = "chat_id";
      } else if (/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(rawInput)) {
        resolvedType = "username";
      } else if (/^\+?[1-9]\d{7,14}$/.test(cleaned.replace(/[-()]/g, ""))) {
        resolvedType = "phone";
      } else {
        resolvedType = /[a-zA-Z]/.test(rawInput) ? "username" : "chat_id";
      }
    }

    // 1. Direct Telegram Chat ID
    if (resolvedType === "chat_id") {
      const cleanedId = rawInput.replace(/[\s#]/g, "");
      if (!/^-?\d+$/.test(cleanedId)) {
        return res.json({
          ok: false,
          resolved: false,
          type: "chat_id",
          error: "Invalid Chat ID format. Telegram Chat IDs must be numeric (e.g. 123456789 or -100123456789).",
        });
      }

      const match = knownTelegramUsers.get(cleanedId);
      return res.json({
        ok: true,
        resolved: true,
        type: "chat_id",
        chatId: cleanedId,
        name: match?.fullName || match?.firstName,
        username: match?.username,
        verified: !!match,
        worksImmediately: true,
        message: match
          ? `Direct Chat ID recognized (${match.fullName || `@${match.username}`})`
          : "Direct Chat ID ready for messaging.",
      });
    }

    // 2. Telegram Username (@username or https://t.me/username)
    if (resolvedType === "username") {
      const cleanUsername = rawInput
        .replace(/^https?:\/\/t\.me\//i, "")
        .replace(/^t\.me\//i, "")
        .replace(/^@/, "")
        .trim();

      // Check format
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUsername)) {
        return res.json({
          ok: false,
          resolved: false,
          type: "username",
          username: cleanUsername,
          error: "Invalid Telegram username. Must contain 3–32 letters, numbers, or underscores.",
        });
      }

      const lowerUsername = cleanUsername.toLowerCase();
      const match = Array.from(knownTelegramUsers.values()).find(
        (u) => u.username && u.username.toLowerCase() === lowerUsername
      );

      if (match) {
        return res.json({
          ok: true,
          resolved: true,
          type: "username",
          chatId: match.chatId,
          username: cleanUsername,
          name: match.fullName || match.firstName || `@${cleanUsername}`,
          verified: true,
          worksImmediately: true,
          message: `Username @${cleanUsername} verified and linked to Chat ID ${match.chatId}.`,
        });
      }

      return res.json({
        ok: false,
        resolved: false,
        type: "username",
        username: cleanUsername,
        needsBotStart: true,
        botUsername: "Eventlauncher_bot",
        actionUrl: "https://t.me/Eventlauncher_bot",
        error: `User @${cleanUsername} has not started @Eventlauncher_bot yet. In Telegram, bots cannot initiate contact with users until the recipient opens the bot and clicks Start.`,
      });
    }

    // 3. Phone Number (+countrycode...)
    if (resolvedType === "phone") {
      const cleanPhone = rawInput.replace(/[\s()-]/g, "");
      if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
        return res.json({
          ok: false,
          resolved: false,
          type: "phone",
          error: "Invalid phone format. Please provide a standard phone number with country code (e.g. +8801XXXXXXXXX or +12125550199).",
        });
      }

      const normalizedDigits = cleanPhone.replace(/\D/g, "");
      const match = Array.from(knownTelegramUsers.values()).find((u) => {
        if (!u.phoneNumber) return false;
        const entryDigits = u.phoneNumber.replace(/\D/g, "");
        return entryDigits === normalizedDigits || entryDigits.endsWith(normalizedDigits) || normalizedDigits.endsWith(entryDigits);
      });

      if (match) {
        return res.json({
          ok: true,
          resolved: true,
          type: "phone",
          chatId: match.chatId,
          phone: cleanPhone,
          name: match.fullName || match.firstName || cleanPhone,
          verified: true,
          worksImmediately: true,
          message: `Phone number ${cleanPhone} verified and linked to Chat ID ${match.chatId}.`,
        });
      }

      return res.json({
        ok: false,
        resolved: false,
        type: "phone",
        phone: cleanPhone,
        needsBotStart: true,
        botUsername: "Eventlauncher_bot",
        actionUrl: "https://t.me/Eventlauncher_bot",
        error: "The Telegram Bot API cannot look up arbitrary users by phone number. The recipient must start @Eventlauncher_bot, or you can provide their Telegram Username or numeric Chat ID.",
      });
    }

    return res.status(400).json({
      ok: false,
      resolved: false,
      type: "unknown",
      error: "Unable to detect recipient format. Please provide a Chat ID, Username (@...), or Phone Number (+...).",
    });
  });

  // 3. Send message via Telegram Bot API
  app.post("/api/telegram/send", async (req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(400).json({ ok: false, error: "Telegram bot token not configured" });
    }

    const { chatId, text, replyToMessageId } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, error: "chatId and text are required" });
    }

    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text,
      };
      if (replyToMessageId) {
        payload.reply_to_message_id = replyToMessageId;
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await tgRes.json()) as {
        ok: boolean;
        description?: string;
        result?: { message_id: number; date: number };
      };

      if (data.ok && data.result) {
        return res.json({
          ok: true,
          messageId: data.result.message_id,
          date: data.result.date * 1000,
        });
      }

      return res.status(400).json({
        ok: false,
        error: data.description || "Failed to send Telegram message",
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Internal error sending Telegram message",
      });
    }
  });

  // 4. Retrieve incoming updates / replies for a specific chat
  app.get("/api/telegram/updates", async (req, res) => {
    const token = getTelegramToken();
    if (!token) {
      return res.status(400).json({ ok: false, error: "Telegram bot token not configured" });
    }

    const { chatId, sinceMessageId } = req.query;
    if (!chatId) {
      return res.status(400).json({ ok: false, error: "chatId is required" });
    }

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`);
      const data = (await tgRes.json()) as {
        ok: boolean;
        description?: string;
        result?: Array<{
          message?: {
            message_id: number;
            chat?: { id: number };
            from?: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean };
            text?: string;
            caption?: string;
            date?: number;
          };
        }>;
      };

      if (!data.ok) {
        return res.status(400).json({ ok: false, error: data.description || "Failed to retrieve updates" });
      }

      const updates = data.result || [];
      const messages: Array<{
        id: string;
        messageId: number;
        sender: "agent" | "recipient";
        senderName: string;
        senderIdentifier: string;
        time: string;
        body: string;
        isAI?: boolean;
        timestamp: number;
      }> = [];

      const minId = sinceMessageId ? parseInt(String(sinceMessageId), 10) : 0;
      const targetChatId = String(chatId);

      for (const update of updates) {
        const msg = update.message;
        if (!msg) continue;
        if (String(msg.chat?.id) !== targetChatId) continue;
        // Ignore messages sent by the bot itself
        if (msg.from?.is_bot) continue;
        if (minId && msg.message_id <= minId) continue;

        const dateMs = (msg.date || Math.floor(Date.now() / 1000)) * 1000;
        const timeStr = new Date(dateMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const senderName = msg.from?.first_name ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}` : "Telegram User";
        const senderHandle = msg.from?.username ? `@${msg.from.username}` : `ID: ${msg.from?.id || targetChatId}`;

        messages.push({
          id: `tg-${msg.message_id}`,
          messageId: msg.message_id,
          sender: "recipient",
          senderName,
          senderIdentifier: senderHandle,
          time: timeStr,
          body: msg.text || (msg.caption ? `[Media: ${msg.caption}]` : "[Non-text message]"),
          isAI: false,
          timestamp: dateMs,
        });
      }

      return res.json({ ok: true, messages });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Error fetching updates" });
    }
  });


  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`EventLauncher server running on http://0.0.0.0:${port}`);
  });
}

startServer();
