<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-132 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-132 |
| **Author / date** | payments-platform-team · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- Two query-only legacy endpoints exist with no tests and a README last updated years ago: `GET /api/payment-status` (`server.js:525–586`) and `GET /api/risk-score` (`server.js:588–625`).
- Both routes use shared in-module helpers `queryOne`/`queryAll` (`server.js:75–83`) with unparameterized SQL strings that reach the `exceptions`, `vendors`, and `ap_clerks` tables.
- Risk scoring uses a 100-point multivariate function `scoreRow()` (`server.js:407–516`) with band mapping from `utils.bandFor()` (`utils.js:107–111`); this logic is inlined with no unit test coverage.
- Both endpoints have well-defined error contracts (400 `MISSING_REF`, 404 `NOT_FOUND`) that the v2 routes must reproduce exactly for parity.
- The MCP and agent layer is fully templated in `.bob/skills/agent-enablement/templates/` and references the v2 routes at `/api/v2/*`; the v2 routes do not yet exist.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes with parameterized queries, compliance headers, and a live parity suite | Nominal, bad-input, and not-found cases match the live legacy handlers with zero unexplained differences; `npm test` green | 2026-08-19 |
| Governed MCP + Agent | MCP endpoint (`routes/mcp-endpoint.js`), Vault scope middleware (`vault/middleware/vault-scope.js`), and canonical agent/tool/connection YAML under `agent/` | MCP lists the six expected tools; `payment_status_lookup` succeeds for `ap-inquiry-agent`; `payment_release` returns `identity_scope_denied` (403); `agent/agent.yaml` imports cleanly to `meridian_ap_assistant` draft | 2026-08-20 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
Schema changes, new payment operations, and changes to the live agent are
explicitly out of scope.

## Verification

The parity suite (`tests/parity/`) runs the same nominal (by `ref`, by `invoice`), bad-input (missing params), and not-found (unknown `ref`) inputs against the mounted legacy (`/api/payment-status`, `/api/risk-score`) and v2 (`/api/v2/payment-status`, `/api/v2/risk-score`) handlers in the same process and compares HTTP status and JSON body with zero unexplained differences. The identity check proves `payment_status_lookup` is allowed for `ap-inquiry-agent` and `payment_release` is refused with `identity_scope_denied`, while the draft-import check confirms the existing agent name in `align-sf-588` without touching live.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect three downstream production consumers and enable live-vs-live parity |
| Parameterize all v2 queries with `db.prepare().get()` bound placeholders | Inherit the legacy string-concat pattern | Constitution rule 01 (PCI-DSS Req. 6.5.1); legacy SQL is a finding to not carry forward |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-17 |
| **Recorded on** | KAN-132 |
| **Approving comment** | "approved" — Jira comment on KAN-132 (comment id 10423, 2026-08-17) |

---

## Revision — 2026-08-17 (implementation authorized)

Approval received from Swayam Barik on 2026-08-17 via Jira comment on KAN-132.
Implementation of subtasks Modern API (due 2026-08-19) and Governed MCP + Agent (due 2026-08-20) authorized to begin.
