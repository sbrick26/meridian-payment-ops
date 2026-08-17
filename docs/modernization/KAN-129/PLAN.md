<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-129 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-129 |
| **Author / date** | payments-platform-team · 2026-08-17 |
| **Status** | Awaiting Jira approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are the only self-serve query surface; 340 AP hotline calls/week result from the absence of a safe, consumable interface (`server.js:525–625`).
- Both routes use implicit join syntax and return a broad field set with no validators or input sanitisation (`server.js:540–544`, `server.js:595–598`).
- No test files exist for either route; the equivalence template at `.bob/skills/implement-slices/templates/` defines the first test coverage (`equivalence.test.js:321–398`).
- `scoreRow()` is inlined in `server.js:407–516` and duplicated verbatim in the risk-score template; the algorithm must remain bit-identical across both versions to satisfy parity.
- No MCP endpoint, scoped identity layer, or agent artifacts are committed to the repository; all governed patterns live as templates in `.bob/skills/agent-enablement/templates/`.

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools (`payment_release`, `payment_hold`)
remain callable but are refused below the model by the vault-scope identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes using parameterized queries and `express-validator` | Nominal, bad-input, and not-found cases (12 scenarios: PS-01–PS-07, RS-01–RS-05) match the live legacy handlers with zero unexplained differences; `npm test` green | 2026-08-20 |
| Governed MCP + Agent | MCP endpoint (6 tools), vault-scope middleware, and complete `meridian_ap_assistant` agent/toolkit/connection YAML in `agent/` | MCP `tools/list` returns all 6 tools; `ap-inquiry-agent` inquiry call succeeds; `ap-inquiry-agent` `payment_release` call returns `{ refusal: true, … }`; canonical YAML is importable to `align-sf-588` draft | 2026-08-21 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion. Changes
to the live phone channel, other routes, and governance control files are out of scope.

## Verification

The parity suite mounts both the legacy handler and the `/api/v2` handler in-process
and runs the 12 defined scenarios (nominal, bad-input, not-found for each route) against
both, comparing HTTP status and every response body field with zero unexplained differences.
The identity-MCP test proves an `ap-inquiry-agent` inquiry call is allowed and a
`payment_release` call is refused with `refusal: true` and `required_scope: ops`. The draft
import confirms the existing `meridian_ap_assistant` agent name is active in `align-sf-588`
without touching the live channel.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protects the three existing downstream consumers and enables live parity comparison |
| One dedicated inquiry identity (`ap-inquiry-agent`) per agent | Shared or operator credential | Enforces least privilege below the model per Rule 11; refusal is the auditable control |
| Import the existing `meridian_ap_assistant` to draft only | Automatic live deployment | Preserves the warm live phone demo; requester performs the final flip manually |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-17 |
| **Recorded on** | KAN-129 |
| **Approving comment** | "approved" — Jira comment on KAN-129, 2026-08-17 |

## Revision history

| Date | Change |
|---|---|
| 2026-08-17 | Initial plan committed |
| 2026-08-17 | Approval recorded — Swayam Barik, Jira comment 2026-08-17 |
