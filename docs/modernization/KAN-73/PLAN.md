# KAN-73 — Modernization plan: payment-status service and AI agent

| | |
|---|---|
| **Epic** | KAN-73 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- Both public API endpoints build SQL by string concatenation: `ref` and `invoice` interpolated directly into queries (`server.js:535-537`, `server.js:597`). The same pattern affects 10 additional locations across all UI routes.
- No authentication on any route — every endpoint, including financial data APIs, is open to any network caller (`server.js:525`, `server.js:588`, `server.js:628`).
- SMTP password (`meridian2013!`) and ERP feed key (`ERP-POLL-KEY-8842`) are hardcoded in source and the feed user is re-rendered on the public `/help` screen (`server.js:41-50`, `views/help.ejs`).
- Zero test coverage — no test files, no test script in `package.json`.
- ~340 vendor status calls per week land on the AP hotline because no safe self-serve channel exists (`README.md:136`).

**Why this is worth doing now:** Every parameterized query the agent touches is currently injectable; shipping an AI agent on top of an unauthenticated, unparameterized API converts a latent vulnerability into an exploitable external surface. Fixing the service is a prerequisite to the agent, not an optional complement.

## Target state

All SQL across `server.js` uses parameterized prepared statements. Secrets move to `process.env`; credential display is removed from `/help`. The two API endpoints are re-implemented as `/api/v2/payment-status` and `/api/v2/risk-score` with `express-validator` input validation and equivalence-proven parity. Legacy endpoints remain mounted with `Deprecation` headers. A governed AI agent (watsonx Orchestrate, voice and chat) authenticates as `payops-agent@meridian.internal` with read-only scope and provides self-serve vendor inquiry via the modernized endpoints — write operations are permanently refused.

**Workstreams**

1. **Service hardening** — parameterize all SQL, move secrets to env, strip credential display from `/help`, add `express-validator` to v2 routes, capture golden fixtures, ship equivalence suite.
2. **Agent enablement** — deploy MCP endpoint adapter, wire scoped read-only agent identity, prove refusal boundary, bind voice number.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Capture golden responses | `server.js` v1 endpoints, no code changes | Golden fixtures committed to `tests/golden/` before any implementation begins; matrix covers nominal, boundary, error, 404, and known data quirks for both endpoints | 2026-08-14 |
| 2 | Parameterize all SQL + move secrets | All 11 injection sites in `server.js`; `process.env` for SMTP and ERP credentials; remove credential display from `views/help.ejs` | Zero string-concatenated SQL remains; `npm test` (ESLint SQL rule) green; no literal secret in any source file; `/help` no longer renders feed user | 2026-08-14 |
| 3 | Implement v2 API routes + equivalence suite | `routes/api-v2/` for both endpoints; equivalence test in `tests/`; legacy endpoints stay at v1 path with `Deprecation` header | Equivalence suite reports 0 unexplained diffs across ≥30 cases; v2 returns identical shape, field order, monetary precision, and error codes as golden captures | 2026-08-14 |
| 4 | MCP endpoint + agent deployment | `routes/mcp-endpoint.js` (copied from template); watsonx Orchestrate agent with `payops-agent@meridian.internal` identity; vault scope middleware | Agent answers nominal payment-status and risk-score queries; write/release attempt returns the governed refusal verbatim; `ops_deploy_agent` proves boundary | 2026-08-14 |

## Out of scope

- Any changes to UI views (`/exceptions`, `/reports`) beyond SQL parameterization — layout, UX, and feature changes are a separate epic.
- Legacy endpoint retirement — v1 paths stay mounted indefinitely; retirement requires a separate decision by downstream consumer teams (ERPBATCH01, AP desk, unknown risk display).
- Risk-score model changes — the model is preserved field-for-field; model review is a separate engagement.
- Agent write scope — permanently excluded; the boundary is the deliverable.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` → `GET /api/v2/payment-status`, `GET /api/v2/risk-score` |
| **Input matrix** | Nominal ref lookup, nominal invoice lookup, boundary (unknown ref, empty result), error paths (missing param → 400, not-found → 404), high-risk score case, over-limit flag case, new-vendor flag case, round-dollar flag case |
| **Golden capture** | Captured against unmodified `server.js` v1 before Subtask 2 touches any code; fixtures committed to `tests/golden/` as JSON |
| **Comparison** | HTTP status code; every response field by name and value; monetary amounts to the cent; date strings character-for-character; error codes and `msg` field; `retcode` field |
| **Intended differences** | None — v2 preserves behavior exactly |
| **Exit criteria** | ≥30 cases executed; zero unexplained diffs; suite runs in CI; legacy endpoints remain mounted (retirement out of scope) |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| All 11 SQL injection sites fixed in this epic | Fix only the two v2 endpoints | Same `server.js` is touched; leaving 9 injections in production while fixing 2 is a control gap |
| API endpoints remain unauthenticated (network trust) | Add Bearer token to all API routes | Agent identity layer is the governed boundary per decision; internal network trust is the existing model |
| Credential display removed from `/help` entirely | Keep display after value moves to env var | A credential displayed in a browser, even from env, is a credential in a browser |
| Risk-score model preserved exactly, equivalence-tested | Simplify or replace heuristics | Model is in production use by AP controls team; changes require separate review |
| Legacy v1 endpoints stay mounted with `Deprecation` header | Remove v1 after v2 ships | Three downstream consumers with unknown migration timelines; retirement is a separate decision |

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-73 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-73 BEFORE / AFTER frames, https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
