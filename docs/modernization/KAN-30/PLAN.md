# KAN-30 — Modernization plan: AP Payment Operations console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-30 |
| **Author** | bobdev |
| **Date** | 2026-08-12 |
| **Status** | Awaiting approval |

## Current state

- **SQL injection across 13 call sites** in `server.js` (lines 155, 160, 163–165, 225, 233, 238, 266, 292–299, 304, 365, 535, 537, 597, 632): every user-facing parameter is concatenated directly into query strings. The sole exception is the `INSERT INTO notes` at line 306.
- **Hardcoded production credentials** in `server.js` lines 43–49: SMTP password `meridian2013!`, ERP API key `ERP-POLL-KEY-8842`, and service account `svc_payops` are literal strings in source. No `process.env` usage anywhere in the file.
- **Zero test coverage**: no test directory, no test script in `package.json`; `jest` is installed but never invoked. The two downstream JSON APIs (`/api/payment-status`, `/api/risk-score`) have no golden fixtures and no contract.
- **Outdated UI stack**: `public/vendor/jquery-1.9.1.min.js` (2013, EOL) and Bootstrap 2.x drive the Held Payments screen (`views/exceptions.ejs`). No Meridian Design Language 3.0 tokens are applied.
- **No authentication layer**: all 11 routes — including the payment-status and risk-score APIs used by downstream teams — are publicly accessible with no middleware, no API key validation, and no session management.

**Why this is worth doing now:** the AP hotline absorbs ~340 vendor status calls per week because the API cannot be safely surfaced to a self-serve channel. Shipping a clean, tested API unblocks that deflection; the SQL injection backlog is a reportable PCI-DSS finding that cannot remain open.

## Target state

The console modernizes in-place on the existing Node/Express/EJS stack (no framework migration). The Held Payments screen is restyled to Meridian Design Language 3.0 tokens. The `GET /api/payment-status` and `GET /api/risk-score` endpoints are replaced with a modern, parameterized, authenticated service. An AI assistant channel (chat/voice) is wired to the modernized API under scoped identity so routine vendor inquiries self-serve without the AP hotline.

**Workstreams**

1. **Backend remediation** — Replace the legacy payment-status/risk API with parameterized queries, env-based config, input validation (`express-validator`), security headers (`helmet`), and an equivalence-proven test suite; deprecate but keep legacy endpoints mounted.
2. **Frontend redesign** — Restyle the Held Payments screen to Meridian Design Language 3.0; no logic changes.
3. **Agent enablement** — Expose the modernized API as an MCP/OpenAPI tool; wire a watsonx Orchestrate agent with scoped read-only identity; surface the chat widget on the console.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Backend: modernize payment-status + risk APIs | `server.js` routes `/api/payment-status`, `/api/risk-score`; new env config; equivalence suite under `tests/golden/` | All 13+ SQL concatenations in scope replaced with parameterized queries; golden tests capture ≥20 cases; equivalence suite reports 0 diffs; `npm test` green; credentials read from `process.env` | 2026-08-18 |
| 2 | Frontend: Held Payments screen redesign | `views/exceptions.ejs`, `public/payops.css`; no route logic changes | Figma design approved; implemented screen matches approved design (verified screenshot); Bootstrap 2 / jQuery 1.9.1 removed from this view; WCAG 2.2 AA contrast and focus order pass | 2026-08-20 |
| 3 | Agent enablement | MCP/OpenAPI spec for modernized APIs; watsonx Orchestrate agent; scoped read-only identity; console chat widget | Authorized call succeeds; unauthorized write call refused and refusal logged; smoke-test output (2 PASS lines) in PR body | 2026-08-22 |

## Out of scope

- `/reports`, `/reports/export.csv`, `/api/exceptions.xml`, `/exceptions`, `/exceptions/:id`, `/exceptions/:id/resolve`, `/dashboard`, `/help` — security remediation is a separate epic tracked by the Security team.
- Authentication layer for the console UI screens — no session/IdP integration in this phase.
- Database migration, ORM adoption, or schema changes.
- HTTPS termination — handled at the load-balancer layer, not in the app.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` (`server.js` lines 525–625) |
| **Input matrix** | Nominal ref/invoice lookups; not-found (404); missing-param (400); each status code (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED); each risk band (LOW, MED, HIGH); boundary: amount 0, max-length ref, non-ASCII ref; authz: unauthenticated caller refused |
| **Golden capture** | Before any code change, a capture script exercises the legacy endpoints and writes fixtures to `tests/golden/payment-status/` and `tests/golden/risk-score/`. Fixtures committed on the same commit as the test suite, with no code change yet. |
| **Comparison** | HTTP status code; every JSON field including `retcode`, `asOfDate`; monetary values to the cent (`amt_cents`); date string format (`YYYY-MM-DD`); error keys (`ERR`, `msg`) and their exact values |
| **Intended differences** | Field names normalized to camelCase per plan (mapping table in subtask 1 description); `asOfDate` sourced from `process.env.AS_OF_DATE` instead of hardcoded literal — documented as authorized change |
| **Exit criteria** | ≥20 input cases; 0 unexplained diffs; legacy endpoints remain mounted (deprecated header) until agent smoke tests pass; legacy retirement noted in change log |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Modernize in-place on Node/Express/EJS | Rewrite in a new stack (Next.js, FastAPI) | Minimizes blast radius; behavioral equivalence is easier to prove against the same runtime; no retraining required for AP clerks |
| Keep legacy endpoints mounted (deprecated) | Remove legacy on cutover | Downstream teams (3) depend on the current field names; a parallel run window is required to confirm 0 diffs before retirement |
| Parameterized queries via `better-sqlite3` prepared statements | ORM (Sequelize, Prisma) | ORM is not on the approved-library list (rule 04); prepared statements are the approved pattern |
| Agent identity scoped read-only to the two status APIs | Broader write scope | Rule 11 requires minimum scope; AP hotline use case is read-only status inquiry |
| PR target: `demo-integration` branch | `main` | Specified by requester |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | *(pending)* |
| **Date** | *(pending)* |
| **Recorded on** | KAN-30 |
