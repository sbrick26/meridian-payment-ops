# KAN-69 — Modernization plan: Payment-status service + AI agent exposure

| | |
|---|---|
| **Epic** | KAN-69 |
| **Author** | bobdev |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- Both JSON API endpoints build SQL by string concatenation (`server.js:535–538, 597`), creating a direct SQL-injection path on `ref` and `invoice` parameters; no input validation exists anywhere in the service.
- All config is hardcoded as `var` globals at top of `server.js` (lines 32–54), including two production credentials: SMTP password `meridian2013!` (line 44) and ERP API key `ERP-POLL-KEY-8842` (line 49) — a PCI-DSS Req. 3 violation.
- No tests of any kind exist; zero coverage across the entire application.
- `APPROVAL_LIMIT_CENTS` and `AS_OF_DATE` are hardcoded scalars (`server.js:38, 53`); the as-of date has been static since at least 2026-08-01, meaning `asOfDate` in every response is stale.
- Three downstream consumers reference the endpoints (`views/detail.ejs`, `views/help.ejs`, `utils.js`); the README documents neither response shape nor field semantics — creating integration risk for any change.
- The risk-scoring model (`scoreRow`, `server.js:469–516`) is inline business logic with no test coverage and a `TODO` comment in `utils.js:160` noting that `age_days` uses calendar days, not business days, since 2014.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor calls per week because no self-serve channel can safely call these endpoints. The injection vulnerabilities and hardcoded credentials are open findings under PCI-DSS Req. 6.5.1 and Req. 3; they cannot ship to a public agent channel unremediated.

## Target state

`GET /api/payment-status` and `GET /api/risk-score` are replaced by equivalence-proven counterparts at `routes/api-v2.js`, using parameterized queries, `express-validator` input guards, and `process.env`-sourced config. Legacy endpoints stay mounted with a `Deprecation` header until downstream teams migrate. A governed AI agent (watsonx Orchestrate, read-only identity) exposes both endpoints as tools over MCP, enabling vendor self-service via chat and voice.

**Workstreams**

1. **Service modernization** — replace the two endpoints; prove equivalence; move credentials to env; add jest + supertest suite.
2. **Agent enablement** — expose modernized service through a scoped MCP endpoint; deploy watsonx Orchestrate agent; demonstrate read-allowed / write-refused boundary.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Golden-test capture | Capture legacy responses to `tests/golden/` before any code change | Golden fixtures committed; `npm test` (golden suite) green against unmodified legacy; 0 unexplained diffs | 2026-08-14 |
| 2 | Service v2 — parameterized queries + env config | `routes/api-v2.js`; move all config to `.env`; `express-validator` guards; remove hardcoded credentials | Equivalence suite: ≥ 20 cases, 0 unexplained diffs; legacy endpoints still mount with `Deprecation` header; `npm test` green | 2026-08-18 |
| 3 | Agent MCP endpoint + Orchestrate deployment | `routes/mcp-endpoint.js` (from template); `ops_deploy_agent` verifies read-allowed / write-refused | Agent named; phone number bound; authorized read returns data; write attempt returns 403 with identity and missing scope | 2026-08-20 |

## Out of scope

- Any UI change — the epic explicitly excludes a UI build; the Figma frames are a concept mock only.
- `GET /api/exceptions.xml` ERP feed — not consumer-facing; retirement of that endpoint is a separate downstream coordination effort.
- `age_days` business-day correction (`utils.js:160`, INC-44192) — deliberate exclusion from equivalence scope (see below); tracked separately.
- Retirement of legacy `/api/payment-status` and `/api/risk-score` — kept mounted with `Deprecation` header until the three downstream teams confirm migration.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal (ref lookup, invoice lookup); 404 not-found; 400 missing-ref; boundary (max field lengths, zero-cent amount, null clerk); authorization variants (no auth currently — equivalence checks open access parity); known data quirk: `amt_cents` returned as string, `age_days` returned as string |
| **Golden capture** | Captured from unmodified `server.js` before Subtask 2 begins; fixtures at `tests/golden/payment-status/` and `tests/golden/risk-score/`; committed in Subtask 1 |
| **Comparison** | HTTP status code; every response field by name and value; monetary string formatting (`Amount_Formatted`, `amt_cents` as string); date field format (YYYY-MM-DD); error codes (`ERR`, `msg`); field ordering (downstream consumers parse positionally) |
| **Intended differences** | `asOfDate` will be sourced from `process.env.AS_OF_DATE` — value will differ if the env is updated; excluded from comparison with a note in the test output |
| **Exit criteria** | ≥ 20 cases executed; 0 unexplained diffs; both legacy endpoints confirmed mountable with `Deprecation` header; legacy retirement tracked in a separate ticket |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Side-by-side (`routes/api-v2.js`) rather than in-place rewrite of `server.js` | In-place rewrite of existing handlers | Preserves legacy endpoints for downstream migration; allows equivalence suite to run both simultaneously |
| Parameterized queries via `better-sqlite3` prepared statements | ORMs (Sequelize, Knex) | Approved library; minimal surface change; risk-score model reads same columns |
| Credentials to `process.env` / `.env` via `dotenv` | Vault / external secrets manager | `dotenv` is on the approved list; Vault integration is an infrastructure decision outside this epic's scope |
| Agent is read-only (`payment-status`, `risk-score` tools only) | Exposing release/resolve operations | Rule 11(b): write scope requires named written approval; not sought for this epic |
| `age_days` calendar-day behaviour preserved as-is | Correcting to business days | INC-44192 (open since 2014) is a separate change requiring reference-data team input; correcting it here would make the equivalence suite red |

## Open items

None.

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-69 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-69 BEFORE / KAN-69 AFTER frames — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian-Demo |
