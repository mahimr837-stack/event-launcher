# EventLauncher: Production Software Architecture & Transition Plan

Transitioning EventLauncher from a demo simulation into a production-grade, collaborative event orchestration platform powered by real Google Cloud Firestore persistence, human-in-the-loop autonomous micro-agents, and verified multi-channel delivery across Gmail, Telegram, and WhatsApp.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core architectural and product decisions were confirmed during the interactive planning interview:

- **Confirmed Decision 1 (Event Scope)**: **Single Active Event Workspace with Full Customization**. The application focuses on a primary active event workspace where organizers have total freedom to customize the event title, category, date, schedule, venue specifications, speaker rosters, VIP riders, and operational parameters without confusing multi-tenant clutter.
- **Confirmed Decision 2 (Data Persistence)**: **Firebase Firestore Cloud Storage**. Moving away from transient in-memory and local browser storage to live Firebase Firestore collections (`events`, `tasks`, `stakeholders`, `drafts`, `dispatches`, and `threads`), ensuring instant synchronization across devices and permanent session integrity.
- **Confirmed Decision 3 (Agent Autonomy)**: **Human-in-the-Loop with Agent Drafting & Approval**. Specialist micro-agents (Guest Relations, Operations, Design, Venue) autonomously formulate outreach, extract logistical inquiries, and draft messages, but all dispatches require explicit organizer review and sign-off in the **Review** hub before sending.
- **Confirmed Decision 4 (Communication Channels)**: **Triple Live Channel Ecosystem**. Full operational support for:
  1. **Gmail API**: OAuth-authenticated direct email delivery, tracking, and reply synchronization.
  2. **Telegram Bot**: Two-way interactive agent messaging via the official `@Eventlauncher_bot`.
  3. **WhatsApp Business**: Template notifications and vendor response routing for field operations.

---

## 1. Overview & Core Concept

### What It Does
EventLauncher is an intelligent event operations hub for university organizing teams, student activity chairs, and campus department leads. Instead of managing dozens of disconnected spreadsheets, emails, and chat groups, organizers input their event vision and allow specialized micro-agents to draft stakeholder inquiries, track vendor approvals, coordinate AV/room permits, and maintain dependency graphs in real time.

### Target Audience & Persona
- **Primary Users**: University student organizers, campus club executives, faculty event coordinators, and seminar chairs.
- **Collaborators**: Keynote speakers, university facilities managers, audio-visual technical teams, print shop operators, and student volunteer crews.

### Key Value Delivered
- **Eliminates Coordination Drops**: Automated dependency mapping prevents costly timing oversights (e.g. reserving catering before venue permits are granted).
- **Zero-Effort Inquiries**: AI micro-agents craft bespoke, professional technical inquiries for every campus desk and coordinator.
- **Verifiable Audit Trail**: Real-time two-way inbox sync provides verifiable timestamps, reply history, and automated status indexing directly in the central dashboard.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Event Setup & Customization**:
   - The organizer configures their real event in the **Workspace** (setting custom dates, venue rooms, target capacity, keynote names, and technical rider constraints).
   - The Event Plan generates customized milestone tasks linked to specific campus stakeholders.
2. **Ecosystem & Stakeholder Information**:
   - In the **Information** section, organizers define stakeholders, assign them to specialist agents (Elena Woods $\rightarrow$ Guest Relations Agent; Campus AV $\rightarrow$ Operations Agent), and select delivery channels (Gmail, Telegram, WhatsApp).
   - Clicking **Save** persists requirements directly to Firestore.
3. **Review & Approval Gate**:
   - In the **Review** tab, organizers inspect agent-drafted messages, edit subject lines and body copy, and verify tone.
   - Clicking **Approve & Send** executes real API delivery (Gmail API / Telegram / WhatsApp) and marks the task as dispatched.
4. **Activity & Real-Time Sync**:
   - Dispatched communications appear in the **Activity** stream.
   - When a coordinator or speaker replies to the email or Telegram bot, clicking **Refresh** immediately syncs the incoming text, strips quote noise, updates the conversation node tree, and logs verified checklist compliance.

### Visual Identity & Theme
- **Aesthetic Direction**: Utilitarian, clean campus editorial workspace. Warm ivory backgrounds, deep forest sage accents (`#2D4A3E`), refined neutral borders (`#E5E7EB`), and crisp typography.
- **Color Palette**:
  - Canvas Background: Warm natural ivory (`#F2F5F0` / `#FAFAF8`)
  - Primary Brand / Agent Accent: Deep Campus Sage (`#2E4E3F` / `#3B6250`)
  - Light Accent Pill / Surfaces: Soft Sage Tint (`#E5EFE0`)
  - Status Indicators: Emerald (`#059669`) for verified approvals, Amber (`#D97706`) for awaiting review, Sky (`#0284C7`) for live Telegram feeds, Rose (`#E11D48`) for Gmail credentials.
- **Typography & Hierarchy**:
  - Display & Headlines: Modern sans-serif with geometric precision (`Inter` / `Plus Jakarta Sans`), weighted at `font-semibold` with negative letter-tracking (`tracking-tight`).
  - Numbers & Metrics: Tabular figures (`font-mono tabular-nums`) for timestamps, countdowns, capacities, and checklist counts to prevent layout jitter.
