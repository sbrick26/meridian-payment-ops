<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-138 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-138 |
| **Author / date** | bobdev · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- Both `/api/payment-status` and `/api/risk-score` build SQL by string concatenation (`server.js:535–538`, `server.js:597`), violating parameterized-query policy; v2 must fix this.
- No automated tests exist for either route; behavioral equivalence is currently unverified (`package.json` has no test script).
- Response fields are returned as strings even for numeric values (`amt_cents`, `SCORE`, `age_days`) — v2 preserves this exact shape to protect the three downstream consumers.
- Scoring logic (`scoreRow`, `server.js:407–516`) and formatting utilities (`utils.js:bandFor`, `money`, `isRoundDollar`) are embedded in `server.js`; v2 delegates to the same functions — no rewrite of business logic.
- Agent artifacts (`agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml`) are not yet committed to source control; templates exist in `.bob/skills/agent-enablement/templates/`.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with parameterized queries, same response shape | 12-case parity suite (PS-01–PS-07, RS-01–RS-05) green; nominal, bad-input, and not-found cases match live legacy handlers with zero unexplained differences | 2026-08-20 |
| Governed MCP + Agent | MCP endpoint (`routes/mcp-endpoint.js`), scoped identity middleware (`vault/middleware/vault-scope.js`), and committed agent/tool/connection YAMLs | MCP lists 6 tools; inquiry (`payment_status_lookup`) succeeds for `ap-inquiry-agent`; `payment_release` is refused with `identity_scope_denied`; canonical `meridian_ap_assistant` YAML is importable to draft | 2026-08-21 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion. No
changes to legacy routes, the dashboard, the operator console UI, or other
existing endpoints.

## Verification

The parity suite (`tests/parity.test.js`) runs the same 12 inputs (PS-01–PS-07, RS-01–RS-05) against the mounted legacy and `/api/v2` handlers simultaneously and compares HTTP status and every response body field with zero unexplained differences. The identity check records one inquiry operation allowed (`payment_status_lookup` with `ap-inquiry-agent` token) and one ops operation refused (`payment_release` returns `identity_scope_denied`). The draft-import check confirms the existing agent name `meridian_ap_assistant` in `align-sf-588` without touching the live deployment.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect three existing downstream consumers; enable live side-by-side parity |
| One dedicated inquiry identity per agent (`ap-inquiry-agent`) | Shared or operator credential | Enforce least privilege below the model per Constitution rule 11 |
| Import existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo; requester performs final promotion |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | KAN-138 |
| **Approving comment** | — |
