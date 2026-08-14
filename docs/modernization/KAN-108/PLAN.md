# KAN-108 — Modernization plan: Payment-Status Service

| | |
|---|---|
| **Epic** | KAN-108 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Approved — implementation in progress |

## Current state

- `/api/payment-status` and `/api/risk-score` build SQL by string concatenation from request query parameters, enabling injection (`server.js:535–537`, `server.js:597`). Zero tests exist.
- Two hardcoded secrets committed to source: SMTP password `meridian2013!` and ERP feed key `ERP-POLL-KEY-8842` (`server.js:44`, `server.js:49`).
- Replacement module files (`payment-status.js`, `risk-score.js`) already exist in the tree with parameterized queries, but are not mounted; legacy handlers continue to serve all traffic.
- No error-path consistency: status codes, field naming, and response shapes differ between the two legacy endpoints and any future v2 surface (`server.js:525–625`).
- ~340 vendor status calls per week are absorbed by the AP hotline because no safe, governed self-serve channel exists.

**Why this is worth doing now:** SQL injection on payment-lookup endpoints is a live PCI-DSS finding; hardcoded credentials are a reportable incident. Both are resolved as part of making the service safe to expose through an AI agent.

## Target state

`GET /api/v2/payment-status` and `GET /api/v2/risk-score` replace the legacy handlers with parameterized queries, secrets externalized to environment config, and consistent JSON response shapes. The agent layer authenticates as `meridian-payment-agent@meridian-corp.iam` with inquiry-only (read-only) scope, is reachable by web chat and by phone at +1 (415) 338-9157, and surfaces payment status, scheduled disbursement date, and ACH batch ID only — no bank details, risk scores, or internal reason codes. Legacy endpoints stay mounted during the parity window; `/api/exceptions.xml` is untouched.

**Workstreams**

1. **Service modernization** — replace legacy route handlers with the existing module files at `/api/v2/` paths, fix secrets, prove equivalence.
2. **Governed agent** — deploy `meridian-payment-agent` with Vault-scoped read-only identity, phone channel at +1 (415) 338-9157, field allowlist enforced in the tool definition.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | Mount `payment-status.js` and `risk-score.js` at `/api/v2/` paths; remove hardcoded secrets; parity suite | All parity-suite cases green (nominal, bad-input, not-found for both endpoints); `SMTP_PASS` and `ERP_FEED_KEY` absent from source; `GET /api/v2/payment-status` and `/api/v2/risk-score` return HTTP 200/400/404 matching legacy | 2026-08-19 |
| 2 | Deploy governed agent | Register `meridian-payment-agent` with inquiry scope; phone channel +1 (415) 338-9157; field allowlist: status, disbursement date, ACH batch ID only | Agent responds correctly to a payment-status query; write operation returns a recorded refusal; phone number confirmed live | 2026-08-21 |

## Out of scope

- `/api/exceptions.xml` ERP feed — untouched; ERPBATCH01 polling continues unaffected.
- All EJS / UI routes — documented follow-on, separate epic.
- Risk score exposure through the agent — explicitly excluded by approver.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal (valid ref), bad-input (missing param → 400), not-found (unknown ref → 404) |
| **Comparison** | HTTP status code, JSON response body field-for-field; legacy stays mounted at original paths during test run |
| **Intended differences** | Field names normalized to camelCase in v2; excluded from diff |
| **Exit criteria** | ≥ 6 cases (3 per endpoint × 2 paths), zero unexplained diffs, suite green in PR |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Mount new handlers at `/api/v2/` paths; keep legacy live | Drop-in replace legacy handlers in-place | Allows side-by-side parity proof without a rollback window |
| Agent surfaces status, disbursement date, ACH batch ID only | Include risk score and reason codes | Approver decision: minimise data exposure through the agent channel |
| `/api/exceptions.xml` left untouched | Migrate XML feed in same epic | ERP batch bridge continuity; separate risk profile |

## Open items

_(none)_

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Recorded on** | KAN-108 comment id 10394 |
| **Approving comment** | "approved" |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Reviewed** | KAN-108 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