- **Component Styling & Layout**:
  - High-density data layouts with consistent 16px–24px container padding.
  - No decorative pills for plain text; metadata is structured cleanly with subtle 1px border lines.
  - Interactive buttons feature clear tactile hover transitions, loading spinners, and instant visual state feedback.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Single Persistent Event vs. Multi-Event Database
- **Chosen Approach**: Focus the primary workspace on a single, deeply customizable active event with full editability and quick reset/seed capabilities.
- **Why**: University chairs and event committees focus intensely on executing one high-stakes flagship symposium, seminar, or gala at a time. A single rich workspace maximizes screen real estate and minimizes cognitive switching costs.
- **Alternative Considered**: Multi-event selector with organizational hierarchies was deferred to keep the daily operational interface rapid, clean, and responsive.

### Decision 2: Firestore Cloud Persistence Architecture
- **Chosen Approach**: Direct Firestore integration with client-side Firebase SDK, persistent OAuth token management, and offline cache hydration.
- **Why**: Enables instantaneous collaboration across organizer laptops and phones without requiring complex backend database migrations.
- **Alternative Considered**: Client-only localStorage was rejected because it causes data loss on device switches or browser cache clearing.

### Decision 3: Human-in-the-Loop Review Hub
- **Chosen Approach**: Mandatory pre-send staging in the **Review** tab where micro-agents generate pre-populated email/message drafts that the organizer can fine-tune before delivery.
- **Why**: Protects organizers against accidental auto-spamming of university VIPs, department deans, and facilities directors while maintaining 90% time savings.
- **Alternative Considered**: Fully autonomous auto-dispatch was rejected to prevent unvetted agent messages reaching high-profile keynote speakers.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                      EventLauncher Client App                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────┐   ┌────────────────┐   ┌──────────────────────┐   │
│   │   Workspace    │   │   Event Plan   │   │  Ecosystem & Review  │   │
│   │  Brief & Meta  │   │  Tasks & Graph │   │   Drafts & Approvals │   │
│   └───────┬────────┘   └───────┬────────┘   └──────────┬───────────┘   │
│           │                    │                       │               │
│           └────────────────────┼───────────────────────┘               │
│                                │                                       │
│                     ┌──────────▼──────────┐                            │
│                     │  Unified Event Store │                           │
│                     │ (React State Hook)   │                           │
│                     └──────────┬──────────┘                            │
│                                │                                       │
│          ┌─────────────────────┴─────────────────────┐                 │
│          │                                           │                 │
│   ┌──────▼──────────────┐                     ┌──────▼─────────────┐   │
│   │  Cloud Firestore    │                     │  Multi-Channel API │   │
│   │  Database Sync      │                     │  Outreach Client   │   │
│   │ • events            │                     │ • Gmail API v1     │   │
│   │ • tasks             │                     │ • Telegram Bot API │   │
│   │ • threads           │                     │ • WhatsApp Client  │   │
│   └─────────────────────┘                     └────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Firestore Collections & Data Model

1. **`events` Collection**:
   - `id`: Event slug / identifier (e.g. `career-seminar-2026`)
   - `name`: String (e.g. "Annual Career & Tech Symposium")
   - `date`: ISO Date string
   - `time`: String ("14:00")
   - `venue`: String ("North Hall Auditorium")
   - `speaker`: String ("Dr. Maya Chen")
   - `audience`: Number (180)
   - `stage`: Current progress milestone

2. **`tasks` Collection**:
   - `id`: String
   - `title`: String
   - `owner`: String
   - `deadline`: String
   - `status`: `"Proposed" | "Pending" | "In progress" | "Completed"`
   - `venueDependent`: Boolean

3. **`stakeholder_inquiries` Collection**:
   - `id`: String
   - `question`: String
   - `recipientName`: String
   - `recipientContact`: String
   - `platform`: `"email" | "telegram" | "whatsapp"`
   - `agentId`: `"guests" | "operations" | "design" | "venue"`
   - `topic`: String

4. **`threads` Collection**:
   - `id`: String
   - `channel`: `"Email" | "Telegram" | "WhatsApp"`
   - `agentId`: String
   - `recipientName`: String
   - `recipientEmail`: String
   - `subject`: String
   - `threadId`: External Gmail / Telegram ID
   - `messages`: Array of `{ id, sender, senderName, time, body, isAI }`

---

## 5. Phased Production Implementation Roadmap

1. **Phase 1: Cloud Persistence & Firestore Integration**:
   - Implement Firestore repository services for real-time saving and fetching of event briefs, task checklists, and stakeholder cards.
   - Deploy production security rules for authenticated read/write access.
2. **Phase 2: Dynamic Event Customization**:
   - Transform the Workspace and Event Plan into fully editable forms where organizers can change dates, venue locations, target attendance, and speaker bios with immediate cloud sync.
3. **Phase 3: Multi-Channel Messaging Engine**:
   - Connect Gmail API (direct OAuth send & thread reply fetch).
   - Integrate Telegram bot webhook & long-poll runner for `@Eventlauncher_bot`.
   - Provide WhatsApp template dispatch generator with verification tracking.
4. **Phase 4: Verification, Polish & Error Resilience**:
   - Comprehensive error recovery for offline networks and API rate limits.
   - Full end-to-end testing of draft $\rightarrow$ approval $\rightarrow$ send $\rightarrow$ reply sync in the Activity hub.
