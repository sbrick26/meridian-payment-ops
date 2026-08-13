# KAN-37 — Modernization plan: AP Payment Operations console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-37 |
| **Author** | bobdev |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- **13 SQL-injection sites** across every data-bearing route: `status`, `ptype`, `q`, `id`, `clerk`, and `ref` are all string-concatenated into queries (`server.js:155–166, 225, 238, 292–299, 535–537`). Only one INSERT uses parameterized statements (`server.js:306`).
- **Hardcoded credentials in source**: SMTP password `meridian2013!` and ERP feed key `ERP-POLL-KEY-8842` are literal values (`server.js:44, 49`); no `process.env` usage anywhere in the app.
- **Zero authentication or test coverage**: all 10 routes — including the payment-resolve `POST` and the API feed — are open to any network caller; there are no test files in the repository.
- **Legacy API has no stable contract**: `/api/payment-status` and `/api/risk-score` return ad-hoc JSON built from raw `db.all()` rows; three downstream teams consume this with no schema guarantee and no versioning.
- **340 vendor status calls/week that could be self-served** (`views/help.ejs:36`): no assistant channel exists; AP clerks manually field every inquiry.
- **UI built on Bootstrap 2013 + jQuery 1.9.1** (`public/vendor/`) with no MDL 3.0 tokens, color-only risk indication, and no keyboard navigation — WCAG AA non-compliant.

**Why this is worth doing now:** the SQL-injection exposure and hardcoded credentials are reportable PCI-DSS findings in any payment-processing system; the 340-call/week AP hotline load is a measurable ops cost that an agent channel eliminates from day one.

## Target state

A modernized `routes/api-v2/` module replaces the legacy `/api/payment-status` and `/api/risk-score` endpoints with parameterized queries, `process.env`-sourced config, validated inputs, typed JSON, and a documented field mapping. An MCP tool layer exposes the new API to a watsonx Orchestrate agent (read-only, scoped identity) so vendors self-serve status inquiries via chat and the existing voice line. The Held Payments screen is rebuilt to MDL 3.0 using the frozen design spec. Legacy routes stay mounted and deprecated until the equivalence suite is green and the agent is verified live.

**Workstreams**

1. **Backend API modernization** — new `routes/api-v2/` with parameterized queries, env config, validated inputs, typed JSON, and a golden equivalence suite against the legacy behavior.
2. **Agent enablement** — MCP tool layer over the new API; watsonx Orchestrate agent (read-only, scoped identity); voice binding; identity boundary verification.
3. **Frontend modernization** — Held Payments screen rebuilt to the frozen MDL 3.0 spec (`docs/design/KAN-37-spec.md`); fidelity-checked against the approved AFTER frame before PR.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Backend API v2 | `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, golden fixtures in `tests/golden/`, equivalence suite in `tests/equivalence/` | All queries parameterized; credentials from `process.env`; equivalence suite passes with 0 diffs across ≥30 cases covering nominal, boundary, error, and authorization paths; legacy routes remain mounted | 2026-08-19 |
| 2 | Agent enablement | MCP tool manifest, watsonx Orchestrate agent config, identity-boundary smoke test | Agent answers vendor status inquiry via chat; voice line bound; one authorized read succeeds; one write attempt is refused with quoted refusal message; both smoke-test outputs in PR body | 2026-08-21 |
| 3 | Frontend Held Payments | `views/exceptions-v2.ejs` (or equivalent), CSS/JS per spec | Screen matches `docs/design/KAN-37-after.png` within one fidelity pass; WCAG AA color contrast; keyboard navigation on table rows; `npm test` green | 2026-08-25 |

## Out of scope

- Authentication / session middleware — no auth system exists today; adding one is a separate epic with identity-provider dependency outside this team's ownership.
- Reports and CSV export screens — scope is the Held Payments queue and API only.
- Payment detail and resolve workflow — read-path modernization first; write-path in Phase 2.
- Remediation of all 13 SQL-injection sites across the full `server.js` — only the API endpoints in scope for v2 are replaced; full server.js remediation is Phase 2.
- CSRF protection on the resolve POST — deferred to Phase 2 with the write-path work.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` in `server.js:525–625` |
| **Input matrix** | Nominal: ref lookup, invoice lookup; boundary: unknown ref (404), missing both params (400), ref with special characters; authorization: no-auth caller (all paths, since current app has no auth); data quirks: HIGH/MED/LOW risk_flag values, all five status values, null clerk_id |
| **Golden capture** | Capture script runs against the legacy routes before any modification; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/`; minimum 15 cases each |
| **Comparison** | HTTP status code; response body field-by-field; monetary amounts (cents integer and formatted string); date strings; all `risk_flag` values preserved verbatim; error codes and messages |
| **Intended differences** | ISO-8601 date formatting where legacy returns raw SQLite text strings. Excluded from diff comparison and listed in PR body. `risk_flag` field name is preserved unchanged. |
| **Exit criteria** | ≥30 cases executed; 0 unexplained diffs; legacy routes deprecated (path kept, 410 response) after agent smoke test passes |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Backend API first, then frontend | Frontend first | Agent channel eliminates 340 calls/week immediately; frontend is lower operational urgency |
| New `routes/api-v2/` alongside legacy | Rewrite `server.js` in place | Zero-downtime for three downstream consumers; reviewable diff; legacy stays as equivalence reference |
| Agent channel in Phase 1 | Defer to Phase 2 | Business goal of the epic is self-service vendor inquiries; deferring it makes Phase 1 incomplete against the stated objective |
| Read-only agent scope | Read-write | No written approval for write scope; AC-6 least-privilege default; write operations need a second sign-off (AP-114) that cannot be delegated to an agent without a separate control review |
| `risk_flag` field name preserved in v2 API | Rename to `risk_band` | Three downstream consumers depend on the current field name; a rename is a breaking change with no benefit at this stage |
| Credentials moved to `process.env` only | Secrets manager integration | Secrets manager is a Phase 2 dependency; `process.env` unblocks the PCI finding immediately without a new infrastructure dependency |

## Approval

| | |
|---|---|
| **Approver** | — |
| **Date** | — |
| **Recorded on** | KAN-37 |
