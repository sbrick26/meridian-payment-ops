# KAN-81 — Modernization plan: payment-status service + governed AI agent

| | |
|---|---|
| **Epic** | KAN-81 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- Both `GET /api/payment-status` and `GET /api/risk-score` build SQL by string concatenation from raw query-string inputs — every query parameter is injectable (`server.js:535,537,597`).
- Six literals are hardcoded in the server: `SMTP_PASS`, `ERP_FEED_KEY`, `DB_FILE`, `PORT`, `PAGE_SIZE`, `FROM_EMAIL` — two are credentials (`server.js:32–54`); no `.env` file is loaded.
- Zero automated tests exist anywhere in the repo; no golden fixtures capture current endpoint behavior.
- `scoreRow` risk logic is a pure function isolated from the DB (`server.js:407–516`), making it safe to lift without touching any query.
- Three downstream consumers call the two target endpoints in production (Vendor Enquiry Desk, Traffic Light System, AP Hotline), all against the existing paths — a safe deprecation header strategy is required.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor status calls per week because nothing self-serve can be safely pointed at this service. A parameterized, equivalence-proven API plus a governed read-only agent eliminates that call volume without touching the legacy UI or ERP feed.

## Target state

`GET /api/v2/payment-status` and `GET /api/v2/risk-score` are re-implemented under `routes/api-v2/` with parameterized queries, `express-validator` input guards, and all six literals read from `process.env`. Legacy paths stay mounted with a `Deprecation` header so downstream consumers migrate on their own schedule. The ERP XML feed is unchanged except its `ERP_FEED_KEY` reference becomes an env read. A governed MCP-layer agent exposes `get_payment_status` and `get_risk_score` as read-only tools; a `release_payment` tool is permanently refused at the scope middleware. The agent answers on web chat and on `+1 (415) 338-9157`.

**Workstreams**

1. **Service** — parameterize the two API endpoints, move all six literals to env, mount equivalence-proven v2 routes alongside legacy.
2. **Agent** — MCP endpoint + Vault-scoped read-only identity, watsonx Orchestrate deployment, phone binding confirmed.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | KAN-81-S1 · Modernize API v2 | `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, `server.js` env migration, `tests/golden/`, equivalence suite | `npm test` green; 0 unexplained diffs vs golden; legacy paths return identical body+status with `Deprecation` header present; all 6 literals gone from source | 2026-08-19 (Tue) |
| 2 | KAN-81-S2 · Governed agent | `routes/mcp-endpoint.js`, `vault/middleware/vault-scope.js`, Orchestrate deploy, phone confirmed | Agent deployed; `get_payment_status` returns live data; `release_payment` returns HTTP 403 with logged denial; phone `+1 (415) 338-9157` confirmed bound | 2026-08-21 (Thu) |

## Out of scope

- Legacy UI routes (`/`, `/exceptions`, `/exceptions/:id/resolve`, `/reports`, `/reports/export.csv`, `/help`) — no query rewrite, no template changes; follow-on epic.
- `/api/exceptions.xml` ERP feed — untouched except the `ERP_FEED_KEY` variable reference changes from a literal to `process.env.ERP_FEED_KEY`; no logic change.
- Retirement of legacy `/api/payment-status` and `/api/risk-score` — deferred; consumers migrate on their own schedule.
- Any new user interface — concept mock in Figma is planning evidence only, not a deliverable.
- Invoice-lookup parity on `/api/risk-score` — risk-score preserves ref-only interface exactly (strict equivalence); extension is a follow-on.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal (ref, invoice, both); boundary (unknown ref, missing params, empty result); error paths (400 missing param, 404 not found); data quirks (null resolved_date, zero-cent amounts, legacy status codes) |
| **Golden capture** | Before any source file is modified, `node tests/golden/capture.js` exercises the live legacy server and writes JSON fixtures to `tests/golden/`; fixtures committed with the subtask branch |
| **Comparison** | HTTP status code; full response body field-by-field including key ordering; monetary amounts at cent precision; date string formatting; error codes and messages |
| **Intended differences** | None — the v2 routes must return identical body and status codes; the only observable addition is the `Deprecation` header on legacy paths |
| **Exit criteria** | ≥ 12 matrix cases executed; zero unexplained diffs; legacy paths confirmed serving with `Deprecation` header; equivalence report in PR body |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Side-by-side v2 routes (`/api/v2/…`), legacy stays mounted | In-place replacement | Downstream consumers (Vendor Enquiry Desk, Traffic Light, Hotline) cannot be coordinated for a simultaneous cutover; side-by-side is safe |
| All six literals to `process.env` in this epic | Move only the two credential literals | Partial env migration leaves four undocumented config values in source; one pass is cleaner and the rule-01 violation is total, not partial |
| `scoreRow` lifted as-is into v2 handler | Rewrite risk logic | Pure function is already isolated and correct; any rewrite introduces unverifiable behavior drift |
| Agent exposes `status`, `risk_band`, `vendor_name`, `amount`, `reason_text` only — never `bank_bic` or clerk names | Full row passthrough | `bank_bic` is PCI-sensitive routing data; clerk names are PII; the agent has no business need for either |
| `release_payment` permanently refused at vault-scope middleware | Not exposing the tool at all | Rule 11(b): the refusal is the control; hiding the operation moves enforcement into reasoning, which cannot be audited |
| ERP XML feed untouched (except env ref) | Parameterize XML feed queries | XML feed has its own downstream (ERPBATCH01) and is out of scope; touching it risks breaking a live integration for no agent benefit |

## Open items

*(none — all clarifying questions answered 2026-08-14)*

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-81 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-81 BEFORE / AFTER frames — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
