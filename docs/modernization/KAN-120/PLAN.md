<!-- Write only to docs/modernization/KAN-120/PLAN.md. One-minute read. -->

# KAN-120 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-120 |
| **Author / date** | payments-platform-team · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are mounted directly on the root Express app with no version prefix; three downstream teams consume them in production (`server.js:525`, `server.js:588`).
- Both routes share a single `db` instance and reusable helpers (`scoreRow`, `queryOne`) but have no tests and no validation library — inputs reach the SQLite query unchecked (`server.js:540`, `server.js:595`).
- Risk scoring is a composite algorithm (`scoreRow`, `server.js:407–516`) hard-wired to model identifier `APRSK01`; raw score is not surfaced — only the band — making the model auditable only through code inspection.
- The MCP layer already exposes six tools (`payment_status_lookup`, `payments_search`, `payments_recent`, `payment_risk`, `payment_release`, `payment_hold`) but `payment_risk` and `payment_hold` tool YAML files are absent from source control (`tools/`), creating a gap between agent declaration and committed artifacts.
- `ap-inquiry-agent` identity enforces read-only at the service boundary; the write refusal path is implemented but not covered by an automated test.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes using `express-validator`, parameterized queries, and the shared `scoreRow`/`queryOne` helpers; legacy routes untouched | Nominal, bad-input, and not-found cases match the live legacy handlers with zero unexplained differences across all three parity scenarios | 2026-08-19 |
| Governed MCP + Agent | Complete six-tool MCP endpoint wired to `/api/v2`; scoped identity middleware refusing write ops; canonical `meridian_ap_assistant` YAML plus all six tool YAMLs and the `ap_payments_vault` connection definition committed | MCP lists all six tools; inquiry (`payment_status_lookup`) succeeds for `ap-inquiry-agent`; `payment_release` is refused with `identity_scope_denied`; `meridian_ap_assistant` YAML imports cleanly to `align-sf-588` draft without touching live | 2026-08-20 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
UI routes (`/exceptions*`), the ERP batch feed (`/api/exceptions.xml`), CSV
reports, model-version changes, credential rotation, and live promotion are
all out of scope.

## Verification

The parity suite runs the same nominal (`ref` present, valid), bad-input
(missing required parameter), and not-found (`ref` unknown) inputs against the
mounted legacy and `/api/v2` handlers simultaneously and compares HTTP status
and response body with zero unexplained differences. The identity check exercises
`ap_payments:payment_status_lookup` (must succeed) and
`ap_payments:payment_release` (must return `identity_scope_denied`) under the
`ap-inquiry-agent` credential, recording both outcomes in the PR body.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect the three existing downstream consumers and enable live parity testing |
| Add `express-validator` input validation on v2 routes only | Retrofit legacy handlers | Minimises change to legacy surface; legacy behaviour is preserved for parity |
| Import the existing agent to draft only | Automatic live deployment | Preserves the warm live phone demo for the requester's final promotion |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-17 |
| **Recorded on** | KAN-120 |
| **Approving comment** | "approved" — comment on KAN-120, 2026-08-17 |

---
*Approval appended 2026-08-17 20:02 UTC. Document is append-only from this point.*

## Approved-record correction

This correction supersedes the stale status and inventory wording above without
rewriting the approved record. The plan is **Approved**. The legacy baseline has
no MCP endpoint, agent definition, or automated identity-boundary test. The
agent deliverable is one canonical agent YAML, one remote MCP toolkit YAML
covering all six tools, and one connection YAML. No additional workstreams are
introduced by this ticket.
