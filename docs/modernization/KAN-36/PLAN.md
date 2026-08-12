<!-- TEMPLATE: modernization plan -->
<!-- Write to docs/modernization/KAN-36/PLAN.md. Append-only once committed. -->

# KAN-36 — Modernization plan: AP Payment Operations Console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-36 |
| **Author** | bobdev |
| **Date** | 2026-08-12 |
| **Status** | Awaiting approval |

## Current state

- **Eleven of fifteen route handlers build SQL by string concatenation**, making every user-supplied parameter (status, ptype, search query, record id, ref, invoice) an injection vector (`server.js:155, 160, 163–165, 225, 292–299, 535, 537, 597`). The lone parameterized call is the `notes` insert at `server.js:306`.
- **Two credentials are hardcoded in source**: SMTP password (`meridian2013!`) and ERP API key (`ERP-POLL-KEY-8842`) at `server.js:44, 49`. Neither is read from the environment.
- **No authentication on any route**: the full held-payments queue, the detail/resolve form, the JSON status API, the risk-score API, and the ERP XML feed are all publicly reachable without a credential (`server.js:97–714`).
- **Held Payments screen (`views/exceptions.ejs`, `views/detail.ejs`) is built on Bootstrap 3 and jQuery 1.9.1** (EOL since 2015), with no keyboard navigation, color-only risk indicators, and unlabelled form controls — materially below WCAG 2.2 AA.
- **No test coverage exists** anywhere in the repository; there are no test files. Any replacement must introduce the first test suite.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor status calls per week that the current tooling cannot deflect. Replacing the payment-status and risk-score APIs with a modern, documented, agent-accessible service directly reduces that load. The SQL injection exposure and hardcoded credentials are reportable PCI-DSS / SOX findings the moment an auditor inspects `server.js`.

## Target state

The Held Payments screen is rebuilt to the Meridian Design Language 3.0 spec: accessible, keyboard-navigable, token-driven, served by parameterized queries. The `/api/payment-status` and `/api/risk-score` endpoints are replaced with a modern service layer (validated inputs, typed JSON, env-based config, equivalence-proven). The new APIs are exposed as MCP tools and registered on watsonx Orchestrate so vendor status inquiries can be self-served via chat and voice, governed by scoped identity (read-only, no write scope). Legacy endpoints remain mounted and deprecated until the equivalence suite is green and the agent channel is verified.

**Workstreams**

1. **Frontend** — Rebild Held Payments queue and detail to MDL 3.0; fix SQL injection on all UI-serving routes; replace jQuery/Bootstrap 3 with approved stack.
2. **Backend API** — Replace `/api/payment-status` and `/api/risk-score` with parameterized, validated, typed replacements; move secrets to env; golden-test equivalence.
3. **Agent enablement** — Expose the modern API as MCP tools, deploy to watsonx Orchestrate, bind to existing voice channel, verify identity boundary.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Frontend: Held Payments MDL 3.0 | `views/exceptions.ejs`, `views/detail.ejs`, `public/payops.css`, `public/payops.js`; fix SQL on `/exceptions` and `/:id/resolve` handlers | Screen matches approved Figma spec (colour, type, spacing checked vs `docs/design/KAN-36-after.png`); all filter/search interactions work; keyboard-navigable table (Tab, Enter, arrow keys); WCAG 2.2 AA contrast; `npm test` green | 2026-08-18 |
| 2 | Backend API: payment-status & risk-score modernization | New handlers for `/api/v2/payment-status` and `/api/v2/risk-score`; parameterized queries; `express-validator` input validation; secrets via `process.env`; compliance headers | Equivalence suite: ≥40 golden cases, 0 unexplained diffs vs legacy; `npm test` green; no string-concatenated SQL; no hardcoded secrets; legacy v1 endpoints still mount (deprecated) | 2026-08-20 |
| 3 | Agent enablement: MCP tools + watsonx Orchestrate | MCP server wrapping v2 API; tool definitions for `getPaymentStatus` and `getRiskScore`; Orchestrate agent registration; voice binding; identity boundary verification | Agent answers `getPaymentStatus` and `getRiskScore` correctly; authorized read succeeds; unauthorized write is refused with quoted error; smoke test output in PR body | 2026-08-26 |

## Out of scope

- `/api/exceptions.xml` ERP feed — consumed by a batch bridge not controlled by this team; retired in a separate epic after downstream teams migrate.
- `/reports` and `/reports/export.csv` — UI modernization only; functional changes require a separate finance-reporting epic.
- Authentication and session management — no auth layer currently exists; adding one is a larger ITGC change requiring its own SOX control record and is out of scope for Phase 1. Phase 1 retains the current (no-auth) posture and does not widen it.
- Dashboard (`/`) redesign — not on the Held Payments screen; addressed in Phase 2.
- CSV injection hardening in export — low risk relative to the SQL injection issues; deferred to Phase 2.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` (server.js:525–586), `GET /api/risk-score` (server.js:588–625) |
| **Input matrix** | Nominal: valid ref, valid invoice; boundary: unknown ref, unknown invoice, missing required param; status variants: PENDING, REVIEW, HOLD, ESCALATED, RESOLVED; risk bands: HIGH, MED, LOW; data quirks: null `resolved_date`, null `clerk_id`, `bank_chg_days > 0`, `over_approval_limit` flag |
| **Golden capture** | Capture script exercises the matrix against the running legacy server before any modification; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` |
| **Comparison** | HTTP status code; all JSON fields present in legacy response; monetary precision (cents integer, no rounding); date strings (YYYY-MM-DD format); `retcode` and error body for rejection paths |
| **Intended differences** | Field names rationalized (e.g. `sts` → `status`, `amt_cents` → `amountCents`) — documented mapping in subtask 2 PR; excluded from diff comparison |
| **Exit criteria** | ≥40 cases executed; zero unexplained differences; legacy v1 endpoints retired only after subtask 3 is merged and agent smoke test passes |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Modernize in place (same repo, same Express server) | Extract to a new microservice | No separate deployment pipeline exists; in-place keeps the SOX change footprint minimal and the demo deterministic |
| Expose agent channel as MCP tools over the v2 API | Direct DB access from the agent | Keeps the agent outside the data layer; identity boundary is enforced at the API, not assumed in the agent's reasoning |
| Legacy v1 endpoints remain mounted (deprecated) through all subtasks | Remove immediately | Three downstream teams consume v1; removal requires their sign-off and is a separate change |
| Bootstrap 3 + jQuery 1.9.1 replaced with MDL 3.0 tokens + vanilla JS | Upgrade to Bootstrap 5 | MDL 3.0 is the Meridian design system; Bootstrap 5 is not; using both would produce two competing token sets |
| Authentication deferred | Add basic auth in Phase 1 | Adding auth changes the API contract for all three downstream consumers and requires a SOX ITGC access-control record; it cannot be a side effect of a UI modernization |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | *(pending)* |
| **Date** | *(pending)* |
| **Recorded on** | KAN-36 |
