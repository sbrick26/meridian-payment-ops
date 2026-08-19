<!-- Write only to docs/modernization/KAN-144/PLAN.md. One-minute read. -->

# KAN-144 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-144 |
| **Author / date** | bobdev · 2026-08-19 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` joins `exceptions`, `vendors`, and `ap_clerks` via string-interpolated SQL (no parameterisation) and returns a 26-field shape; 400/404 error branches are present but untested (`server.js:525–586`).
- `GET /api/risk-score` scores a payment with a 12-factor algorithm (`server.js:407–516`) and calls `utils.bandFor()` for banding (`utils.js:107–110`); the same SQL-interpolation pattern applies (`server.js:588–625`).
- No automated tests exist; three downstream teams consume these two endpoints in production; the AP hotline absorbs ~340 vendor status calls per week (`payops.db`, `seed.js:154–209`).
- Both routes are mounted directly on `/api/*`; there is no v2 or parameterized equivalent, and no MCP interface.
- The `meridian_ap_assistant` agent definition, MCP toolkit, and connection YAML live only as templates in `.bob/skills/agent-enablement/templates/`; none are committed as deployed artifacts.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools (`payment_release`,
`payment_hold`) remain callable but are refused below the model by the identity
boundary enforced in `vault/middleware/vault-scope.js`.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with parameterized queries, compliance headers, and parity suite | Nominal, bad-input (missing param), and not-found cases all match the live legacy handlers (12 cases) with zero unexplained differences | 2026-08-21 |
| Governed MCP + Agent | MCP endpoint at `/mcp`, scoped Vault identity middleware, and committed `agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml` | MCP lists 6 tools; inquiry operations allowed for `ap-inquiry-agent`; `payment_release` and `payment_hold` refused with `identity_scope_denied`; canonical `meridian_ap_assistant` YAML is importable to draft | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion. No
UI changes, no new endpoints beyond the two v2 routes, and no modifications
to the live agent.

## Verification

The parity suite mounts both the legacy handlers and the `/api/v2` handlers in
a single in-process Express server and drives the same 12 inputs (5 nominal,
4 bad-input/400, 3 not-found/404) against both, comparing HTTP status and every
response field; zero unexplained differences is the gate. The identity check
calls `payment_status_lookup` (inquiry scope) and `payment_release` (ops scope)
against the Vault middleware and confirms ALLOWED then REFUSED
(`identity_scope_denied`, policies `["ap-inquiry-read"]`). The draft-import
check confirms the existing agent name `meridian_ap_assistant` in `align-sf-690`
without touching live.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protects existing consumers and enables live-vs-live parity at test time |
| One dedicated `ap-inquiry-agent` inquiry identity per agent | Shared service account or operator credential | Enforces least privilege below the model; write refusal is auditable (Rule 11) |
| Import the existing agent to draft only | Automatic live deployment | Preserves the warm live phone demo for the requester's final manual promotion |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-19 |
| **Recorded on** | KAN-144 |
| **Approving comment** | "approved" — Jira comment 10437, 2026-08-19T10:46:04 |

---
*Revision appended 2026-08-19 17:46 UTC — approval recorded, implementation authorized.*

## Revision — 2026-08-19 18:02 UTC

- **Status:** Approved; implementation authorized by Jira comment 10437.
- **Verification correction:** the 12 parity cases comprise 7 nominal, 2
  bad-input, and 3 not-found cases. The total and zero-difference gate are
  unchanged.
- **Scope clarification:** the operative scope is exactly the two workstreams
  in the Subtasks table.
