# KAN-84 — Modernization plan: Payment-status service and governed AI agent

| | |
|---|---|
| **Epic** | KAN-84 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- Both public API endpoints (`GET /api/payment-status`, `GET /api/risk-score`) build SQL by direct string interpolation with no parameterized queries — SQL injection on user-supplied `ref` and `invoice` parameters (`server.js:535–538`, `server.js:597`). Zero test coverage exists anywhere in the repository.
- Five secrets are hardcoded at the top of `server.js`: `ERP_FEED_KEY`, `ERP_FEED_USER`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (lines 41–49). None is read from the environment. This is a PCI-DSS Req. 3 and SOX ITGC finding.
- Response keys are inconsistently named: `/api/payment-status` uses mixed-case (`PaymentRef`, `sts`, `amt_cents`); `/api/risk-score` uses ALL-CAPS (`REF`, `SCORE`, `BAND`). Three downstream consumers depend on the exact existing shapes — any key change is a breaking change.
- The AP hotline absorbs ~340 vendor status calls per week because no self-serve channel is safely pointed at this service. The agent channel closes that gap without adding write access.

**Why this is worth doing now:** The injection vulnerability is a live PCI-DSS Req. 6.5.1 finding on endpoints that have no auth layer. Moving secrets to env config and adding parameterized queries de-risks both findings in one delivery. The agent channel reduces ~340 hotline calls per week with a zero-write-scope identity.

## Target state

`/api/v2/payment-status` and `/api/v2/risk-score` replace the SQL construction in the legacy routes with `express-validator` input validation and `better-sqlite3` parameterized queries. All five hardcoded secrets are removed from source; their required environment variable names are documented here and provisioned by ops. The legacy routes remain mounted with a `Deprecation: version="1"` header and a sunset date 90 days from release, giving consumers a migration window. A Vault-scoped read-only watsonx Orchestrate agent is deployed behind the modernized service; it surfaces payment status, risk band, vendor name, amount, hold reason, and expected pay date — never bank details or clerk names — and permanently refuses any write operation, with the refusal demonstrable on a payment-release tool call.

**Workstreams**

1. **MODERNIZE** — Parameterized v2 routes, secrets to env, golden equivalence suite, legacy routes deprecated.
2. **AGENT** — MCP tool layer over the v2 routes, Vault-scoped read-only watsonx Orchestrate agent, write-refusal proof.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | KAN-84-S1: Modernize payment-status service | `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, golden fixtures in `tests/golden/`, equivalence suite wired to `npm test`, `server.js` secrets replaced with `process.env` reads | (a) `npm test` green with zero unexplained diffs across all equivalence cases; (b) 400 and 404 response bodies and status codes match legacy exactly; (c) legacy routes still respond with `Deprecation` header; (d) no secrets in source | 2026-08-19 |
| 2 | KAN-84-S2: Governed AI agent | `routes/mcp-endpoint.js`, `vault/middleware/vault-scope.js`, watsonx Orchestrate agent deployed, phone number active | (a) agent returns status, risk band, vendor name, amount, hold reason, expected pay date for a valid `ref`; (b) agent never returns `BankBIC`, `remit_TO`, `Clerk`, or `clerk_initials`; (c) a payment-release tool call returns a Vault-scope refusal, logged, relayed verbatim to caller; (d) `ops_deploy_agent` reports DONE with agent name and phone number | 2026-08-21 |

## Out of scope

- Legacy UI routes (`/exceptions`, `/reports`, `/reports/export.csv`, `/api/exceptions.xml`, `/help`, `/`) — SQL injection in these routes is a documented finding; remediation is a follow-on epic.
- Consumer migration to v2 URLs — the 90-day sunset window is the mechanism; coordination is not a deliverable of this epic.
- SMTP credential rotation — the env var name is documented; ops provisions the value; this epic does not touch the SMTP send path.
- Any user-interface build — the Figma BEFORE/AFTER frames are a concept mock for the approver; they are not in build scope.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` |
| **Input matrix** | Nominal hit by `ref`; nominal hit by `invoice`; 404 miss; 400 missing-param; boundary: single-row result, maximum field lengths, null `resolved_date`/`resolution`, zero `clerk_id` |
| **Golden capture** | Legacy responses captured to `tests/golden/*.json` by running the live server before any code is modified; captured per case in the input matrix |
| **Comparison** | HTTP status code; every response key and value including exact string representation of `amt_cents` and all date fields; `retcode`; error body structure on 400/404 |
| **Intended differences** | None — all key names, value formats, and status codes are preserved exactly |
| **Exit criteria** | ≥ 10 cases executed, zero unexplained differences; legacy routes remain mounted (not retired) at this epic's close |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Preserve all existing response key names exactly | Normalize to camelCase | Three downstream consumers depend on the current shapes; a key rename is a breaking change outside this epic's scope |
| Side-by-side v2 routes with 90-day `Deprecation` header on legacy | Redirect/proxy legacy to v2 | Proxy adds a failure mode on the legacy path; side-by-side lets consumers migrate on their own schedule |
| Document env var names; ops provisions values | Move secret values in this epic | The secrets are not consumed by the two target endpoints; moving them in the same change would touch out-of-scope routes |
| Agent holds read-only Vault scope; write permanently refused | Agent holds write scope with runtime guard | Rule 11(b): write scope requires written approval naming the assistant; none exists; refusal at the authorization layer is the control |
| Node built-in test runner (`node:test` + `assert`) | jest / supertest | Rule 04: jest and supertest are on the approved list but their transitive packages have failed the gate; built-in runner has no unapproved transitive dependencies |

## Open items

*(none)*

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Recorded on** | KAN-84 |
| **Approving comment** | "approved" (comment 10357, 2026-08-13T18:59:15-0700) |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Reviewed** | KAN-84 BEFORE / AFTER frames, https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
