<!-- Modernization plan — append-only once committed. Add a dated revision
     section to record changes; do not rewrite or delete prior content. -->

# KAN-34 — Modernization plan: AP Payment Operations console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-34 |
| **Author** | bobdev |
| **Date** | 2026-08-12 |
| **Status** | Awaiting approval |

## Current state

- **SQL injection throughout** — every query on the Held Payments list handler
  (`server.js` lines 154–166) and on all API handlers (`/api/payment-status`
  line 535, `/api/risk-score` line 597, `/exceptions/:id` line 225,
  `POST /exceptions/:id/resolve` lines 266–299) builds SQL by string
  concatenation. A single user-supplied `ref` or `q` value can read or
  overwrite the payment ledger (PCI-DSS Req. 6.5.1 / NIST SI-10).
- **Three hardcoded secrets in source** — `SMTP_PASS`, `ERP_FEED_KEY`, and the
  SMTP service account are literals in `server.js` (lines 44–49), violating
  PCI-DSS Req. 3 and the Engineering Constitution rule 01.
- **No test coverage; no `helmet`; no input validation** — `package.json`
  lists only `express`, `ejs`, and `better-sqlite3`. No `jest`, no
  `express-validator`, no `helmet`. The absence of security headers exposes
  operator sessions to XSS and clickjacking.
- **Legacy UI stack (Bootstrap 2 / jQuery 1.9.1)** — `views/partials/header.ejs`
  loads `bootstrap.css` and `jquery-1.9.1.min.js` from `/public/vendor/`. Both
  are unsupported (Bootstrap 2 is 12+ years old). The screen does not meet
  WCAG 2.2 AA contrast or focus requirements.
- **API field naming is arbitrary and mixed-convention** — `/api/payment-status`
  returns a mix of camelCase, UPPER_SNAKE, and abbreviations (`sts`, `amt_cents`,
  `vend_ctry`, `remit_TO`) with no schema. Downstream teams have built hard
  dependencies on these names; a clean break is not possible without a versioned
  parallel endpoint.
- **Risk scoring is embedded in `server.js`** — `scoreRow()` (lines 407–516)
  is an unversioned, untested copy of the COBOL routine APRSK01. Any defect
  fix or tuning silently changes results for all three API consumers.

**Why this is worth doing now:** The AP hotline fields ~340 vendor status calls
per week that the current tooling cannot deflect. A modernized, AI-accessible
API can self-serve those calls. Leaving the SQL injection and hardcoded
credentials in place is an open PCI-DSS finding.

## Target state

The Held Payments screen is rebuilt to Meridian Design Language 3.0 — same data,
same filters, modern tokens and WCAG 2.2 AA conformance. The
`/api/payment-status` and `/api/risk-score` endpoints are replaced with a
versioned JSON API at `/api/v1/` using parameterized queries, validated inputs,
and a documented field mapping. The API is exposed as an MCP tool so a
watsonx Orchestrate agent can answer vendor status inquiries via chat and voice,
governed by a read-only scoped identity. Hardcoded secrets are moved to
environment variables. Legacy endpoints stay mounted (deprecated) until the
equivalence suite is green.

**Workstreams**

1. **Frontend** — restyle `/exceptions` to MDL 3.0; no behavior changes.
2. **Backend** — replace `/api/payment-status` and `/api/risk-score` with
   `/api/v1/payment-status` and `/api/v1/risk-score`; parameterized queries;
   fix SQL injection across all write paths; move secrets to env; add `helmet`
   and `express-validator`.
3. **Agent** — expose the v1 API as an MCP tool; wire a watsonx Orchestrate
   agent; bind to the existing voice channel; enforce read-only scoped identity.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | **Golden test capture** | Capture golden responses from legacy `/api/payment-status` and `/api/risk-score` across nominal, boundary, error, and role-variant inputs before any code change | ≥20 fixture pairs committed to `tests/golden/`; equivalence suite fails against an empty implementation | 2026-08-14 (Thu) |
