<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-154 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-154 |
| **Author / date** | bobdev · 2026-08-19 |
| **Status** | Approved — implementation complete |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` are bare Express handlers with no tests; three downstream teams consume them in production (`server.js:525–625`).
- Queries use parameterized `better-sqlite3` statements against the `exceptions`, `vendors`, and `ap_clerks` tables, indexed on `payment_ref` and `invoice_no` (`server.js:535–597`, `seed.js:205–207`).
- The COBOL-ported risk-scoring algorithm (`scoreRow`, `server.js:407–516`) produces a 0–100 score across nine factor bands; its behavior must be preserved exactly.
- No existing identity boundary exists between the consumer model and the payment-write surface; any caller can reach `payment_release` / `payment_hold` today.
- The AP hotline absorbs ~340 vendor status calls per week because there is no safe self-serve surface (`KAN-154` ticket context).

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes sharing the same `payops.db` while legacy `/api/payment-status` and `/api/risk-score` remain mounted | 12-case parity suite (PS-01–PS-07, RS-01–RS-05) passes with zero unexplained field differences across nominal, bad-input, and not-found cases | 2026-08-21 |
| Governed MCP + Agent | Six-tool MCP endpoint at `/mcp`, three-layer Vault scope middleware (`vault-scope.js`), and canonical `meridian_ap_assistant` agent/toolkit/connection YAML committed to `agent/` | `payment_status_lookup` with `ap-inquiry-agent` returns 200; `payment_release` with same identity returns 403 `identity_scope_denied`; canonical YAML imports cleanly to `align-sf-690` draft | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
UI changes, schema migrations, operator entitlement changes, and additional
agent channels are out of scope.

## Verification

The parity suite (`equivalence.test.js`) runs the same 12 nominal, bad-input,
and not-found inputs against the mounted legacy and `/api/v2` handlers in a live
side-by-side comparison, checking HTTP status and every response body field with
zero unexplained differences. The identity check (`identity-mcp.test.js`) proves
`payment_status_lookup` is allowed for `ap-inquiry-agent` and `payment_release`
is refused with `identity_scope_denied`, while the draft-import check confirms
the existing `meridian_ap_assistant` name in `align-sf-690` without touching the
live agent.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect three existing production consumers and enable live parity comparison |
| One dedicated `ap-inquiry-agent` inquiry identity per assistant | Shared service account or operator credential | Enforce AC-6 least privilege below the model; write refusal is auditable |
| Import the existing named agent to draft only | Automatic live deployment | Preserve the warm live phone demo; manual promotion is the requester's final control |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-19 |
| **Recorded on** | KAN-154 (comment id 10450) |
| **Approving comment** | "approved" |

## Approval record

Implementation authorized by Swayam Barik on 2026-08-19 via Jira comment id 10450
on KAN-154 ("approved"). Implementation completed 2026-08-19 20:33 UTC on branch
`feature/KAN-154-implementation`. Suite: 14/14 pass. Gate: PASS (mechanical).
