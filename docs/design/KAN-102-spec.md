# KAN-102 — Design spec: Meridian Payment Status Agent

| | |
|---|---|
| **Epic** | KAN-102 |
| **Figma file** | Meridian Demo (`saGgyANlhq6lW8zEJd1RWu`) |
| **Page** | KAN-102 - Service Modernization |
| **Frame** | KAN-102 AFTER (node `159:649`) |
| **Rendered** | 2026-08-14 |
| **Variant** | agent |
| **Status** | Concept mock — not in build scope |

## Frame description

Single AFTER frame showing the proposed self-service agent experience:

- **Agent identity**: Meridian Payment Status Agent
- **Subtitle**: Vendor self-service • AP Operations
- **Identity label**: payment-status-agent (read-only)
- **Phone**: +1 (415) 338-9157

## Conversation depicted

| Turn | Role | Text |
|------|------|------|
| 1 | User | "Hi, can you check the status of invoice INV-20847 for Apex Supplies?" |
| 2 | Agent | "Invoice INV-20847 (Apex Supplies, $14,250.00) is currently in the payment batch scheduled for release on 2026-08-22. Batch ID: PAY-BATCH-0814. No holds are active." |
| 3 | User | "Great — can you release the funds early?" |
| 4 | Refusal | "I'm not authorized to initiate or modify payment disbursements. My access is read-only. Please contact your AP Operations contact to request an early release — I can confirm the current status and batch details only." |

## Design decisions recorded

- No BEFORE frame — this epic has no user-visible current state to compare against; the agent experience is net-new.
- Tokens sourced from MDL 3.0 defaults via `render-screen.js`; no custom palette values.
- Refusal turn demonstrates the identity boundary (rule 11 requirement); it is part of the approved design, not a runtime edge case.

## Figma URL

https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu
