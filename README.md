# Eventlauncher
### You plan the event. Eventlauncher runs the coordination.

Eventlauncher is a proposed AI-powered event management system designed to turn event plans into coordinated actions. Instead of making organisers manually handle every invitation, permission request, announcement, task assignment, and follow-up, Eventlauncher aims to automate these workflows through specialised AI agents and authorised service integrations.

**Built for:** AI VENTURE · Open Innovation · Track C

**Team:** Eventlauncher  
**Prototype:** [Explore Eventlauncher](https://event-launcher.ai.studio)

---

## The Problem

Organising an event involves far more than planning it.

Organisers often have to:
- Invite guests, speakers, and participants.
- Write and send emails and messages.
- Request venue and institutional permissions.
- Publish announcements and event updates.
- Assign responsibilities and track deadlines.
- Chase responses, remind team members, and resolve blockers.
- Keep everything moving when people are unavailable—even overnight.

These tasks are often scattered across different platforms. A delayed response or unfinished task can hold up several other activities, leaving the organiser responsible for keeping every part of the operation moving.

**The result:** Organisers spend too much time managing coordination instead of focusing on the event itself.

## Our Proposed Solution

Eventlauncher aims to act as an AI event manager that can coordinate workflows and execute routine administrative tasks, rather than simply recommend what a human should do.

### Key Capabilities

**1. Automated Communication**
- Draft and send emails through authorised integrations.
- Prepare invitations, permission requests, announcements, and reminders.
- Follow up on unanswered messages and pending requests.
- Support communication through compatible services such as email and WhatsApp.

**2. Multi-Agent Coordination**
- Use a lead coordinator to oversee the event workflow.
- Delegate specialised responsibilities to focused AI agents.
- Share relevant event context across agents.
- Surface conflicting recommendations or unresolved decisions.

**3. Task and Deadline Management**
- Turn an event brief into actionable tasks.
- Assign or recommend task owners.
- Track deadlines, acknowledgements, and outstanding work.
- Identify dependencies and trigger appropriate follow-ups.

**4. Cross-Platform Execution**
- Aim to connect event workflows with email, calendars, messaging services, and social platforms.
- Support invitations, permission requests, and event announcements through available APIs and authorised integrations.
- Expand automation as compatible integrations become available.

**5. Human Oversight**
- Require approval for sensitive or consequential external actions.
- Maintain visibility into decisions and actions.
- Apply consent, opt-out, privacy, and reminder-frequency controls.

## How It Could Work

1. **Describe the event** — Provide the event brief, goals, constraints, and relevant details.
2. **Build the plan** — Break the brief into tasks, responsibilities, deadlines, and dependencies.
3. **Coordinate the agents** — Let the lead coordinator and specialised agents work across the shared event context.
4. **Execute approved workflows** — Prepare communications and carry out supported actions through authorised integrations.
5. **Track and follow up** — Monitor task progress, identify blockers, and initiate appropriate reminders.
6. **Keep humans in control** — Escalate uncertainty, disagreements, and consequential decisions when human judgement is needed.

## Current Prototype

The current website is an interactive UI prototype demonstrating the intended Eventlauncher experience and workflow.

**Current implementation status:**
- Interactive interface: prototype simulation.
- Live LLM orchestration: not implemented.
- Real external email or message delivery: not implemented.
- Production service integrations: not implemented.
- Real-world user testing: not yet conducted.

The capabilities described above are the proposed system design, not claims that the current prototype already performs these actions.

## Technology and Development

Eventlauncher was developed through AI-assisted prototyping and iterative interface design using:

- [Google AI Studio](https://aistudio.google.com/)
- [Dyad](https://dyad.sh/)
- [ChatGPT](https://chatgpt.com/)

The production architecture, backend, model orchestration, and external service integrations remain future development work.

## What Makes Eventlauncher Different?

Event-management software and AI agents already exist. Eventlauncher does not claim to have invented either.

Our proposed contribution is to combine:

- Shared event context.
- A lead coordinator and specialised agents.
- Automated administrative execution.
- Dependency-aware task tracking and follow-up.
- Visible agent disagreement.
- Explicit human approval and accountability.

The goal is to move from **AI that tells organisers what to do** toward **AI that helps carry out the coordination itself**, within clear operational and safety boundaries.

## Roadmap

- [ ] Connect the prototype to a persistent backend.
- [ ] Implement event records, tasks, deadlines, and access controls.
- [ ] Build the lead coordinator and initial specialised agents.
- [ ] Integrate email and calendar workflows.
- [ ] Add approval controls, action logs, and failure handling.
- [ ] Evaluate task accuracy, duplicate reminders, blocker detection, and human control.
- [ ] Expand to additional communication and social platforms as supported integrations permit.

## Explore the Project

- **Live prototype:** https://event-launcher.ai.studio
- **GitHub repository:** https://github.com/mahimr837-stack/event-launcher

## Team

**Eventlauncher**  
Bangladesh University of Textiles (BUTEX), Bangladesh

Developed by student innovators exploring AI-assisted automation and practical applications of multi-agent systems.

---

*Eventlauncher is currently a prototype and proposed system design. Production capabilities, integrations, and performance claims remain subject to implementation and evaluation.*
