<!-- Write only to docs/modernization/KAN-135/PLAN.md. One-minute read. -->

# KAN-135 — Legacy payment-status service to governed agent

| | |
|---|---|
| **Epic** | KAN-135 |
| **Author / date** | bobdev · 2026-08-17 |
| **Status** | Approved |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are unversioned, untested routes in `server.js:525–625`; no parity suite exists.
- `scoreRow()` scoring logic (`server.js:407–516`) is inlined and untestable in isolation; modernization must preserve it exactly.
- Three downstream teams consume the unversioned endpoints; replacing in-place would break them.
- The legacy routes use raw string-matched query params (`ref`, `invoice`) with no express-validator guard (`server.js:527–529, 590–591`).
- No agent or MCP endpoint is committed for this service; templates live in `.bob/skills/agent-enablement/templates/` and must be instantiated.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with express-validator guards and parameterized queries | 12-case parity suite (PS-01–07, RS-01–05) passes green: nominal, bad-input, and not-found inputs match live legacy handlers with zero unexplained differences | 2026-08-20 |
| Governed MCP + Agent | MCP endpoint at `/mcp`, vault-scope middleware, and committed `agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml` | MCP lists 6 tools; `payment_status_lookup` allowed for `ap-inquiry-agent`; `payment_release` refused with `refusal:true, error:identity_scope_denied`; canonical `meridian_ap_assistant` YAML is importable to draft in `align-sf-588` | 2026-08-21 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
Legacy `GET /api/payment-status` and `GET /api/risk-score` remain mounted and unchanged throughout.

## Verification

The parity suite mounts both the legacy handlers and the `/api/v2` handlers in
a single Express process and runs the identical 12 inputs (PS-01–07, RS-01–05)
against each, comparing HTTP status and every response-body field with zero
unexplained differences. A separate identity-MCP test mocks the Vault token to
`ap-inquiry-read` policy, confirms `payment_status_lookup` is allowed and
`payment_release` is refused with `refusal:true` and `identity:ap-inquiry-agent`,
then confirms the canonical `meridian_ap_assistant` name is present in the committed YAML.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect three existing downstream consumers and enable live parity |
| One dedicated inquiry identity per agent (`ap-inquiry-agent`) | Shared or operator credential | Enforce least privilege below the model; write-scope refusal is demonstrable |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo; requester controls the final flip |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-17 |
| **Recorded on** | KAN-135 |
| **Approving comment** | "approved" — Jira comment, 2026-08-17 |
