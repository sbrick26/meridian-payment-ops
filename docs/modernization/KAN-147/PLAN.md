# KAN-147 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-147 |
| **Author / date** | payments-platform-team · 2026-08-19 |
| **Status** | Awaiting Jira approval |

## Current state

- Two untested legacy routes (`GET /api/payment-status`, `GET /api/risk-score`) have been in production since 2013 with no automated test coverage (`server.js:525–625`).
- Both routes build SQL by string concatenation, a PCI-DSS Req. 6.5.1 violation (`server.js:540–544`, `server.js:595–597`).
- No self-serve AI interface exists; ~340 vendor status calls per week are absorbed by the AP hotline because the legacy service cannot be safely exposed (`ticket description`).
- `scoreRow` scoring algorithm (45+ scoring rules) and all helper utilities (`utils.bandFor`, `utils.isRoundDollar`, `utils.money`) live only in `server.js:407–516` with no test coverage (`server.js:407–516`).
- There are no MCP tools, no governed agent identity, and no `meridian_ap_assistant` definition committed to source control (`.bob/skills/agent-enablement/templates/agent.yaml` holds the canonical template only).

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2` payment-status and risk-score routes with parameterized queries, compliance headers, and a 12-case live-vs-live parity suite (PS-01–07, RS-01–05) | All 12 parity cases pass green; nominal, bad-input, and not-found HTTP status and body match legacy with zero unexplained differences | 2026-08-21 |
| Governed MCP + Agent | MCP endpoint (6 tools), vault-scope identity middleware, and complete `meridian_ap_assistant` agent/toolkit/connection YAML committed to `agent/` | MCP `initialize` lists all 6 tools; `payment_status_lookup` succeeds for `ap-inquiry-agent`; `payment_release` is refused with `identity_scope_denied`; `agent/agent.yaml` is importable to `align-sf-690` draft | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
Out of scope: UI changes, new database tables or migrations, write-scope grants,
operator entitlement changes, and live agent promotion.

## Verification

The parity suite runs the same 12 nominal, bad-input, and not-found inputs
against the mounted legacy and `/api/v2` handlers in-process and compares HTTP
status and every response-body field with zero unexplained differences (PS-01–07,
RS-01–05). The identity check calls `payment_status_lookup` with an
`ap-inquiry-read` token and confirms `200 OK`, then calls `payment_release` with
the same token and confirms `refusal: true, error: identity_scope_denied`. The
draft-import check confirms `meridian_ap_assistant` exists in `align-sf-690`
after import without touching the live agent.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect three existing downstream consumers and enable live parity |
| One dedicated inquiry identity per agent (`ap-inquiry-agent`) | Shared or operator credential | Enforce least privilege below the model; meets Rule 11 (AC-6) |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | bobdev (Jira comment on KAN-147) |
| **Date** | 2026-08-19 |
| **Recorded on** | KAN-147 |
| **Approving comment** | "approved" |
