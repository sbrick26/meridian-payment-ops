# KAN-87 — Modernization plan: Payment-Status Service & Governed Agent

| | |
|---|---|
| **Epic** | KAN-87 |
| **Author** | IBM Bob / payments-platform-team |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- `GET /api/payment-status` and `GET /api/risk-score` build SQL by string concatenation on user-supplied parameters (`server.js` L535–537, L597) — injectable and in violation of rule 01.
- Two secrets are hardcoded literals: `SMTP_PASS = 'meridian2013!'` (`server.js` L44) and `ERP_FEED_KEY = 'ERP-POLL-KEY-8842'` (`server.js` L48) — PCI-DSS Req. 3 / rule 01 findings.
- Response shapes are 25-field (`payment-status`) and 14-field (`risk-score`) mixed-case JSON with no versioned path; three consumers (Vendor Enquiry Desk, ERP Batch Bridge `ERPBATCH01`, AP Hotline) depend on these shapes in production.
- Zero test coverage across the entire service (`server.js`); no golden fixtures exist.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor status calls per week because no safe, self-serve channel exists. The injectable endpoints are a live PCI-DSS finding that blocks any external exposure.

## Target state

`/api/v2/payment-status` and `/api/v2/risk-score` replace the injectable logic with parameterized queries, move secrets to environment variables, and serve response bodies identical to the legacy endpoints. Legacy routes remain mounted with a `Deprecation` header; retirement is a future epic's decision. A governed AI agent (watsonx Orchestrate, phone `+1 (415) 338-9157`) fronts the v2 service with a read-only identity, exposing status, risk band, vendor, amount, hold reason, and expected pay date — never bank details or clerk names. Write operations (e.g., payment release) are refused and the refusal is demonstrable.

**Workstreams**

1. **Service modernization** — parameterized v2 routes, secrets to env, equivalence-proven against legacy.
2. **Agent enablement** — watsonx Orchestrate agent with scoped read-only identity, phone binding, write-refusal proof.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | KAN-87-S1: Modernize payment-status service | Add `/api/v2/payment-status` and `/api/v2/risk-score` to `server.js` using parameterized queries; declare env vars `PAYOPS_DB_PATH`, `PAYOPS_APPROVAL_LIMIT_CENTS`, `PAYOPS_SMTP_PASS`, `PAYOPS_ERP_FEED_KEY`, `PAYOPS_ERP_FEED_USER`, `PAYOPS_ERP_FEED_ROWS` (no provisioning — ops team supplies values); mount legacy routes with `Deprecation: version="v1", sunset="90d"` header; golden fixtures captured before modification; equivalence suite green at 0 unexplained diffs across all matrix cases | 2026-08-21 |
| 2 | KAN-87-S2: Governed agent | Deploy watsonx Orchestrate agent backed by v2 service; agent authenticates as `payops-agent@meridian-internal` (read-only); responses surface status, risk band, vendor, amount, hold reason, expected pay date only — `BankBIC`, `remit_to`, `Clerk` stripped; phone `+1 (415) 338-9157` bound; authorized read succeeds, release attempt refused with AC-6/PCI Req. 8 message; both outcomes recorded in PR | 2026-08-28 |

## Out of scope

- `/api/exceptions.xml` XML feed, `/exceptions`, `/reports`, `/reports/export.csv`, and all EJS UI routes — SQL injection findings noted, deferred to follow-on epic.
- Legacy route retirement — v2 is purely additive; retirement is a future epic's decision.
- Ops provisioning of env var values — plan names the variables; the ops team supplies the secrets.
- Any UI change to the AP console — this epic has no user-visible interface deliverable.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` → `/api/v2/payment-status`; `GET /api/risk-score` → `/api/v2/risk-score` |
| **Input matrix** | Nominal lookup by ref; nominal lookup by invoice; boundary: unknown ref (404); missing both params (400); missing ref on risk-score (400); max-length ref string; known data quirks: `null` resolved_date, `null` risk_flag, `ROUND` amount pattern |
| **Golden capture** | `npm run golden` against the unmodified legacy routes before any `server.js` edit; fixtures committed to `tests/golden/` in the first commit of the service subtask |
| **Comparison** | HTTP status code; every response-body field by name and value; monetary precision (`amt_cents` integer, `Amount_Formatted` string); date strings verbatim; error codes and messages on 400/404 paths |
| **Intended differences** | None — v2 response bodies are identical to legacy; `Deprecation` header is additive and not compared |
| **Exit criteria** | ≥ 9 matrix cases executed; 0 unexplained diffs; suite runs in CI on every push |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Side-by-side v2 routes, legacy mounted with `Deprecation` header, no retirement | In-place replacement of legacy URLs | Preserves zero-downtime migration for three production consumers; retirement timeline owned by consumers, not this epic |
| v2 is purely additive; legacy stays untouched | Hard retirement at 90-day sunset | Future epic's decision — this epic has no authority to remove endpoints three downstream teams depend on |
| Secrets named in plan, provisioning by ops | Generate `.env` provisioning script | Secrets must never appear in source or scripts (rule 01); ops team holds the credential lifecycle |
| Agent response strips `BankBIC`, `remit_to`, `Clerk` | Expose full payment-status payload | Minimum scope (rule 11 / AC-6): bank routing data and staff identity are not required for vendor self-service |
| Agent write-refusal demonstrated at PR (release attempt → AC-6 message) | Trust the read-only scope declaration alone | Rule 11(b) requires the refusal to be demonstrable evidence, not an assertion |

## Open items

_(none — no blockers)_

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-87 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-87 BEFORE / AFTER frames — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
