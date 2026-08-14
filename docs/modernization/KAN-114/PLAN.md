# KAN-114 — Modernization plan: Payment-status service & governed AI agent

| | |
|---|---|
| **Epic** | KAN-114 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- **SQL injection in both target endpoints:** `/api/payment-status` and `/api/risk-score` build `WHERE` clauses by string concatenation (`server.js:535-537`, `server.js:597`); 11 total vectors across the service.
- **Hardcoded secrets in source:** `SMTP_PASS='meridian2013!'` (`server.js:44`), `ERP_FEED_KEY='ERP-POLL-KEY-8842'` (`server.js:49`) — PCI-DSS exposure on every clone.
- **Zero test coverage:** no test files, no test script in `package.json`; the APRSK01 scoring logic (`server.js:407-516`) is a 109-line untested port from COBOL.
- **README contract mismatch:** `README.md` documents `/api/risk-score` as accepting `ref` OR `invoice`; the handler accepts only `ref` (`server.js:590`).
- **No authentication on public JSON endpoints:** `/api/payment-status` and `/api/risk-score` accept unauthenticated traffic; 340 vendor calls/week are handled manually at the AP hotline because nothing safe can be pointed at these routes.

**Why this is worth doing now:** The injection vectors on live payment-data queries are a reportable PCI-DSS finding; the agent layer makes self-service safe and eliminates the hotline burden simultaneously.

## Target state

Both public JSON endpoints are replaced with parameterized, equivalence-proven v2 handlers at `/api/v2/payment-status` and `/api/v2/risk-score`. Legacy `/api/v1/…` aliases route to the same handlers so existing desk tooling requires no change. Hardcoded secrets are moved to environment variables. A governed AI agent (read-only `inquiry:read` scope, Vault-scoped identity) is deployed in web chat and at +1 (415) 338-9157, so vendors self-serve routine status and risk-band queries without calling the AP hotline.

**Workstreams**

1. **Modernize service** — Replace the two endpoints with secure, parameterized v2 handlers; mount v1 aliases; cover with golden equivalence tests; move secrets to env.
2. **Governed agent** — Expose `payment_status_lookup` and `payment_risk` MCP tools under a Vault-scoped read-only identity; deploy to chat and phone channels; prove the write-refusal boundary.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | `server.js` v2 handlers for `/api/v2/payment-status` & `/api/v2/risk-score`; v1 aliases; secrets moved to `process.env`; Jest + Supertest parity suite | (a) Parity suite green at 0 unexplained diffs vs legacy on nominal + error paths; (b) No SQL concatenation in new handlers; (c) `/api/v1/…` aliases return identical payloads to legacy baseline; (d) `SMTP_PASS` and `ERP_FEED_KEY` read from `process.env` | 2026-08-18 |
| 2 | Build and deploy governed agent | MCP endpoint wiring `payment_status_lookup` → `/api/v2/payment-status`, `payment_risk` → `/api/v2/risk-score`; Vault identity `meridian-payops-agent`; watsonx Orchestrate deploy; phone +1 (415) 338-9157 | (a) Agent returns full payment detail and risk band (not raw score); (b) Authorized read succeeds, write attempt returns documented refusal with identity stated; (c) Phone line live; (d) Denial logged with identity, scope, and timestamp | 2026-08-20 |

## Out of scope

- EJS UI routes (`/`, `/exceptions`, `/reports`, `/help`) — follow-on epic
- `/api/exceptions.xml` ERP feed — shared credential surface reviewed separately in follow-on
- Retirement of `/api/v1/…` aliases — follow-on epic after desk tooling is confirmed migrated
- SMTP configuration hardening — bundled with v1 retirement in follow-on

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal (valid ref), nominal (valid invoice, payment-status only), boundary (ref at max length), error (missing param → 400), error (unknown ref → 404) |
| **Comparison** | HTTP status, full JSON body field-by-field; money fields to the cent; risk band label; `retcode` |
| **Intended differences** | Risk score: v2 returns band only (Low/Medium/High), not raw numeric score; excluded from diff on `SCORE` field only |
| **Exit criteria** | ≥10 cases per endpoint, zero unexplained diffs, both implementations exercised live in the same test run |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Mount v2 handlers alongside legacy v1 aliases | Rewrite in place (single version) | Desk tooling requires no-change guarantee; v1 retirement is a separate, lower-risk follow-on |
| Agent exposes risk band only, not raw score | Expose full numeric score | Numeric score reveals model internals to vendors; band is sufficient for self-service |
| Hardcoded secrets remediated in this epic for target endpoints only | Remediate all secrets in one pass | Full sweep touches ERP feed and SMTP — separate surface, separate risk review |

## Open items

*(none — all blockers resolved in pre-planning questions)*

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Recorded on** | KAN-114 |
| **Approving comment** | "approved" (comment id 10403, 2026-08-14T00:49:41-0700) |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Reviewed** | KAN-114 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
