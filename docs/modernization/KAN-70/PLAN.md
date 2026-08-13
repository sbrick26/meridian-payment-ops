# KAN-70 — Modernization plan: payment-status service and AI agent

| | |
|---|---|
| **Epic** | KAN-70 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` in [`server.js`](../../server.js) (lines 525–625) build SQL via string concatenation — PCI-DSS Req. 6.5.1 violation — and carry no authentication, exposing vendor payment data to any network caller.
- Both endpoints have zero test coverage; no `routes/`, `tests/`, or equivalent directory exists in the current working tree. Prior epic work in git history is rehearsal residue and not this epic's baseline.
- KAN-42 delivered `GET /mcp` on [`server.js`](../../server.js) for the held-payments agent. KAN-70 requires a parallel, separately scoped MCP endpoint for vendor payment-status queries only; the KAN-42 endpoint is not in scope to extend.
- Two hardcoded credentials in [`server.js`](../../server.js) lines 44 and 49 (`SMTP_PASS`, `ERP_FEED_KEY`) are a separate finding; credential remediation is tracked as a follow-on, not in this epic.
- The AP hotline absorbs ~340 vendor status calls per week because no self-serve path exists ([`views/help.ejs`](../../views/help.ejs) line 36).

**Why this is worth doing now:** The AP hotline volume is measurable and immediate. Both vulnerable endpoints are unauthenticated and SQL-injectable today; a governed, tested replacement with an agent self-serve layer closes both the security gap and the operational one in a single sprint.

## Target state

`GET /api/v2/payment-status` and `GET /api/v2/risk-score` are mounted, tested, and passing 0-diff equivalence against their legacy counterparts. A governed MCP endpoint (`GET /mcp/vendor-status`) is mounted with `svc-payops-agent` read-only scope; write operations are refused at the service. An AI agent (chat + voice) is deployed on that endpoint so vendors can self-serve payment inquiries. Legacy endpoints remain mounted at `GET /api/payment-status` and `GET /api/risk-score` with a `Deprecation` header; no legacy code is removed in this epic.

**Workstreams**

1. **Service hardening** — golden capture of legacy endpoints; fresh v2 routes with parameterized queries and `express-validator`; equivalence suite green; `Deprecation` header on legacy endpoints.
2. **Agent enablement** — vendor-status MCP endpoint scoped read-only; agent deploy; write-refusal boundary proved.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| ST-1 | Golden capture and v2 routes | Capture legacy responses to `tests/golden/` before any code change; implement `routes/api-v2/payment-status.js` and `routes/api-v2/risk-score.js` with parameterized queries and `express-validator`; add `Deprecation` header to legacy endpoints | `npm test` passes, 0 unexplained diffs; `curl /api/payment-status` returns `Deprecation: true` header; golden fixtures committed before any route code | 2026-08-18 |
| ST-2 | Vendor-status MCP endpoint | Copy template; implement `GET /mcp/vendor-status` with two tools (`payment_status`, `risk_score`); vault scope: inquiry reads allowed, ops writes refused | `GET /mcp/vendor-status` returns tool list; authorized read returns payment data; `POST` write attempt returns HTTP 403 with identity + scope in body | 2026-08-20 |
| ST-3 | Agent deploy and boundary proof | Deploy agent via `ops_deploy_agent`; bind phone number; verify read succeeds and write is refused; live call returns real payment data | `ops_deploy_agent` reports agent name + phone; console log shows read allowed + write refused quotes; subtasks and epic to Done | 2026-08-25 |

## Out of scope

- Credential remediation (`SMTP_PASS`, `ERP_FEED_KEY`) — tracked as a separate security follow-on; explicitly not in this epic.
- Any user-interface build — epic description states UI is out of scope; Figma frames are a concept mock only.
- Retirement of `GET /api/payment-status` and `GET /api/risk-score` — legacy routes stay mounted deprecated; removal is a follow-on after downstream consumers are migrated.
- Extension of the KAN-42 held-payments MCP endpoint — separate scoped identity; not modified here.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` on `server.js` |
| **Input matrix** | Nominal ref/invoice lookup; boundary (empty result, single row, max field length, zero/negative amounts); error paths (missing params, unknown ref, unknown invoice); known data quirks (null clerk, legacy status codes, amount-in-cents integer) |
| **Golden capture** | Exercised against the unmodified legacy endpoints before ST-1 touches any code; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` as the first ST-1 commit |
| **Comparison** | HTTP status code; response body field-by-field; monetary precision (amount_cents integer, no rounding); ISO 8601 date strings; error codes and messages; no observable side effects on read |
| **Intended differences** | None; field names preserved verbatim |
| **Exit criteria** | All captured cases execute, 0 unexplained diffs; `npm test` green; legacy path not retired this epic |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Fresh implementation from current working tree with own golden capture | Restore v2 routes from prior epic's git history | Prior epic work in history is rehearsal residue; this epic owns its own evidence chain |
| Side-by-side deployment (`/api/v2/*` + legacy with `Deprecation` header) | Remove legacy routes immediately | Three named downstream consumers (enquiry desk, ERP batch, hotline) need migration runway |
| New, separately scoped MCP endpoint for vendor status | Extend the KAN-42 held-payments endpoint | Separate identity scope per rule 11; mixing read-only vendor queries with operator-write paths violates least-privilege |
| Agent identity is permanently read-only; write refusal is demonstrable at the service | Trust agent reasoning to not write | Rule 11 requires the refusal to be at the service, not in the agent's reasoning |
| Credential remediation out of scope | Include in this epic | Credentials are live in production; rotating them is a change-management event separate from an API modernization |

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-70 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-70 BEFORE / AFTER frames — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian-Demo (page: KAN-70 - Service Modernization) |
