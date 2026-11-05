# Security Specification: EventLauncher

## 1. Data Invariants
- **Authentication**: Writes to event workspace, tasks, stakeholder inquiries, and dispatched threads require user authentication or valid authorization tokens.
- **Admin & Organizer Access**: Bootstrapped authorized user `mahimr837@gmail.com` possesses primary administrator rights.
- **Entity Integrity**:
  - `events/{eventId}`: Document ID must be a valid alphanumeric string. Valid events require a non-empty name and date string.
  - `tasks/{taskId}`: Belongs to event operations. Requires title, owner, deadline, and recognized status.
  - `stakeholder_inquiries/{inquiryId}`: Requires question, valid recipient contact, platform (`email`, `telegram`, or `whatsapp`), and assigned micro-agent.
  - `dispatched_threads/{threadId}`: Requires non-empty agentId, recipientEmail, channel, and numeric dispatched timestamp.
- **Denial of Wallet Prevention**: All string fields are constrained with strict `maxLength` boundaries. Array lengths for message logs are bounded.

## 2. The "Dirty Dozen" Threat Payloads
1. **Unauthenticated Write Injection**: Anonymous write to `/events/career-seminar-2026` -> Expected: `PERMISSION_DENIED`
2. **Gigantic Payload Attack**: Attempt to write 2MB string into `question` field -> Expected: `PERMISSION_DENIED`
3. **Ghost Fields Injection**: Injecting arbitrary unauthorized keys (e.g., `__escalate_privilege: true`) into `/tasks/{id}` -> Expected: `PERMISSION_DENIED`
4. **Invalid Collection Path Injection**: Writing to arbitrary top-level system collections `/system_tokens/{id}` -> Expected: `PERMISSION_DENIED`
5. **Path Traversal / Malformed Document ID**: Using `../admin/secret` as an event ID -> Expected: `PERMISSION_DENIED`
6. **Negative or Absurd Audience Count**: Storing `audience: -9999` or non-number in event document -> Expected: `PERMISSION_DENIED`
7. **Invalid Channel Platform**: Storing platform `tiktok` or `darknet` in stakeholder inquiry -> Expected: `PERMISSION_DENIED`
8. **Tampered Agent Identity**: Writing a dispatched thread with fake recipient or corrupted channel -> Expected: `PERMISSION_DENIED`
9. **Arbitrary Update Bypass**: Updating task fields without satisfying type guards -> Expected: `PERMISSION_DENIED`
10. **Client-side Timestamp Forgery**: Tampering with critical update timestamps -> Expected: `PERMISSION_DENIED`
11. **PII Extraction Query**: Scraping private credentials or unauthorized contact lists -> Expected: `PERMISSION_DENIED`
12. **Mass Deletion**: Unauthenticated wipe of event tasks or historical dispatched threads -> Expected: `PERMISSION_DENIED`

## 3. Test Runner Specification
Tests verify that unauthenticated mutations, malformed shapes, and oversized payloads are rejected by Firestore security rules.
