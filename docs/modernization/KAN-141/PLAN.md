<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-141 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-141 |
| **Author / date** | bobdev · 2026-08-19 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are hand-rolled Express handlers with no tests and no parity guarantees (`server.js:525`, `server.js:588`).
- Risk scoring is a 110-line inline function (`server.js:407–516`); the band helper and status-description mapping are inlined scalars, making the logic hard to verify in isolation.
- Both routes share a single `better-sqlite3` connection with no v2 parameterization layer; downstream teams have no versioned surface to pin to (`server.js:32–36`, `seed.js:20`).
- No automated tests exist for these two endpoints; the parity baseline must be established live at test time (`package.json`: no test script references these routes).
- Three downstream teams consume the legacy endpoints in production; an in-place replacement would break them without notice.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes sharing the existing DB connection | 12-case parity suite (PS-01–PS-07, RS-01–RS-05) all green: nominal, bad-input, and not-found cases match live legacy handlers with zero unexplained differences | 2026-08-21 |
| Governed MCP + Agent | MCP endpoint (6 tools), vault-scope identity middleware, and complete `agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml` definitions | MCP lists 6 expected tools; `payment_status_lookup` succeeds for `ap-inquiry-agent`; `payment_release` returns 403 `identity_scope_denied`; canonical `meridian_ap_assistant` YAML imports to draft on `align-sf-588` | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
`GET /api/exceptions.xml` and all other routes are explicitly out of scope.

## Verification

The parity suite (`tests/equivalence.test.js`) runs the same 12 inputs against
the mounted legacy and `/api/v2` handlers live and compares HTTP status and every
response body field with zero unexplained differences. The identity test
(`tests/identity-mcp.test.js`) proves `ap-inquiry-agent` may call
`payment_status_lookup` (allowed) and that calling `payment_release` returns 403
`identity_scope_denied` (refused). The draft-import check confirms the existing
`meridian_ap_assistant` name in `align-sf-588` without touching the warm live
agent.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect existing consumers and enable live parity |
| One dedicated inquiry identity (`ap-inquiry-agent`) per agent | Shared or operator credential | Enforce least privilege below the model; refusal must be auditable |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | KAN-141 |
| **Approving comment** | — |
