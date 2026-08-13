# KAN-51 — Modernization plan: AP Payment Operations Console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-51 |
| **Author** | bobdev |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- **All 11 routes are defined inline in a single 731-line file with zero test coverage.** Every user-facing query and all three API endpoints build SQL by string concatenation, not parameterisation — 9 injection-vulnerable locations across `server.js` (lines 155, 160, 163–165, 225, 292–299, 365, 535–537, 597, 632). No test file exists (`server.js`, `package.json`).
- **UI stack is 2013-era and inaccessible.** The front-end loads jQuery 1.9.1 (EOL 2013) and a custom Bootstrap 2.x intranet subset (`views/partials/header.ejs`). Status, risk, and age are communicated by colour alone with no text labels — WCAG 2.1 Level A failures across `views/exceptions.ejs`, `views/detail.ejs`, `views/dashboard.ejs`.
- **Credentials are hardcoded in source.** SMTP password (`meridian2013!`) and ERP feed key (`ERP-POLL-KEY-8842`) are plaintext literals in `server.js` lines 41–44 and 48–49 — a PCI-DSS Req. 3 finding.
- **No authentication and no audit trail.** Every endpoint is reachable without credentials. Payment state changes via `POST /exceptions/:id/resolve` are executed with `db.exec()` (raw unparameterised SQL, line 300) and produce no mandatory audit record (`server.js` lines 260–311).
- **Two APIs drive downstream consumers and the AP hotline.** `GET /api/payment-status` and `GET /api/risk-score` are queried by three downstream teams and answer ~340 vendor calls/week (`views/help.ejs`). Both are SQL-injectable and unauthenticated; modernising them is the prerequisite for adding an AI self-service channel.

**Why this is worth doing now:** The console is a direct control over financial disbursements, operates without authentication or injection defences, and absorbs 340 hotline calls per week that a governed AI assistant channel could deflect. Doing nothing leaves a SOX-reportable SQL injection in the payment-release path for another release cycle.

## Target state

Held Payments queue rendered in Meridian Design Language 3.0 — status and risk as labelled chips, no colour-only indicators, no jQuery/Bootstrap 2 dependencies. The two payment-status APIs replaced by a parameterised, validated, well-tested v2 service. Credentials moved to environment variables. An AI assistant channel (chat + voice) queries the modernised API under a scoped, auditable identity so vendors can self-serve status enquiries without calling the hotline.

**Workstreams**

1. **Frontend** — Replace legacy stylesheet and jQuery with MDL 3.0 (`public/mdl-3.css`) on the Held Payments view; fix WCAG colour-only violations with labelled status and risk chips.
2. **Backend API v2** — Rewrite `/api/payment-status` and `/api/risk-score` with parameterised queries, `express-validator` input validation, typed JSON, and an equivalence suite proving 0 behavioural diffs.
3. **Agent enablement** — Expose the modernised API via MCP/OpenAPI; deploy a scoped watsonx Orchestrate agent with read-only identity; bind to voice channel.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Frontend: MDL 3.0 Held Payments view | `views/exceptions.ejs`, `views/partials/header.ejs`, `public/mdl-3.css` link | jQuery 1.9.1 and Bootstrap 2 tags removed; status and risk shown as labelled chips matching spec; fidelity screenshot matches `docs/design/KAN-51-after.png`; `npm test` green | 2026-08-15 |
| 2 | Backend: payment-status and risk-score API v2 | `server.js` new v2 routes, `tests/golden/`, equivalence suite | All SQL uses prepared statements; `express-validator` on every input; golden suite reports ≥30 cases, 0 diffs; legacy endpoints deprecated but not removed; `npm test` green | 2026-08-19 |
| 3 | Agent enablement | MCP/OpenAPI descriptor, vault identity, Orchestrate agent, voice binding | Agent authenticates as scoped identity; authorised read succeeds; unauthorised write refused (quoted refusal in PR); phone number unchanged | 2026-08-21 |

## Out of scope

- Dashboard, Reports, Detail, Help pages — not touched in Phase 1; separate epic if needed.
- Hard-delete or schema migration of `exceptions` or `notes` tables — financial records; retention governed by Legal/Compliance.
- HTTPS/TLS enforcement — requires infra team; flagged as a follow-on risk item.
- Rate limiting and CSP headers — important but not blocking Phase 1; separate ticket.
- Authentication/session management — full auth redesign is a Phase 2 epic.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal lookup by `ref` and by `invoice`; non-existent ref; all seeded status values (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED); all risk bands (HIGH, MEDIUM, LOW); over-limit flag; null/empty params; each currency (USD, EUR, GBP, SGD) |
| **Golden capture** | Captured from legacy server before any modification via `tests/golden/capture.js`; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` |
| **Comparison** | HTTP status code; every JSON field by name; monetary precision (cents integer); date strings verbatim; `retcode`; `risk` / `BAND` values |
| **Intended differences** | Field names rationalised (e.g. `sts` → `status`, `amt_cents` kept); documented in subtask 2 PR body and excluded from suite |
| **Exit criteria** | ≥30 cases executed, 0 unexplained diffs; legacy routes deprecated (not removed) once suite is green |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Rewrite v2 routes in-place in `server.js` alongside legacy, not a new file | Separate `routes/api-v2.js` file | Minimises diff size for SOX change review; existing KAN-39 pattern established this |
| MDL 3.0 applied via existing `public/mdl-3.css` stylesheet link, not new CSS authored per-run | Generate new CSS from spec | Design system in a committed file can be reviewed and is deterministic between runs |
| Agent gets read-only scope only (no write) | Write scope for RELEASE/HOLD actions | Rule 11(b): write scope requires written approval from service owner; not sought in this epic |
| Keep legacy endpoints mounted (deprecated) for Phase 1 | Remove legacy routes immediately | Three downstream teams consume them; retirement requires a coordinated cutover outside this scope |

## Open items

_(none — no blockers)_

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-51 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending — approver of this plan reviewed BEFORE/AFTER frames attached to KAN-51) |
| **Date** | (pending) |
| **Reviewed** | KAN-51 BEFORE / AFTER frames, https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/ |
