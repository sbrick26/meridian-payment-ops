# KAN-66 — Modernization plan: AP Payment Operations Console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-66 |
| **Author** | IBM Bob (AI modernization engine) |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- All 11 routes build SQL by string concatenation — every user-supplied parameter is injection-ready (`server.js:155–166, 225, 292–299, 535–537, 597, 632`). The sole parameterized query in the codebase is a single INSERT for notes (`server.js:306`).
- Four credentials are hardcoded in source: SMTP password `meridian2013!`, ERP feed key `ERP-POLL-KEY-8842`, SMTP user, and SMTP host (`server.js:41–49`). No environment-variable pattern exists anywhere in the file.
- The three external APIs — `/api/payment-status`, `/api/risk-score`, `/api/exceptions.xml` — are unauthenticated and publicly reachable; field names mix cases arbitrarily (`sts`, `PaymentRef`, `amt_cents`) with no version prefix (`server.js:525–674`).
- The Held Payments view (`views/exceptions.ejs`) conveys risk solely by row background colour (#fbf0ee), which fails WCAG 1.4.1 and vanishes in monochrome. Body text is 10–11px, failing the MDL 3.0 minimum of 13px. `public/mdl-3.css` is committed but not loaded.
- Zero test coverage across all routes and the APRSK01 risk-scoring logic (`server.js:407–516`). No test runner in `package.json`.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor status calls per week that the current tooling cannot deflect. The unauthenticated APIs and SQL injection surface are a PCI-DSS and SOX 404 risk that blocks any external exposure; fixing them is the prerequisite for an AI agent channel and for the downstream teams that consume the status API.

## Target state

The console's Held Payments experience is restandardized on Meridian Design Language 3.0: status and risk expressed as labelled chips, accessible contrast and type sizes, the MDL 3.0 stylesheet applied. The legacy `/api/payment-status` and `/api/risk-score` are replaced by a versioned, parameterized, scoped-identity API v2 with `snake_case` field names; the `/api/exceptions.xml` ERP feed gains request authentication. A watsonx Orchestrate agent with an inbound voice line deflects routine vendor status queries using the new API.

**Workstreams**

1. **Backend API v2** — replace legacy payment-status and risk-score endpoints with parameterized queries, validated inputs, `snake_case` JSON, and scoped-identity auth; deprecate v1 with 30-day sunset; authenticate the XML ERP feed.
2. **Agent enablement** — publish MCP endpoint over API v2; deploy watsonx Orchestrate agent with chat and voice (phone binding); prove identity boundary.
3. **Frontend MDL 3.0** — load `public/mdl-3.css`, add status/risk `.chip` markup, remove hardcoded credentials, delete Bootstrap 2 / jQuery 1.9.1 vendor refs in the held-payments view.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Backend API v2: payment-status and risk-score | `server.js` — new `/api/v2/payment-status`, `/api/v2/risk-score`; migrate XML feed auth; deprecate v1 | Golden suite: ≥40 cases, 0 unexplained diffs. All queries parameterized. Credentials in `process.env`. v1 returns `Deprecated` header with sunset date. XML feed rejects requests lacking valid `X-ERP-Key` header. `npm test` green. | 2026-08-15 |
| 2 | Agent enablement: MCP endpoint + Orchestrate agent | New `/mcp/payment-ops` route; agent definition; vault credential; voice binding | `ops_deploy_agent` reports: health check HTTP 200, authorized read succeeds, write refused. Agent responds to payment-status query on chat and voice. Identity boundary proof in PR body. | 2026-08-19 |
| 3 | Frontend: Held Payments MDL 3.0 | `views/exceptions.ejs`, `views/partials/header.ejs` | MDL 3.0 stylesheet loaded. Every risk/status cell uses `.chip` markup (no color-only rows). WCAG 1.4.1 passes for risk/status. Body text ≥13px. Bootstrap 2 / jQuery 1.9.1 vendor tags removed from this view. Fidelity check passes against `docs/design/KAN-66-after.png`. `npm test` green. | 2026-08-21 |

## Out of scope

- Dashboard, reports, detail, and help views — not touched in Phase 1; accumulated debt documented for Phase 2.
- Server-side authentication / session management (login, roles) — a dedicated auth epic is required; this plan adds API key scoping only.
- Database encryption at rest — infrastructure change, separate track.
- Hard deletion of any financial record — prohibited by rule 05; not planned.
- Migration off SQLite — architecture decision deferred to Phase 2 scoping.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score`; field-name normalization to `snake_case` is the only intentional difference |
| **Input matrix** | Nominal (valid `ref`, valid `invoice`); boundary (missing both params, non-existent ref, longest valid ref); all seeded status values (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED); each risk band (LOW, MED, HIGH); APRSK01 scoring factors (round dollar, new vendor, bank change, duplicate flag) |
| **Golden capture** | Captured via `scripts/capture-golden.js` against the unmodified server before any code change; fixtures committed to `tests/golden/` on the subtask branch |
| **Comparison** | HTTP status code; all response fields matched by `snake_case` equivalent (mapping table in subtask 1 PR body); monetary precision (cents integer, 2dp formatted); date strings; error codes and messages |
| **Intended differences** | Field names normalized to `snake_case` (e.g. `PaymentRef` → `payment_ref`); `retcode`/`asOfDate` removed in v2 (replaced by HTTP status); listed explicitly in subtask 1 PR |
| **Exit criteria** | ≥40 cases executed, 0 unexplained diffs; suite runs in CI; v1 legacy path remains mounted (deprecated) until sunset date 30 days after v2 merges |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Backend (subtask 1) ships before frontend (subtask 3) | Frontend first | API is the prerequisite for agent channel; unblocks downstream teams immediately |
| `snake_case` field names in v2 | Preserve legacy mixed-case names | Downstream consumers prefer consistency; legacy consumers use v1 through sunset |
| Deprecate v1 with 30-day sunset, not retire immediately | Immediate retirement | Gives three downstream teams time to migrate; reduces incident risk |
| Authenticate XML ERP feed in Phase 1 | Defer to Phase 2 | Feed has no auth at all today and runs overnight payables; exposure is active |
| Reuse `public/mdl-3.css` as committed stylesheet | Author per-epic CSS | Stylesheet is already committed with correct tokens; re-authoring produces drift |
| Chat + voice in scope for agent channel | Chat-only | Epic explicitly requires voice deflection of the ~340 weekly AP hotline calls |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-66 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-66 BEFORE / AFTER frames — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian%20Demo (page: KAN-66 - Held Payments Modernization) |