| 2 | **Frontend: Held Payments MDL 3.0** | Restyle `views/exceptions.ejs` and its partials to Meridian Design Language 3.0 tokens; remove Bootstrap 2 / jQuery 1.9.1 from this page | Screen matches approved Figma AFTER frame; WCAG 2.2 AA contrast passes; filters and pagination behave identically; `npm test` green | 2026-08-15 (Fri) |
| 3 | **Backend: v1 API + security hardening** | Add `/api/v1/payment-status` and `/api/v1/risk-score`; parameterize all queries in `server.js`; move `SMTP_PASS`, `ERP_FEED_KEY`, `SMTP_USER` to `process.env`; add `helmet`, `express-validator` | Equivalence suite: ≥20 cases, 0 unexplained diffs vs. golden; `npm test` green; no string-concatenated SQL remains in `server.js` | 2026-08-20 (Wed) |
| 4 | **Agent enablement** | MCP tool wrapping `/api/v1/payment-status` and `/api/v1/risk-score`; watsonx Orchestrate agent; voice channel binding; read-only scoped identity | Agent answers a vendor status query via chat; write attempt is refused with auditable denial; voice line routes correctly | 2026-08-22 (Fri) |

## Out of scope

- `/api/exceptions.xml` ERP feed — still consumed by the ERPBATCH01 batch
  bridge; retire only after a separate ERP integration project.
- Dashboard, Reports, Detail pages — not in the first slice; inherit the
  SQL fixes from Subtask 3 but are not restyled.
- `SMTP_HOST`/`AP_DISTRIBUTION_LIST` configuration — not a secret; move to env
  is best practice but is not a PCI finding; deferred.
- Agent write access (status changes, releases) — requires a separate written
  approval per Engineering Constitution rule 11; not in scope here.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` (both in `server.js`) |
| **Input matrix** | Nominal `ref` lookup; nominal `invoice` lookup; boundary (first record, last record, single-row result); empty result (unknown ref); missing param (400 path); each of the 5 status values; HIGH/MED/LOW risk bands; `WIRE`/`ACH`/`SEPA` payment types; known data quirks: `null` clerk, `bank_chg_days` = 0 and -1 |
| **Golden capture** | Subtask 1 runs the legacy app unmodified, `curl`s each case, and commits responses to `tests/golden/<endpoint>/<case>.json` before any code is touched |
| **Comparison** | HTTP status code; every response field by name; `amt_cents` / `SCORE` numeric precision; date strings verbatim; error body `ERR` code; field mapping documented in the subtask (legacy→v1 names) |
| **Intended differences** | Field names normalized in v1 (`sts` → `status`, `amt_cents` → `amountCents`, etc.) — documented in Subtask 3 PR and excluded from the diff; all deliberate |
| **Exit criteria** | ≥20 cases executed; 0 unexplained diffs; suite runs in CI; legacy `/api/payment-status` and `/api/risk-score` retired after suite is green and agent is live |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Modernize in place (same Express app, same port) | Greenfield service | Eliminates redirect complexity; ERPBATCH01 and three downstream API consumers need zero reconfiguration |
| Versioned parallel endpoints (`/api/v1/`) | Flag-flip on existing endpoints | Lets legacy consumers keep working during transition; equivalence suite can run both sides simultaneously |
| Held Payments screen first, dashboard last | Restyle all screens in one pass | Delivers the highest operator-time surface immediately; reduces design rework risk |
| Read-only agent scope only | Agent with release/hold authority | Engineering Constitution rule 11 requires written approval for write scope; approval is not in hand |
| Due dates are estimates (noted) | Hard commitments | Subtask 3 timeline depends on the size of the SQL injection fix discovered during golden capture; could slip 1–2 days |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | *(awaiting)* |
| **Date** | *(awaiting)* |
| **Recorded on** | KAN-34 |
