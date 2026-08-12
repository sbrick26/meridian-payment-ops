# KAN-32 — Modernization plan: Held Payments screen + payment-status/risk API

| | |
|---|---|
| **Epic** | KAN-32 |
| **Author** | bobdev |
| **Date** | 2026-08-12 |
| **Status** | Awaiting approval |

## Current state

- **SQL injection in every user-facing query** (`server.js` lines 155, 160, 163–165, 225, 233, 238, 292–299, 535, 537, 597): `status`, `ptype`, `q`, `id`, `ref`, and `invoice` are concatenated directly into query strings. The sole safe query is the `INSERT INTO notes` prepared statement at line 306.
- **Hardcoded production credentials** (`server.js` lines 43–44, 49): SMTP password `meridian2013!` and ERP API key `ERP-POLL-KEY-8842` are literal strings; `dotenv` is not installed; no `process.env` usage anywhere in the file.
- **Zero approved security middleware**: `helmet` (HTTP security headers) and `express-validator` (input validation) are on the Meridian approved list but absent from `package.json`. No `X-Frame-Options`, `Content-Security-Policy`, or HSTS headers are set.
- **Legacy UI without design tokens**: `views/exceptions.ejs` and `public/payops.css` use a Bootstrap 2 / jQuery 1.9.1 stack with hardcoded hex values (e.g., `#9d261d`, `#a47e3c`, `#fbf0ee`); no Meridian Design Language 3.0 tokens are applied; row-level risk indication is color-only (WCAG AA failure).
- **No test coverage**: no test directory, no jest config, no golden fixtures for either API endpoint.
- **AI channel not wired**: `GET /api/payment-status` and `GET /api/risk-score` are unauthenticated and SQL-injectable; they cannot be safely exposed to an assistant channel in their current state.

**Why this is worth doing now:** the AP hotline absorbs ~340 vendor status calls per week because the API is not safely surfaceable. The SQL injection backlog is an open PCI-DSS Req. 6.5.1 finding. Both can be closed in one focused modernization slice.

## Target state

The console stays on the existing Node/Express/SQLite/EJS stack (no framework migration). The Held Payments screen (`GET /exceptions`) is restyled to Meridian Design Language 3.0 tokens. The two API endpoints (`/api/payment-status`, `/api/risk-score`) are replaced with parameterized, validated, authenticated implementations and an equivalence-proven test suite. An AI assistant channel (watsonx Orchestrate, voice-capable) is wired to the modernized API under scoped read-only identity so routine vendor inquiries self-serve without the AP hotline.

**Workstreams**

1. **Backend remediation** — Parameterized queries, `dotenv` + `helmet` + `express-validator`, equivalence-proven test suite, deprecated-but-mounted legacy endpoints.
2. **Frontend redesign** — MDL 3.0 restyling of `views/exceptions.ejs`; no route or data logic changes.
3. **Agent enablement** — MCP/OpenAPI tool layer on the modernized API, watsonx Orchestrate agent with scoped read-only identity, console chat widget.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | **Backend: modernize payment-status + risk APIs** | `server.js` `/api/payment-status` and `/api/risk-score`; install `dotenv`, `helmet`, `express-validator`; golden suite in `tests/golden/` | All SQL concatenations in scope replaced with `db.prepare().get()` placeholders; golden tests ≥20 cases, 0 diffs; `npm test` green; secrets read from `process.env`; `helmet()` mounted; `express-validator` validates `ref`/`invoice` inputs | 2026-08-18 |
| 2 | **Frontend: Held Payments screen redesign** | `views/exceptions.ejs`, `public/payops.css`; MDL 3.0 tokens only; no route changes | Approved design spec (`docs/design/KAN-32-spec.md`) implemented verbatim; fidelity screenshot matches AFTER frame; WCAG 2.2 AA contrast and keyboard focus order pass; risk indication has text label in addition to color | 2026-08-21 |
| 3 | **Agent enablement** | MCP/OpenAPI spec for modernized APIs; watsonx Orchestrate agent; scoped read-only identity; console chat widget | Authorized read call succeeds; unauthorized write refused and refusal logged (quoted in PR); smoke-test output (2 PASS lines) in PR body | 2026-08-26 |

## Out of scope

- All other routes (`/exceptions` list/detail/resolve, `/reports`, `/api/exceptions.xml`, `/dashboard`) — security remediation on those routes is a separate tracked effort.
- Authentication layer for the console UI — no session/IdP integration in this phase.
- Database schema changes, ORM adoption, or migration tooling.
- HTTPS termination — handled at the load-balancer layer.
- Mobile/responsive breakpoints — this is an internal operator console.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` (`server.js` lines 525–586) and `GET /api/risk-score` (`server.js` lines 588–625) |
| **Input matrix** | Nominal: known `ref` + known `invoice`; not-found 404 (unknown ref); missing-param 400 (neither ref nor invoice); each status value (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED); each risk band (LOW, MED, HIGH); boundary: zero-amount record, max-length `ref` (60 chars), numeric-only `ref`; data quirks: `bank_chg_days = -1` (never changed) |
| **Golden capture** | Before any code change: script `scripts/capture-golden.js` exercises legacy endpoints across the matrix and writes JSON fixtures to `tests/golden/payment-status/` and `tests/golden/risk-score/`. Fixtures committed on a separate commit before the first code change. |
| **Comparison** | HTTP status code; every JSON response field including `retcode`, `asOfDate`, `amt_cents` (exact integer); date strings in `YYYY-MM-DD` format; error key names (`ERR`, `msg`) and their exact string values |
| **Intended differences** | Field names normalized to camelCase in the new API (mapping table committed in subtask 1 PR description); `asOfDate` sourced from `process.env.AS_OF_DATE` rather than hardcoded literal — both changes documented here and excluded from the diff check |
| **Exit criteria** | ≥20 matrix cases executed; 0 unexplained diffs; legacy endpoints remain mounted with `Deprecation` response header until agent smoke tests pass; legacy retirement recorded in change log |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Modernize in-place (Node/Express/SQLite/EJS) | Rewrite in a new stack | Minimizes blast radius; equivalence is provable against the same runtime; no retraining for AP clerks |
| Scope only `/api/payment-status` and `/api/risk-score` for backend in this epic | Remediate all 13 injection sites simultaneously | Risk-stratified delivery: these two endpoints are the AI channel blocker; other routes are tracked separately |
| Deprecate-not-delete legacy endpoints | Hard-remove immediately | Agent smoke tests must pass before the legacy path retires; keeps demo rollback safe |
| Agent gets read-only scope at deployment | Write scope from day one | Rule 11 requires written approval for any write scope; read-only is the correct default |
| Figma design frames pending bridge reconnection | Block plan approval on design | Per workflow rule: plan is the approval gate; design is evidence attached to it; bridge outage does not block the plan |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | |
| **Date** | |
| **Recorded on** | KAN-32 |
