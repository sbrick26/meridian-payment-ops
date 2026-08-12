# KAN-33 — Modernization plan: Held Payments screen and payment-status / risk API

| | |
|---|---|
| **Epic** | KAN-33 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-12 |
| **Status** | Awaiting approval |

## Current state

- **All six user-facing SQL queries build WHERE clauses by string concatenation** — the `/exceptions` list handler (`server.js:154–165`), the detail handler (`server.js:225`), the resolve POST (`server.js:292–300`), `/api/payment-status` (`server.js:535`), `/api/risk-score` (`server.js:597`), and `/reports/export.csv` (`server.js:365`). The one parameterized query in the repo is a notes INSERT (`server.js:306–307`). Every non-parameterized path is a PCI-DSS Req. 6.5.1 violation and a reportable finding.
- **Two credential sets are hardcoded in source** — SMTP password `meridian2013!` (`server.js:44`) and ERP feed API key `ERP-POLL-KEY-8842` (`server.js:49`). Both are committed to Git history. Neither is read from the environment.
- **The `/api/payment-status` and `/api/risk-score` endpoints are unauthenticated** — any caller on the network can enumerate payment records and receive risk scores with no credential (`server.js:525–625`). These two endpoints are the AI agent access channel proposed below.
- **The Held Payments screen uses a custom Bootstrap 2 / jQuery 1.9.1 stack from 2013** (`public/vendor/bootstrap.css`, `public/vendor/jquery-1.9.1.min.js`) with a fixed 940 px grid, no responsive layout, and colour-only risk indication that fails WCAG 2.2 AA contrast requirements (`views/exceptions.ejs:86–96`).
- **Zero test files exist in the repository.** No CI gate, no regression coverage on the 247-item payment queue.

**Why this is worth doing now:** The ERP batch team, the vendor enquiry desk, and a proposed AI assistant channel all consume `/api/payment-status` and `/api/risk-score`. Three downstream consumers sharing an unauthenticated, injection-vulnerable API is an escalating PCI control gap. Remediation before the AI channel goes live avoids exposing a new attack surface on top of an unpatched one.

## Target state

The two JSON APIs are hardened in place: parameterized queries, scoped-identity authentication, input validation, env-based credentials, and structured logging. The Held Payments screen is rebuilt to Meridian Design Language 3.0 with WCAG 2.2 AA compliance, replacing the 2013 Bootstrap 2 stack. The hardened API is wrapped in an MCP server and exposed to a watsonx Orchestrate agent under rule 11 scoped-identity governance, deflecting the 340 weekly vendor hotline calls to self-service. The ERP XML feed and the full resolve workflow are unchanged and remain in service.

**Workstreams**

1. **WS-1 Backend hardening** — Parameterize every SQL query in scope, move credentials to env, add API-key authentication and `express-validator` input validation on the two JSON endpoints.
2. **WS-2 Frontend redesign** — Rebuild the Held Payments screen (`/exceptions`) to MDL 3.0 tokens, replacing Bootstrap 2 / jQuery 1.9.1, fixing WCAG failures, and preserving all filter/sort/pagination behaviour.
3. **WS-3 Equivalence assurance** — Capture golden responses from the legacy APIs before any modification; build and run an automated equivalence suite proving zero unexplained differences.
4. **WS-4 Agent channel** — Wrap the hardened API in an MCP server, deploy to watsonx Orchestrate under scoped read-only identity, and surface a chat/voice channel for vendor status self-service.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | **KAN-33-S1** Golden capture for `/api/payment-status` and `/api/risk-score` | Capture scripts + fixture JSON in `tests/golden/`; input matrix: nominal, boundary, error, authz, data-quirk cases | ≥ 20 fixtures committed; equivalence suite fails against an empty implementation | 2026-08-14 |
| 2 | **KAN-33-S2** Harden `/api/payment-status` and `/api/risk-score` | Parameterized queries, env credentials, `express-validator`, API-key auth, `pino` logging, `helmet` headers | Equivalence suite: ≥ 20 cases, 0 unexplained diffs; `npm test` green; no string-concatenated SQL in scope | 2026-08-18 |
| 3 | **KAN-33-S3** Implement Held Payments screen to MDL 3.0 | Rebuild `views/exceptions.ejs` and supporting CSS to the approved design spec in `docs/design/KAN-33-spec.md` | Fidelity check passes vs `docs/design/KAN-33-after.png`; WCAG 2.2 AA contrast verified; all filter/sort/pagination routes return HTTP 200; `npm test` green | 2026-08-20 |
| 4 | **KAN-33-S4** MCP tool wrapper + watsonx Orchestrate agent | MCP server exposing `get_payment_status` and `get_risk_score` tools; scoped read-only identity per rule 11; write attempt refused and logged | Smoke test: one authorized read succeeds, one write attempt refused with quoted refusal; agent answers on voice channel | 2026-08-26 |

