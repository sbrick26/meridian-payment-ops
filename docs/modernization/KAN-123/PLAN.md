<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-123 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-123 |
| **Author / date** | payments-platform-team · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are mounted in `server.js` (lines 525–625) with no input validation and SQL built by string concatenation — a PCI-DSS Req. 6.5.1 finding on both routes.
- Both handlers use raw interpolation (`"... WHERE payment_ref='" + ref + "'"`) instead of parameterized queries (`server.js:535–538`, `server.js:597`).
- There are no automated tests for either endpoint; behavioral equivalence has never been verified by tooling.
- Three downstream teams consume these endpoints in production; direct in-place replacement carries consumer breakage risk, so the legacy routes must remain mounted during transition.
- The AP hotline absorbs ~340 vendor-status calls a week because no safe self-serve surface exists for these two endpoints.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with parameterized SQL and express-validator | All 12 parity cases (PS-01–07, RS-01–05) pass live-vs-live with zero unexplained field or status differences | 2026-08-19 |
| Governed MCP + Agent | MCP endpoint (6 tools), vault-scope identity middleware, canonical `meridian_ap_assistant` agent / `ap_payments` toolkit / `ap_payments_vault` connection YAML | MCP `/tools/list` returns all 6 tools; `payment_status_lookup` succeeds with `ap-inquiry-agent` token; `payment_release` returns `refusal: true, identity: "ap-inquiry-agent", required_scope: "ops"`; agent YAML imports cleanly to `align-sf-588` draft | 2026-08-20 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
No UI changes, no schema migrations, no new library additions beyond what is
already in the approved list.

## Verification

The parity suite runs the same 12 nominal, bad-input, and not-found inputs
(PS-01–07, RS-01–05) against the mounted legacy and `/api/v2` handlers in the
same Express instance and compares HTTP status and every response body field
with zero unexplained differences. The identity check proves a
`payment_status_lookup` call is allowed for `ap-inquiry-agent` and a
`payment_release` call is refused with `identity_scope_denied` carrying the
agent identity, granted scopes, and required scope. The draft-import check
confirms the existing agent name `meridian_ap_assistant` in `align-sf-588`
without touching the live agent.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect existing consumers and enable live parity; three downstream teams consume `GET /api/payment-status` today |
| One dedicated inquiry identity (`ap-inquiry-agent`) per agent | Shared service account or operator credential | Enforce least-privilege below the model (Constitution rule 11); write refusal is the demonstrable control |
| Import the existing agent to `align-sf-588` draft only | Automatic live promotion | Preserve the warm live phone demo; requester performs the final flip |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | KAN-123 |
| **Approving comment** | — |
