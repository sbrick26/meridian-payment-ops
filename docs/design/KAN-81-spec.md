# KAN-81 — Design spec reference

| | |
|---|---|
| **Epic** | KAN-81 |
| **Figma file** | https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
| **Page** | KAN-81 - Service Modernization |
| **BEFORE frame** | `156:192` — KAN-81 BEFORE (legacy held-payments screenshot) |
| **AFTER frame** | `156:194` — KAN-81 AFTER (governed agent conversation mock) |
| **Date rendered** | 2026-08-14 |

## Agent conversation mock (AFTER frame)

The AFTER frame shows the governed agent experience:

1. **User:** "What's the status of invoice INV-2026-4471?"
2. **Agent:** "Invoice INV-2026-4471 (MT-2026-08815) is currently HELD. Amount: $12,450.00. Reason: compliance review pending. Expected release: 2026-08-20."
3. **User:** "Can you release it now?"
4. **Refusal:** "I can only look up payment status and risk scores. Releasing a held payment requires an AP operator with write access — please contact ap-hotline@meridian.com."

## Scope note

This design is planning evidence for the approver. The UI mock is explicitly out of scope for this epic (see PLAN.md §Out of scope). The deliverable is the service and the agent backend.
