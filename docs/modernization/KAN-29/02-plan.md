# Modernization plan — AP Payment Operations console (Phase 1)

Epic: KAN-29
Date: 2026-08-12
Author: Bob (automated assessment + approved clarifications)
Assessment: [01-assessment.md](01-assessment.md)

---

## Objective

Modernize the AP Payment Operations console in place so that:

1. The **Held Payments screen** conforms to Meridian Design Language 3.0 and
   meets WCAG 2.2 AA.
2. The **`/api/payment-status` and `/api/risk-score` endpoints** are rewritten
   with parameterized queries, input validation, structured logging, and
   helmet security headers — while remaining behaviorally equivalent to the
   legacy implementations for all downstream consumers.
3. The modernized API is exposed as an **AI assistant channel** (chat and
   voice) via a scoped-identity MCP tool layer, allowing routine vendor status
   inquiries to be self-served without the AP hotline.

"Done" means: plan approved, the first implementation slice shipped with proof
(equivalence suite passing, design-approved frontend live, agent smoke-tested).
Target branch for all PRs: `demo-integration`.

---

## Target state

- All SQL built with `better-sqlite3` prepared statements and bound parameters.
- `helmet`, `express-validator`, `dotenv`, and `pino` wired in at application
  startup; secrets (SMTP password, ERP feed key) read from `process.env`.
- `/api/payment-status` and `/api/risk-score` rewritten; legacy handlers remain
  mounted at their existing paths (deprecated, not removed) until equivalence
  suite is green.
- Held Payments screen re-skinned to Meridian DL 3.0 tokens; jQuery replaced
  with vanilla JS; ARIA landmarks and keyboard navigation added.
- An MCP tool layer (`tools/payment-status-tool.js`) wraps the modernized API
  and authenticates via a scoped service identity from `process.env`; write
  operations are not exposed (rule 11b).
- All new/changed handlers carry compliance headers (rule 02). Change-log
  entries exist for every commit (rule 03). No test may be missing at the time
  a PR is opened.

---

## Workstreams

| Workstream | Covers | Depends on |
|------------|--------|------------|
| WS-1 Security baseline | Install `helmet`, `dotenv`, `express-validator`, `pino`; move secrets to `.env`; add CSRF middleware | — (prerequisite for all others) |
| WS-2 Backend API modernization | Rewrite `/api/payment-status` and `/api/risk-score` with parameterized queries, validation, logging; equivalence suite | WS-1 (approved libraries must be wired first) |
| WS-3 Held Payments frontend | Design approval → re-skin `/exceptions` to Meridian DL 3.0; remove jQuery; accessibility fixes | WS-1 |
| WS-4 Agent enablement | MCP tool layer wrapping the modernized API; scoped-identity governance; smoke test | WS-2 (modernized API must be green) |

---

## Subtasks

Business-day dates from 2026-08-12. Weekends skipped.

| # | Subtask | Scope | Acceptance criteria | Due date |
|---|---------|-------|---------------------|----------|
| S-1 | Security baseline | Install `helmet`, `dotenv`, `express-validator`, `pino`; wire into `server.js`; move SMTP password and ERP feed key to `.env`; add `pino` request log on every route | `npm test` green; `curl -I localhost:4600` returns `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`; `.env.example` committed; no literal secrets remain in `server.js` | 2026-08-14 |
| S-2 | Backend API rewrite | Rewrite `/api/payment-status` and `/api/risk-score`; all SQL parameterized; `express-validator` on all inputs; `pino` logs each request with ref and retcode; legacy handlers remain mounted | Equivalence suite: ≥30 cases, 0 unexplained diffs vs legacy captured responses; `npm test` green; no string-concat SQL in the rewritten handlers | 2026-08-18 |
| S-3 | Held Payments frontend | Design-approved re-skin of `/exceptions`: Meridian DL 3.0 tokens, vanilla JS sort/filter, ARIA landmarks, `scope="col"` on all TH, min 14 px body text, risk-tier indicated by icon + colour | Design approval recorded in Jira; fidelity check screenshot attached to PR; WCAG 2.2 AA: 0 contrast failures on the held-payments table; `npm test` green | 2026-08-20 |
| S-4 | Agent enablement | `tools/payment-status-tool.js` MCP tool exposing `getPaymentStatus` (read-only); scoped identity from `process.env.AGENT_CLIENT_ID` / `AGENT_CLIENT_SECRET`; unauthorized write attempt returns 403 and audit log entry; surface tool link on modernized `/exceptions` screen | Agent smoke test: `getPaymentStatus(ref="MT-2026-08815")` returns correct JSON; unauthorized POST attempt returns 403 with audit log entry; both results recorded verbatim in PR body | 2026-08-22 |

---

## Out of scope

- Dashboard screen, Reports screen, Help screen, CSV export, XML ERP feed — not
  touched in Phase 1.
- Database engine migration (SQLite remains for Phase 1).
- Authentication and session management — the app currently has none; adding it
  is a Phase 2 item so the Phase 1 scope stays bounded.
- Bulk SQL-injection remediation across all routes beyond the two API endpoints
  — those routes are in scope for Phase 2 (noted as known risk).
- Mobile/responsive layout — the console is desktop-only.
- ERP batch bridge changes.

---

## Equivalence strategy

### Surface inventory

Two endpoints replaced:

