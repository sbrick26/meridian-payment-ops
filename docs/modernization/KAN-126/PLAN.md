<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-126 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-126 |
| **Author / date** | bobdev · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are served from `server.js:525–625` with no test coverage and no parameterized SQL discipline; queries use `queryOne()` directly against `payops.db`.
- The `scoreRow()` scoring algorithm (`server.js:407–516`) is duplicated verbatim in `templates/risk-score.js:22–77`; the authoritative copy must be shared rather than copied.
- Neither endpoint has an input-validation layer; validation is inline `if (!req.query.ref)` guards, making it easy for callers to trigger inconsistent behavior (`server.js:528–530`, `590–592`).
- There are no automated tests for either endpoint; behavioral regression must be introduced alongside the modern routes.
- No MCP surface or scoped identity layer exists today; the AP hotline absorbs ~340 vendor status calls per week because no read-only self-serve path is safe to expose.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with parameterized queries, express-validator input validation, and compliance headers | 12 parity cases (PS-01–07, RS-01–05) pass live-vs-live with zero unexplained field differences; legacy `/api/payment-status` and `/api/risk-score` remain mounted | 2026-08-20 |
| Governed MCP + Agent | Six-tool MCP endpoint at `/mcp`, Vault scope middleware enforcing `ap-inquiry-agent` read-only boundary, and committed `agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml` | MCP lists six tools; `payment_status_lookup` succeeds for `ap-inquiry-agent`; `payment_release` returns `refusal:true` with `required_scope:'ops'`; canonical `meridian_ap_assistant` YAML is importable to `align-sf-588` draft | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
No other routes are modified. No write scope is granted to `ap-inquiry-agent`.

## Verification

The parity suite (`tests/equivalence.test.js`) runs the same 12 inputs (PS-01–07 and RS-01–05) against the mounted legacy and `/api/v2` handlers simultaneously and compares HTTP status plus every response field with zero unexplained differences. The identity check (`tests/identity-mcp.test.js`) proves `ap-inquiry-agent` is allowed for `payment_status_lookup` and refused with `refusal:true`, `identity:'ap-inquiry-agent'`, and `required_scope:'ops'` for `payment_release`. The draft-import check confirms the existing `meridian_ap_assistant` agent name in `align-sf-588` without touching the live channel.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect existing consumers and enable live parity |
| One dedicated inquiry identity (`ap-inquiry-agent`) per agent | Shared or operator credential | Enforce least privilege below the model (rule 11) |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | KAN-126 |
| **Approving comment** | — |
