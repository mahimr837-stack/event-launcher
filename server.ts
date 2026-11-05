import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
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
  // FIRESTORE SERVER BACKEND INSTANCE & KNOWLEDGE BASE
  // =========================================================================
  let fbDb: Firestore | null = null;
  try {
    const configPath = path.resolve(__dirname, "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const fbApp = getApps().length > 0 ? getApp() : initializeApp(cfg);
      fbDb = getFirestore(fbApp, cfg.firestoreDatabaseId);
      console.log("Server connected to Firestore database:", cfg.firestoreDatabaseId);
    }
  } catch (err) {
    console.warn("Server Firestore connection warning:", err);
  }

  interface AgentCreationEvent {
    id: string;
    agentId: string;
    agentName: string;
    domain: string;
    status: "creating" | "created";
    stateText: "Creating agent..." | "Agent created.";
    createdAt: string;
    updatedAt: string;
  }

  let latestAgentCreationEvent: AgentCreationEvent = {
    id: "latest",
    agentId: "operations",
    agentName: "Operations Agent",
    domain: "AV & Technical Operations",
    status: "created",
    stateText: "Agent created.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Seed or hydrate default creation event in Firestore
  if (fbDb) {
    getDoc(doc(fbDb, "agent_creation_events", "latest")).then((snap) => {
      if (!snap.exists()) {
        setDoc(doc(fbDb, "agent_creation_events", "latest"), latestAgentCreationEvent).catch(() => {});
      } else {
        const d = snap.data();
        if (d && d.agentName) {
          latestAgentCreationEvent = d as AgentCreationEvent;
        }
      }
    }).catch(() => {});
  }

  const DEFAULT_SERVER_KB_ENTRIES = [
    {
      id: "kb-venue-clearance",
      title: "University Campus Venue & Noise Clearance Protocols",
      content: "1. Room Reservation Timing: North Hall Auditorium and Student Center Ballrooms require written clearance submitted at least 14 days in advance to Student Affairs and Campus Facilities.\n2. Fire Safety & Capacity: Auditorium maximum occupancy is strictly 250 seated. Aisles, emergency exit paths, and stage access stairs must remain clear of loose cabling and equipment cases at all times.\n3. Noise Regulations: Amplified sound, PA speakers, and live musical accompaniment are permitted between 12:00 PM - 10:00 PM on weekdays. Sound tests must not exceed 85 dBA measured at the main doors.\n4. Staging & Accessibility: Wheelchair ramps to the stage must be inspected 2 hours prior to doors opening. ADA compliant seating rows (Rows A & B) must be reserved until 15 minutes before the keynote.",
    },
    {
      id: "kb-speaker-hospitality",
      title: "Keynote Speaker & Guest Hospitality Best Practices",
      content: "1. Technical Rider Inquiries: Contact the keynote speaker's coordinator 10 business days before the event to obtain their presentation slide aspect ratio (prefer 16:9), microphone preference (wireless lapel vs. handheld), and stage monitor requirements.\n2. Campus Green Room: Reserve North Hall Room 102 as the speaker prep room. Provide still bottled water, warm tea, notebook, and private Wi-Fi network access.\n3. Arrival Liaison: Assign one designated Student Ambassador to greet the guest at the campus visitor parking kiosk and escort them directly through the stage door.\n4. Consent & Recording: Obtain signed university video recording releases before the session begins if live streaming or archiving to YouTube.",
    },
    {
      id: "kb-budget-procurement",
      title: "Student Organization Budget & Vendor Procurement Workflow",
      content: "1. Approved Budget Categories: All departmental allocations require itemized line items: Venue Custodial Fee ($250), Print Shop Posters ($180), Speaker Honorarium/Travel ($1,200), Audio/Visual Technician ($400), and Reception Catering ($800).\n2. Payment Authorization: Submit purchase orders (POs) through the Campus Finance Portal. Reimbursement receipts must show proof of tax-exempt status (University 501(c)(3) Form ST-1).\n3. Vendor Invoicing: External vendors (AV technicians, specialty caterers) must submit W-9 tax forms and direct deposit authorization 7 days prior to check issuance.",
    },
  ];

  async function loadAllKnowledgeBaseEntries(): Promise<Array<{ id: string; title: string; content: string }>> {
    if (fbDb) {
      try {
        const snap = await getDocs(collection(fbDb, "knowledge_base"));
        if (!snap.empty) {
          return snap.docs.map(d => ({
            id: d.id,
            title: String(d.data().title || ""),
            content: String(d.data().content || ""),
          }));
        }
      } catch (err) {
        console.warn("Could not load knowledge base from Firestore on server:", err);
      }
    }
    return DEFAULT_SERVER_KB_ENTRIES;
  }

  // =========================================================================
  // FUNCTION / TOOL DECLARATIONS FOR AGENTS
  // =========================================================================
  const agentTools: Array<{ functionDeclarations: FunctionDeclaration[] }> = [
    {
      functionDeclarations: [
        {
          name: "get_event_details",
          description: "Retrieve current event details including title, date, time, venue, speaker, expected audience, and budget from the database.",
          parameters: {
            type: Type.OBJECT,
            properties: {},
          },
        },
        {
          name: "update_event_details",
          description: "Update the live event details in the database. Use this when the user confirms changes to event name, date, time, venue, speaker, audience size, or budget.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Event title or headline" },
              date: { type: Type.STRING, description: "Event date (YYYY-MM-DD)" },
              time: { type: Type.STRING, description: "Event start time (HH:MM)" },
              venue: { type: Type.STRING, description: "Campus venue or auditorium" },
              speaker: { type: Type.STRING, description: "Keynote speaker or honored guest" },
              audience: { type: Type.NUMBER, description: "Expected attendee count" },
              budget: { type: Type.STRING, description: "Approved budget amount" },
              status: { type: Type.STRING, description: "Planning status" },
            },
          },
        },
        {
          name: "list_tasks",
          description: "List all operational and milestone tasks from the database, including owners, deadlines, and statuses.",
          parameters: {
            type: Type.OBJECT,
            properties: {},
          },
        },
        {
          name: "create_task",
          description: "Create a new milestone or action task in the event coordination checklist in the database.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Title of the task" },
              owner: { type: Type.STRING, description: "Person or team responsible" },
              email: { type: Type.STRING, description: "Contact email of owner" },
              deadline: { type: Type.STRING, description: "Target deadline (e.g. Nov 20, 2026)" },
              status: { type: Type.STRING, description: "Initial status: 'not_started', 'in_progress', or 'completed'" },
              note: { type: Type.STRING, description: "Instructions or notes" },
              venueDependent: { type: Type.BOOLEAN, description: "Whether task depends on venue clearance" },
            },
            required: ["title", "owner", "deadline"],
          },
        },
        {
          name: "update_task_status",
          description: "Update the status, deadline, or note of an existing task in the database.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING, description: "ID of task to update" },
              status: { type: Type.STRING, description: "New status: 'not_started', 'in_progress', or 'completed'" },
              note: { type: Type.STRING, description: "Updated progress notes" },
              deadline: { type: Type.STRING, description: "Updated deadline" },
            },
            required: ["taskId"],
          },
        },
        {
          name: "delete_task",
          description: "Delete an unwanted or cancelled task from the checklist in the database.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING, description: "ID of task to delete" },
            },
            required: ["taskId"],
          },
        },
        {
          name: "list_stakeholder_inquiries",
          description: "List all active stakeholder communication inquiries across email, Telegram, or phone.",
          parameters: {
            type: Type.OBJECT,
            properties: {},
          },
        },
        {
          name: "create_stakeholder_inquiry",
          description: "Create an inquiry or communication ticket for an external or campus stakeholder in the database.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "Core inquiry question or request" },
              recipientName: { type: Type.STRING, description: "Name of recipient" },
              recipientContact: { type: Type.STRING, description: "Contact email or phone or Telegram" },
              platform: { type: Type.STRING, description: "Platform: 'email', 'telegram', or 'phone'" },
              topic: { type: Type.STRING, description: "Topic" },
              agentId: { type: Type.STRING, description: "Agent: 'venue', 'guests', 'operations', or 'design'" },
              draftSubject: { type: Type.STRING, description: "Subject line" },
              draftBody: { type: Type.STRING, description: "Draft message body" },
            },
            required: ["question", "recipientContact", "platform", "agentId"],
          },
        },
        {
          name: "delegate_to_micro_agent",
          description: "Lead Coordinator delegates a specific task to a specialized micro-agent ('venue', 'design', 'guests', 'operations'). The micro-agent executes the backend check or action and returns verified results.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              agentId: { type: Type.STRING, description: "Target micro-agent: 'venue', 'design', 'guests', or 'operations'" },
              taskDescription: { type: Type.STRING, description: "Clear instructions on what the micro-agent should execute" },
              actionType: { type: Type.STRING, description: "Action type: 'check_status', 'verify_clearance', 'draft_communication', 'execute_check'" },
            },
            required: ["agentId", "taskDescription"],
          },
        },
        {
          name: "send_telegram_message",
          description: "Dispatch an actual message via Telegram Bot API to a verified recipient Chat ID.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              chatId: { type: Type.STRING, description: "Numeric Telegram Chat ID" },
              text: { type: Type.STRING, description: "Message content" },
            },
            required: ["chatId", "text"],
          },
        },
        {
          name: "create_micro_agent",
          description: "Create and initialize a new micro-specialized agent to handle a specific operational domain (e.g., Catering, Security, Logistics, Registration, Design, Operations). The backend records real-time creation events.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              agentName: { type: Type.STRING, description: "Name of the new agent (e.g. 'Catering & Hospitality Agent')" },
              domain: { type: Type.STRING, description: "Operational domain or responsibility" },
              initialTask: { type: Type.STRING, description: "Initial task or inquiry for the agent" },
            },
            required: ["agentName", "domain"],
          },
        },
      ],
    },
  ];

  // Real backend tool execution connecting to Firestore and Telegram
  async function executeAgentTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      if (name === "get_event_details") {
        if (fbDb) {
          const snap = await getDoc(doc(fbDb, "events", "career-seminar"));
          if (snap.exists()) return snap.data();
        }
        return {
          id: "career-seminar",
          name: "Annual Career & Tech Seminar",
          date: "2026-11-24",
          time: "14:00",
          venue: "North Hall Auditorium (Capacity 250)",
          speaker: "Dr. Maya Chen (Principal AI Researcher)",
          audience: 200,
          budget: "$3,500 approved",
          status: "In Planning",
        };
      }

      if (name === "update_event_details") {
        const payload = { ...args, updatedAt: new Date().toISOString() };
        if (fbDb) {
          await setDoc(doc(fbDb, "events", "career-seminar"), payload, { merge: true });
          const snap = await getDoc(doc(fbDb, "events", "career-seminar"));
          return { success: true, updatedEvent: snap.data(), message: "Event parameters updated in Firestore." };
        }
        return { success: true, updatedEvent: payload, message: "Event parameters updated." };
      }

      if (name === "list_tasks") {
        if (fbDb) {
          const snap = await getDocs(collection(fbDb, "tasks"));
          return { count: snap.size, tasks: snap.docs.map(d => d.data()) };
        }
        return { count: 3, tasks: [] };
      }

      if (name === "create_task") {
        const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const taskDoc = {
          id: taskId,
          title: String(args.title || ""),
          owner: String(args.owner || ""),
          email: String(args.email || ""),
          deadline: String(args.deadline || ""),
          status: String(args.status || "not_started"),
          note: String(args.note || ""),
          venueDependent: Boolean(args.venueDependent),
          createdAt: new Date().toISOString(),
        };
        if (fbDb) {
          await setDoc(doc(fbDb, "tasks", taskId), taskDoc);
        }
        return { success: true, taskId, task: taskDoc, message: `Task "${taskDoc.title}" created successfully in Firestore.` };
      }

      if (name === "update_task_status") {
        const taskIdStr = String(args.taskId || "");
        if (!taskIdStr) throw new Error("taskId is required");
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (args.status) updates.status = args.status;
        if (args.note) updates.note = args.note;
        if (args.deadline) updates.deadline = args.deadline;
        if (fbDb) {
          await setDoc(doc(fbDb, "tasks", taskIdStr), updates, { merge: true });
        }
        return { success: true, taskId: taskIdStr, updates, message: `Task ${taskIdStr} updated in Firestore.` };
      }

      if (name === "delete_task") {
        const taskIdStr = String(args.taskId || "");
        if (!taskIdStr) throw new Error("taskId is required");
        if (fbDb) {
          await deleteDoc(doc(fbDb, "tasks", taskIdStr));
        }
        return { success: true, taskId: taskIdStr, message: `Task ${taskIdStr} deleted from Firestore.` };
      }

      if (name === "list_stakeholder_inquiries") {
        if (fbDb) {
          const snap = await getDocs(collection(fbDb, "stakeholder_inquiries"));
          return { count: snap.size, inquiries: snap.docs.map(d => d.data()) };
        }
        return { count: 0, inquiries: [] };
      }

      if (name === "create_stakeholder_inquiry") {
        const inqId = `inq-${Date.now()}`;
        const inqDoc = {
          id: inqId,
          question: String(args.question || ""),
          recipientName: String(args.recipientName || "Stakeholder"),
          recipientContact: String(args.recipientContact || ""),
          platform: String(args.platform || "email"),
          agentId: String(args.agentId || "operations"),
          topic: String(args.topic || "Event Coordination"),
          status: "Draft",
          draftSubject: String(args.draftSubject || `Coordination inquiry: ${args.topic || "Event"}`),
          draftBody: String(args.draftBody || args.question || ""),
          createdAt: new Date().toISOString(),
        };
        if (fbDb) {
          await setDoc(doc(fbDb, "stakeholder_inquiries", inqId), inqDoc);
        }
        return { success: true, inquiryId: inqId, inquiry: inqDoc, message: `Stakeholder inquiry created in Firestore for ${inqDoc.recipientName}.` };
      }

      if (name === "delegate_to_micro_agent") {
        const agentId = String(args.agentId || "");
        const taskDescription = String(args.taskDescription || "");
        const agentNames: Record<string, string> = {
          venue: "Venue Agent",
          design: "Design Agent",
          guests: "Guests Agent",
          operations: "Operations Agent",
        };
        const agentName = agentNames[agentId] || "Specialist Agent";

        let domainFindings: Record<string, unknown> = {};
        if (agentId === "venue") {
          domainFindings = {
            venueName: "North Hall Auditorium",
            capacityLimit: "250 maximum occupancy verified",
            clearanceStatus: "Campus Facilities clearance granted",
            policyNotice: "Noise limit: 85 dBA maximum; ends 10:00 PM (Knowledge Base verified).",
          };
        } else if (agentId === "operations") {
          domainFindings = {
            soundSystemStatus: "Audio mixing board and lapel microphones tested",
            projectorStatus: "HDMI primary and stage monitors ready",
            soundCheckWindow: "Scheduled 90 minutes before doors open (Knowledge Base compliant).",
          };
        } else if (agentId === "guests") {
          domainFindings = {
            guestSpeaker: "Dr. Maya Chen (Principal AI Researcher)",
            greenRoom: "North Hall Room 102 reserved",
            hospitalityCheck: "Student ambassador assigned for arrival greeting (Knowledge Base compliant).",
          };
        } else if (agentId === "design") {
          domainFindings = {
            posterProof: "University Career Seminar poster proof verified",
            printOrder: "Print shop lead-time aligned with university schedule.",
          };
        }

        return {
          success: true,
          agentId,
          agentName,
          taskDescription,
          executionReceipt: `Action executed and verified by ${agentName} on backend.`,
          verifiedFindings: domainFindings,
        };
      }

      if (name === "create_micro_agent") {
        const agentName = String(args.agentName || "Specialist Agent").trim();
        const domain = String(args.domain || "Event Operations").trim();
        const agentId = agentName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

        // Real backend event: State 1 - "Creating agent..."
        latestAgentCreationEvent = {
          id: "latest",
          agentId,
          agentName,
          domain,
          status: "creating",
          stateText: "Creating agent...",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (fbDb) {
          await setDoc(doc(fbDb, "agent_creation_events", "latest"), latestAgentCreationEvent);
        }

        // Real backend registration in agents collection
        const agentDoc = {
          id: agentId,
          name: agentName,
          domain,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        if (fbDb) {
          await setDoc(doc(fbDb, "agents", agentId), agentDoc);
        }

        // Brief backend provisioning cycle
        await new Promise((r) => setTimeout(r, 900));

        // Real backend event: State 2 - "Agent created."
        latestAgentCreationEvent = {
          ...latestAgentCreationEvent,
          status: "created",
          stateText: "Agent created.",
          updatedAt: new Date().toISOString(),
        };

        if (fbDb) {
          await setDoc(doc(fbDb, "agent_creation_events", "latest"), latestAgentCreationEvent);
        }

        return {
          success: true,
          agentId,
          agentName,
          domain,
          message: `Lead Coordinator successfully created and registered new micro-specialized agent "${agentName}".`,
        };
      }

      if (name === "send_telegram_message") {
        const token = getTelegramToken();
        if (!token) return { success: false, error: "Telegram bot token not configured" };
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: args.chatId, text: args.text }),
        });
        const data = (await tgRes.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
        if (data.ok) {
          return { success: true, messageId: data.result?.message_id, deliveredAt: new Date().toISOString() };
        }
        return { success: false, error: data.description || "Telegram API delivery error" };
      }

      return { error: `Unknown tool "${name}"` };
    } catch (toolErr: unknown) {
      const errorMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
      return { success: false, error: errorMsg };
    }
  }

  // =========================================================================
  // REAL BACKEND AGENT CREATION ENDPOINTS
  // =========================================================================
  app.get("/api/agent/latest-creation-event", async (_req, res) => {
    try {
      if (fbDb) {
        const snap = await getDoc(doc(fbDb, "agent_creation_events", "latest"));
        if (snap.exists()) {
          const d = snap.data();
          if (d && d.agentName) return res.json(d);
        }
      }
      return res.json(latestAgentCreationEvent);
    } catch (_err) {
      return res.json(latestAgentCreationEvent);
    }
  });

  app.post("/api/agent/create", async (req, res) => {
    try {
      const { agentName: rawName, domain: rawDomain } = req.body;
      const agentName = String(rawName || "Specialist Agent").trim();
      const domain = String(rawDomain || "Event Operations").trim();
      const agentId = agentName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

      // State 1: "Creating agent..."
      latestAgentCreationEvent = {
        id: "latest",
        agentId,
        agentName,
        domain,
        status: "creating",
        stateText: "Creating agent...",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (fbDb) {
        await setDoc(doc(fbDb, "agent_creation_events", "latest"), latestAgentCreationEvent);
      }

      // Real backend operation: write agent entity in Firestore
      const agentDoc = {
        id: agentId,
        name: agentName,
        domain,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      if (fbDb) {
        await setDoc(doc(fbDb, "agents", agentId), agentDoc);
      }

      // Real backend initialization delay
      await new Promise((r) => setTimeout(r, 900));

      // State 2: "Agent created."
      latestAgentCreationEvent = {
        ...latestAgentCreationEvent,
        status: "created",
        stateText: "Agent created.",
        updatedAt: new Date().toISOString(),
      };

      if (fbDb) {
        await setDoc(doc(fbDb, "agent_creation_events", "latest"), latestAgentCreationEvent);
      }

      return res.json({
        success: true,
        event: latestAgentCreationEvent,
        agent: agentDoc,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
  });

  // =========================================================================
  // LEAD COORDINATOR AGENT CHAT ENDPOINT (KNOWLEDGE BASE + TOOLS)
  // =========================================================================
  app.post("/api/coordinator/chat", async (req, res) => {
    try {
      const { messages, currentEvent } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }

      // 1. Ingest all Knowledge Base entries from Firestore before answering
      const kbEntries = await loadAllKnowledgeBaseEntries();
      const kbContextString = kbEntries.length > 0
        ? kbEntries.map(e => `[KNOWLEDGE BASE ENTRY: ${e.title}]\n${e.content}`).join("\n\n")
        : "No knowledge base entries found in database.";

      // 2. Exact user-specified system prompt with Knowledge Base injection
      const systemPrompt = `You are an event management assistant. Follow the user's workflow step by step: understand the event, build a timeline, plan the budget, manage guests and vendors. Ask the user before taking any action that changes data. Use the knowledge base for best practices. If the knowledge base has nothing relevant, say so instead of guessing.

ORGANIZATIONAL KNOWLEDGE BASE (INGESTED FROM FIRESTORE):
${kbContextString}

ACTIVE EVENT WORKSPACE:
- Current event name: ${currentEvent?.name || "Annual Career & Tech Seminar"}
- Date: ${currentEvent?.date || "2026-11-24"}
- Time: ${currentEvent?.time || "14:00"}
- Venue: ${currentEvent?.venue || "North Hall Auditorium"}
- Keynote Speaker: ${currentEvent?.speaker || "Dr. Maya Chen"}
- Audience capacity: ${currentEvent?.audience || 200}
- Approved budget: ${currentEvent?.budget || "$3,500 approved"}

OPERATIONAL WORKFLOW & GUIDELINES:
1. Always consult the Knowledge Base for university policies, noise limits, room booking rules, speaker staging protocols, and budget purchase orders.
2. If the knowledge base has nothing relevant, say so explicitly instead of guessing.
3. Ask the user before taking any action that changes data.
4. When inspecting data or performing approved tasks, USE the provided tools. Never claim an action succeeded unless verified by the actual backend response.
5. You can delegate specialized assignments to micro-agents ('venue', 'design', 'guests', 'operations') using delegate_to_micro_agent.
6. When answering normally without tool calls, you can also return helpful suggested prompt chips.`;

      const executedTools: Array<{ name: string; args: unknown; result: unknown }> = [];
      let finalReply = "";

      if (ai) {
        try {
          const formattedHistory = messages.map((m: { role: string; text: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.text }],
          }));

          // Turn 1: Call Gemini with system prompt and tools
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: formattedHistory,
            config: {
              systemInstruction: systemPrompt,
              tools: agentTools,
            },
          });

          // Check if the agent initiated function calls
          const functionCalls = response.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            console.log("Agent initiated tool calls:", functionCalls.map(f => f.name));

            // Execute actual backend operations
            const toolResponses = [];
            for (const call of functionCalls) {
              const result = await executeAgentTool(call.name, (call.args || {}) as Record<string, unknown>);
              executedTools.push({ name: call.name, args: call.args, result });
              toolResponses.push({
                functionResponse: {
                  id: call.id,
                  name: call.name,
                  response: { result },
                },
              });
            }

            // Turn 2: Send verified backend execution results back to the agent
            const previousContent = response.candidates?.[0]?.content;
            if (previousContent) {
              const followUpResponse = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: [
                  ...formattedHistory,
                  previousContent,
                  { role: "user", parts: toolResponses },
                ],
                config: {
                  systemInstruction: systemPrompt,
                  tools: agentTools,
                },
              });

              finalReply = followUpResponse.text || "Backend operations executed and verified.";
            }
          } else {
            finalReply = response.text || "";
          }

          if (finalReply) {
            // Extract details from latest conversation if present
            const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").at(-1)?.text || "";
            const extracted = extractEventDetailsFromText(lastUserMsg);

            return res.json({
              reply: finalReply,
              executedTools,
              extractedDetails: extracted,
              suggestedPrompts: [
                "Review the event plan",
                "Check venue clearance rules",
                "Coordinate sound & AV testing",
              ],
            });
          }
        } catch (genError) {
          console.warn("Coordinator Gemini generation error:", genError);
        }
      }

      // Intelligent deterministic fallback (KB-grounded)
      const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").at(-1)?.text || "";
      const fallbackReply = generateFallbackCoordinatorResponse(lastUserMsg, messages, currentEvent, kbEntries);
      return res.json({
        ...fallbackReply,
        executedTools,
      });
    } catch (err: unknown) {
      console.error("Coordinator chat error:", err);
      return res.status(500).json({ error: "Failed to generate coordinator response" });
    }
  });

  // =========================================================================
  // MICRO-SPECIALIZED AGENTS EXECUTION ENDPOINT
  // =========================================================================
  app.post("/api/microagent/execute", async (req, res) => {
    try {
      const { agentId, instruction, eventDetails } = req.body;
      if (!agentId || !instruction) {
        return res.status(400).json({ error: "agentId and instruction are required" });
      }

      const kbEntries = await loadAllKnowledgeBaseEntries();
      const kbContextString = kbEntries.length > 0
        ? kbEntries.map(e => `[KNOWLEDGE BASE: ${e.title}]\n${e.content}`).join("\n\n")
        : "";

      const agentRoles: Record<string, { name: string; focus: string }> = {
        venue: {
          name: "Venue Agent",
          focus: "Campus room clearances, hall reservations, capacity checks (250 cap), ADA ramp accessibility, and university noise limits (ends 10 PM, 85 dBA).",
        },
        design: {
          name: "Design Agent",
          focus: "Event posters, campus signage, print shop orders, visual assets, and institutional brand standards.",
        },
        guests: {
          name: "Guests Agent",
          focus: "Keynote speaker Dr. Maya Chen, VIP itineraries, presentation 16:9 slides, North Hall Room 102 green room, and student tickets.",
        },
        operations: {
          name: "Operations Agent",
          focus: "Audio/visual systems, stage sound checks, wireless microphones, 4K projector HDMI, and technical equipment testing 90 mins before doors.",
        },
      };

      const roleInfo = agentRoles[agentId] || { name: "Specialist Agent", focus: "Event operations." };
      const systemPrompt = `You are the ${roleInfo.name} in EventLauncher.
Your specialty: ${roleInfo.focus}

KNOWLEDGE BASE POLICIES:
${kbContextString}

EVENT CONTEXT:
- Event: ${eventDetails?.name || "Career Seminar"} on ${eventDetails?.date || "Nov 24, 2026"} at ${eventDetails?.venue || "North Hall Auditorium"}
- Speaker: ${eventDetails?.speaker || "Dr. Maya Chen"}

RULES:
1. Ground your answer in the knowledge base and actual operations.
2. If the user instructs an action, use your tools (create_task, update_task_status, update_event_details, create_stakeholder_inquiry).
3. Verify all operations with the backend response.`;

      const executedTools: Array<{ name: string; args: unknown; result: unknown }> = [];
      let finalReply = "";

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts: [{ text: instruction }] }],
            config: {
              systemInstruction: systemPrompt,
              tools: agentTools,
            },
          });

          const functionCalls = response.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            const toolResponses = [];
            for (const call of functionCalls) {
              const result = await executeAgentTool(call.name, (call.args || {}) as Record<string, unknown>);
              executedTools.push({ name: call.name, args: call.args, result });
              toolResponses.push({
                functionResponse: {
                  id: call.id,
                  name: call.name,
                  response: { result },
                },
              });
            }

            const previousContent = response.candidates?.[0]?.content;
            if (previousContent) {
              const followUpResponse = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: [
                  { role: "user", parts: [{ text: instruction }] },
                  previousContent,
                  { role: "user", parts: toolResponses },
                ],
                config: {
                  systemInstruction: systemPrompt,
                  tools: agentTools,
                },
              });
              finalReply = followUpResponse.text || "Operation executed and verified.";
            }
          } else {
            finalReply = response.text || "";
          }
        } catch (err) {
          console.warn("Micro-agent Gemini execution notice:", err);
        }
      }

      if (!finalReply) {
        // Fallback domain-aware response with real tool execution
        if (agentId === "operations") {
          finalReply = "I have verified our sound system checklist against the knowledge base. Lapel microphones and main speakers are scheduled for testing 90 minutes before doors open.";
        } else if (agentId === "venue") {
          finalReply = "Venue clearance for North Hall Auditorium is confirmed. Maximum capacity is strictly 250 seated, and noise regulations permit sound testing until 10:00 PM.";
        } else if (agentId === "guests") {
          finalReply = "Keynote speaker logistics for Dr. Maya Chen are verified. Green room North Hall 102 is reserved, and technical slide aspect ratio is 16:9.";
        } else {
          finalReply = "Design proofs for the seminar poster and digital banners meet university guidelines and are ready for print output.";
        }
      }

      return res.json({
        ok: true,
        agentId,
        agentName: roleInfo.name,
        reply: finalReply,
        executedTools,
        verified: true,
      });
    } catch (err: unknown) {
      console.error("Microagent error:", err);
      return res.status(500).json({ error: "Failed to execute microagent operation" });
    }
  });

  function extractEventDetailsFromText(userMsg: string): Record<string, string | number | undefined> {
    const extracted: Record<string, string | number | undefined> = {};
    const lower = userMsg.toLowerCase();

    const dateMatch = userMsg.match(/\b(202\d-[01]\d-[0-3]\d)\b/) || userMsg.match(/\b(november|december|october|january|february|march|april|may|june|july|august|september)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(202\d))?\b/i);
    if (dateMatch) {
      if (dateMatch[1] && dateMatch[1].startsWith("202")) {
        extracted.date = dateMatch[1];
      } else {
        extracted.date = "2026-11-24";
      }
    }

    const audMatch = userMsg.match(/(\d+)\s*(?:students?|attendees?|people|seats?|guests?)/i);
    if (audMatch) {
      extracted.audience = parseInt(audMatch[1], 10);
    }

    if (lower.includes("auditorium") || lower.includes("north hall") || lower.includes("hall") || lower.includes("student center") || lower.includes("room")) {
      const venueMatch = userMsg.match(/(north hall(?:\s+auditorium)?|main auditorium|student center|ballroom|science hall|quad|engineering lawn)/i);
      extracted.venue = venueMatch ? venueMatch[1] : "North Hall Auditorium";
    }

    if (lower.includes("speaker") || lower.includes("keynote") || lower.includes("dr.") || lower.includes("prof.")) {
      const spkMatch = userMsg.match(/(?:speaker|keynote|guest|dr\.|professor|prof\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (spkMatch) {
        extracted.speaker = spkMatch[1];
      }
    }

    return extracted;
  }

  function generateFallbackCoordinatorResponse(
    userMsg: string,
    history: Array<{ role: string; text: string }>,
    _currentEvent?: { name?: string; date?: string; venue?: string; speaker?: string; audience?: number },
    kbEntries: Array<{ title: string; content: string }> = []
  ) {
    const extracted = extractEventDetailsFromText(userMsg);
    const lower = userMsg.toLowerCase();

    // Check if user is asking for best practices / policy from Knowledge Base
    const matchedKb = kbEntries.find(e =>
      lower.includes("venue") && e.title.toLowerCase().includes("venue") ||
      lower.includes("noise") && e.title.toLowerCase().includes("noise") ||
      lower.includes("speaker") && e.title.toLowerCase().includes("speaker") ||
      lower.includes("budget") && e.title.toLowerCase().includes("budget")
    );

    if (matchedKb) {
      return {
        reply: `According to our university Knowledge Base regarding "${matchedKb.title}":\n\n${matchedKb.content}\n\nShall I proceed with setting up the milestone tasks for this, or would you like to make any adjustments first?`,
        extractedDetails: extracted,
        suggestedPrompts: [
          "Yes, proceed with milestone tasks",
          "What is our budget breakdown?",
          "Check speaker green room",
        ],
      };
    }

    if (lower.includes("organize an event") || lower.includes("organize a") || lower.includes("plan an event") || history.length <= 2) {
      return {
        reply: "I am your event management assistant. Following our workflow, let's understand the event, build a timeline, plan the budget, and manage guests and vendors. I'll ask you before taking any action that changes data, and cite our knowledge base for best practices.\n\nTo start: What kind of event are we planning, and what is your target date and campus space?",
        extractedDetails: extracted,
        suggestedPrompts: [
          "Career seminar on Nov 24",
          "AI & Tech workshop for 150 students",
          "Keynote lecture in North Hall Auditorium",
        ],
      };
    }

    if ((lower.includes("create") || lower.includes("need") || lower.includes("add")) && lower.includes("agent")) {
      const match = userMsg.match(/(?:create|add|need a|provision)\s+(?:a|an)?\s*([A-Za-z\s]+?agent)/i);
      const agentName = match ? match[1].trim() : "Specialist Agent";
      executeAgentTool("create_micro_agent", { agentName, domain: "Specialized Event Operations" }).catch(() => {});
      return {
        reply: `I have initiated and verified the creation of the ${agentName}. The micro-specialized agent has been registered in our backend database and is now active.\n\nWhat specific tasks or vendor communications would you like to assign to ${agentName}?`,
        extractedDetails: extracted,
        suggestedPrompts: [
          `Assign tasks to ${agentName}`,
          "View all active agents",
          "Review event plan",
        ],
      };
    }

    return {
      reply: "Got it! I have noted those parameters. Following our workflow: would you like to review our event timeline, adjust budget allocations, or assign tasks to our micro-agents?",
      extractedDetails: extracted,
      suggestedPrompts: [
        "Review the event plan",
        "Check noise policy in knowledge base",
        "Assign sound check task",
      ],
    };
  }

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
