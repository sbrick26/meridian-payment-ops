# KAN-98 — Modernization plan: Payment-Status Service and Governed Agent

| | |
|---|---|
| **Epic** | KAN-98 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- Both public API endpoints (`/api/payment-status`, `/api/risk-score`) build SQL by string concatenation, not parameterized queries — classic injection surface (`server.js` lines 535–537, 597).
- Five production secrets (SMTP password `meridian2013!`, ERP feed key `ERP-POLL-KEY-8842`, ERP user, SMTP host, AP distribution list) are hardcoded literals; no `process.env` use anywhere in the file (`server.js` lines 41–49).
- Zero automated tests exist for any route. The service has been running since 2013 with no parity baseline.
- The vendor-inquiry gap absorbs ~340 AP hotline calls per week because nothing self-serve can be pointed at these endpoints safely (`README.md` line 136; `views/help.ejs` line 36).

**Why this is worth doing now:** The two API endpoints carry the full weekly vendor-inquiry load and have no injection protection; a single malformed query parameter can enumerate or corrupt the payments table. Closing this gap and exposing a governed agent channel eliminates the hotline volume at the same time.

## Target state

Two new parameterized endpoints (`/api/v2/payment-status`, `/api/v2/risk-score`) mount alongside the legacy paths, which remain live and untouched until a follow-on epic retires them. The v2 endpoints read credentials from environment variables and enforce strict input validation. A governed AI agent, reachable via web chat and at +1 (415) 338-9157, fronts the v2 endpoints with a read-only `inquiry:read` identity; write operations are refused at the authorization layer. Sensitive fields (BankBIC, remit_TO, Clerk) are stripped before responses reach the agent.

**Workstreams**

1. **Service modernization** — replace the two API endpoints with parameterized, validated, env-configured v2 implementations; mount dual-stack.
2. **Governed agent** — expose v2 endpoints through a watsonx Orchestrate agent with `inquiry:read` scope only; wire web chat and phone channel.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | KAN-98-S1: Modernize payment-status service | New `/api/v2/payment-status` and `/api/v2/risk-score` routes in `server.js`; parameterized queries; secrets from `process.env`; compliance headers | (a) Both v2 routes return HTTP 200 with identical body to legacy for valid inputs; (b) parity suite passes with zero unexplained diffs across nominal, not-found, and bad-param cases; (c) no string-concatenated SQL in the two new routes; (d) `ERP_FEED_KEY` and other secrets not referenced by these routes remain unchanged | 2026-08-19 |
| 2 | KAN-98-S2: Build governed AI agent | MCP tool layer over v2 endpoints; watsonx Orchestrate agent deployed with `inquiry:read` identity; phone +1 (415) 338-9157 bound; BankBIC / remit_TO / Clerk stripped from responses | (a) Agent returns correct payment status for a known invoice number; (b) a write operation (e.g. resolve a hold) is refused with the exact identity-and-scope message; (c) ops_deploy_agent confirms boundary: read allowed, write refused; (d) phone channel confirmed live | 2026-08-21 |

## Out of scope

- `/api/exceptions.xml` ERP feed — path unchanged, no modifications this epic; follow-on UI epic.
- All EJS UI routes (`/`, `/exceptions`, `/reports`, `/help`) — follow-on UI epic.
- SMTP / ERP credential migration (`SMTP_PASS`, `ERP_FEED_KEY`, `ERP_FEED_USER`, `SMTP_HOST`, `AP_DISTRIBUTION_LIST`) — none of these are consumed by the two target endpoints; migrating them here adds risk with no benefit to this scope.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `/api/payment-status` and `/api/risk-score` (GET, JSON) |
| **Input matrix** | Nominal (valid ref), nominal (valid invoice), not-found (unknown ref), bad-param (missing ref/invoice), boundary (ref with special characters) |
| **Comparison** | HTTP status, every JSON field present in legacy response (excluding intentional drops); money values exact-matched as integers |
| **Intended differences** | `BankBIC`, `remit_TO`, `Clerk` omitted from v2 responses by design — excluded from comparison |
| **Exit criteria** | ≥ 5 test cases per endpoint, zero unexplained diffs, suite green in CI before merge |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Dual-stack: mount v2 alongside legacy, legacy retired in follow-on | Immediate switchover of legacy paths | Three downstream consumers rely on legacy paths; switchover risk is disproportionate to this epic's scope |
| Strip BankBIC, remit_TO, Clerk from agent responses | Return full payload | External vendors should not see internal routing identifiers or operator names via an unauthenticated channel |
| Migrate only secrets touched by target endpoints (none this sprint) | Migrate all five hardcoded secrets | Credentials for SMTP and ERP feed are live production paths; changing them in the same PR introduces blast radius beyond scope |

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-98 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-98 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