| Endpoint | Method | Response shape |
|----------|--------|----------------|
| `/api/payment-status` | GET | JSON: PaymentRef, InvoiceNo, PO_NUM, sts, sts_desc, amt_cents, Amount_Formatted, ccy, Type, vendorName, vend_ctry, VendorNo, remit_TO, BankBIC, rsn, rsnText, age_days, CreatedDate, invoice_dt, due_dt, expected_pay_dt, value_dt, PaymentRun, risk, Clerk, resolved_dt, Resolution, over_approval_limit, retcode, asOfDate |
| `/api/risk-score` | GET | JSON: REF, INV, SCORE, BAND, amt_cents, ccy, TYPE, ctry, age, dup_suspect, bank_chg_days, over_limit, round_amt, new_vend, model, retcode |

### Input matrix

For each endpoint:

| Class | Cases |
|-------|-------|
| Nominal — lookup by ref | One case per `status` value (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED) |
| Nominal — lookup by invoice (payment-status only) | Two cases (open, resolved) |
| Boundary — not found | Invalid ref → retcode non-zero, 404 |
| Boundary — missing param | No `ref` and no `invoice` → 400 |
| Risk bands (risk-score) | One case each for LOW, MED, HIGH band |
| Special fields | `over_approval_limit=true` case; `bank_chg_days > 0` case; `new_vend=Y` case |
| Auth variants | (No auth today; both old and new endpoints unauthenticated during Phase 1; agent access gated by tool layer) |

Minimum: 30 cases. Target: ≥ 40 cases covering all reason codes.

### Golden capture

Golden responses captured by running `scripts/capture-golden.js` against the
**unmodified** legacy server before any handler code is changed. Fixtures
committed to `tests/golden/payment-status/` and `tests/golden/risk-score/`.
Capture script checks out no new code — it runs against the live SQLite seed.

### Comparison method

Field-by-field comparison:

- HTTP status code (exact)
- Every JSON key present (no keys added or removed unless listed as intended
  difference)
- String values: exact equality
- Numeric values (`amt_cents`, `SCORE`, `age_days`, etc.): exact equality
- Boolean flags (`over_approval_limit`, `dup_suspect`, etc.): exact equality
- `retcode`: exact equality
- `asOfDate`: exact equality (static in both implementations)

### Intended differences

None for Phase 1. The rewrite is a pure mechanical substitution of SQL
construction; no business logic is changed.

### Exit criteria

- ≥ 30 cases executed; 0 unexplained diffs.
- Suite runs in CI on `demo-integration` branch.
- Legacy handlers remain mounted until suite has been green for one complete
  sprint review.

---

## Design

Affected screen: Held Payments (`/exceptions`, `views/exceptions.ejs`).

Design frames to be produced in the Meridian project Figma file:
- `KAN-29 BEFORE` — screenshot of current `/exceptions` page.
- `KAN-29 AFTER` — re-skinned using Meridian DL 3.0 design tokens from the
  design-language page.

Design tokens required: surface colour, primary action colour, status badge
colours (PENDING/REVIEW/HOLD/ESCALATED/RESOLVED), typography scale (body 14 px
min, heading), spacing scale, border radius. These are read from the Figma
design-language page and committed to `docs/design/KAN-29-spec.md` before
implementation begins.

Design review: to be completed as subtask S-3 pre-implementation gate. Reviewer
and date recorded in subtask comment on KAN-29-S-3.

---

## Dependencies and approvals required

| Item | Action required |
|------|----------------|
| `helmet` | On approved list — `npm install helmet` (CM-2 change log entry) |
| `express-validator` | On approved list — `npm install express-validator` |
| `dotenv` | On approved list — `npm install dotenv` |
| `pino` | On approved list — `npm install pino` |
| `jest` + `supertest` | On approved list — `npm install --save-dev jest supertest` |
| `.env` file | Create `.env` with `SMTP_PASS`, `ERP_FEED_KEY`, `AGENT_CLIENT_ID`, `AGENT_CLIENT_SECRET`; add to `.gitignore`; commit `.env.example` |
| Agent scoped identity | `process.env.AGENT_CLIENT_ID` / `AGENT_CLIENT_SECRET` to be provisioned in the runtime environment before S-4 begins |
| Figma design-language page access | Required for S-3 design frame. No external dependency — file is in the project Figma workspace |

No libraries outside the approved list are required. No infrastructure changes
beyond the `.env` file.

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Golden capture misses a production data quirk (null fields, legacy status codes) | Low | Medium — diff found post-deploy | Seed data covers all status values and reason codes; capture script validates all 10 reason codes present | Backend lead |
| Downstream team relies on undocumented field name or ordering | Low | Medium — silent consumer break | Field-by-field comparison covers all documented fields; downstream teams notified of PR before merge | API owner |
| Figma bridge unavailable at design time | Low | Low — delays S-3 only | REST API export path works without bridge; design spec committed before implementation begins | Frontend lead |
| jQuery removal breaks an edge interaction in `/exceptions` | Low | Low — contained to this screen | Vanilla JS replacement written test-first; screen tested on current seed data before PR | Frontend lead |

---

## Rollback

- **WS-1 (security baseline):** `npm uninstall` of added packages; revert `server.js`
  changes. Legacy app restores from main branch in < 5 minutes.
- **WS-2 (API rewrite):** Legacy handlers remain mounted at original paths. If
  modern handler misbehaves, swap the route registration back to the legacy
  function — no data migration needed.
- **WS-3 (frontend):** Template revert from main branch. No DB changes.
- **WS-4 (agent):** Remove `tools/payment-status-tool.js` and the route that
  mounts it. No persistent state change.

---

## Open blockers

None.

---

## Approval record

_To be filled by the approver when recorded on the epic in Jira._

| Approver | Role | Date | Recorded on epic |
|----------|------|------|------------------|
| | | | |