*Due dates are business-day estimates from 2026-08-12. KAN-33-S1 and the design work (part of this plan) are prerequisites for S2 and S3 respectively. KAN-33-S4 depends on S2 being merged.*

## Out of scope

- `/api/exceptions.xml` (ERP XML feed) — no change window available for the ERP batch bridge; stays as-is
- The resolve workflow (`POST /exceptions/:id/resolve`) — SQL injection in the UPDATE statement is documented and will be addressed in a separate SOX-controlled change
- The dashboard, reports, and detail screens — not in the requested first slice
- Business-day age calculation (outstanding since INC-44192) — left for reference data team to unblock

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` (`server.js:525–586`) and `GET /api/risk-score` (`server.js:588–625`) |
| **Input matrix** | Nominal (valid ref, valid invoice), boundary (longest valid ref, zero-amount record, round-dollar HIGH-risk wire, new vendor), error (missing param, not-found ref, not-found invoice), auth variants (pending, escalated, resolved statuses), data quirks (null `bank_chg_days`, multi-currency, H21 hold code) |
| **Golden capture** | KAN-33-S1 runs capture scripts against the **unmodified** legacy app; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` before any line of the modern service is written |
| **Comparison** | HTTP status code; every response field present in both responses, value-equal after documented field mapping; `amt_cents` numeric equality; `SCORE` integer equality; date strings character-equal; error body `ERR` code equal |
| **Intended differences** | Field names normalized (e.g. `sts` → `status`) as documented in KAN-33-S2 plan section; new `X-Request-Id` response header added; 400/404 responses gain an `errors` array from `express-validator` |
| **Exit criteria** | ≥ 20 cases executed, 0 unexplained diffs before KAN-33-S2 PR merges; legacy endpoints remain mounted (deprecated) until equivalence is green |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Modernize in place (Express + better-sqlite3 + EJS) | Full stack replacement (React + REST microservice) | Scope is the first slice; replacing the stack in one pass creates a larger blast radius and a longer equivalence matrix with no incremental value |
| API-key authentication for the two JSON endpoints | OAuth 2.0 / OIDC at this stage | The downstream consumers (enquiry desk tool, proposed Orchestrate agent) can consume a static API key scoped per caller; OAuth would require an IDP integration outside this epic's scope |
| Agent channel read-only by default; write scope not granted | Agent can release/hold payments | Rule 11 requires written approval from service owner for any write scope; that approval is not in hand; read-only is the safe baseline |
| WS-3 frontend targets `/exceptions` list screen only | Redesign detail screen simultaneously | Detail screen has complex form actions tied to the resolve workflow (out of scope); keeping it in would couple WS-3 to the deferred SQL fix |
| AI agent access channel in scope for this epic | Defer agent to a later epic | The 340 weekly hotline calls are the named business driver; deferring the agent channel removes the primary ROI justification for the backend hardening work |

## Open items

*(None — no blockers remain at submission)*

## Approval

| | |
|---|---|
| **Approver** | — |
| **Date** | — |
| **Recorded on** | KAN-33 |
