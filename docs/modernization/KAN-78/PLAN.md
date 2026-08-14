# KAN-78 — Modernization plan: AP Payment-Status Service & Agent Enablement

| | |
|---|---|
| **Epic** | KAN-78 |
| **Author** | Bob (AI engineering agent) |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- Both agent-facing endpoints build SQL by string concatenation (`server.js:535–537`, `server.js:597`), making them injectable and PCI-non-compliant; 14 concat-SQL sites exist across the file.
- Six configuration literals hardcoded in source: two credentials (`SMTP_PASS='meridian2013!'` at `server.js:44`, `ERP_FEED_KEY='ERP-POLL-KEY-8842'` at `server.js:49`) and four config values (`SMTP_HOST`, `SMTP_USER`, `AP_DISTRIBUTION_LIST`, `ERP_FEED_USER`).
- Zero automated tests — no framework, no test files, no CI gate (`package.json`).
- AP hotline absorbs ~340 vendor status calls per week; no self-serve channel exists because the service cannot be safely exposed externally in its current form.

**Why this is worth doing now:** parameterized queries and environment config are prerequisites for any external exposure; the agent channel cannot ship against an injectable, credential-leaking backend.

## Target state

`GET /api/payment-status` and `GET /api/risk-score` are re-implemented under `routes/api-v2/` with parameterized queries (`express-validator` at the route boundary), all six config literals moved to `process.env`, and a golden equivalence suite at `tests/golden/` proving identical responses. The original routes remain mounted with a `Deprecation` header. A governed watsonx Orchestrate agent — identity `svc_payops_agent`, read-only Vault scope, reachable at +1 (415) 338-9157 — answers vendor payment-status and risk-score inquiries by calling the modernized endpoints; it cannot release or modify payments.

**Workstreams**

1. **Modernize service** — v2 endpoints with parameterized SQL, env config for all six literals, equivalence suite, legacy routes preserved with Deprecation header.
2. **Agent enablement** — MCP tool layer over the v2 endpoints, Vault-scoped read-only identity, watsonx Orchestrate agent deployed to web chat and phone channel.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, env config for 6 literals, golden fixtures at `tests/golden/`, equivalence suite | (a) `npm test` green; (b) equivalence suite reports 0 unexplained diffs across ≥12 input cases; (c) legacy routes respond with `Deprecation: true` header; (d) no secret literals remain in source | 2026-08-18 |
| 2 | Governed agent layer | `routes/mcp-endpoint.js`, `vault/middleware/vault-scope.js`, watsonx Orchestrate agent config; surfaces status, risk_band, vendor_name, amount, reason_text; refuses write ops | (a) authorized read returns correct payment data; (b) any write/release attempt returns a documented refusal with agent identity; (c) `ops_deploy_agent` green with phone number confirmed | 2026-08-20 |

## Out of scope

- Legacy UI routes (`/`, `/exceptions`, `/exceptions/:id/resolve`, `/reports`, `/reports/export.csv`, `/api/exceptions.xml`) — SQL injection and auth remediation for these routes is a documented follow-on epic; touching them here is scope creep that doubles the run for surfaces the agent never calls.
- CSRF protection, session auth, and security headers for the UI — same follow-on epic.
- `bank_bic` and clerk names — excluded from agent data surface per requester decision; these fields remain readable via the Console only.
- Hard deletion or archival of any payment record — prohibited by rule 05.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` |
| **Input matrix** | Nominal: ref lookup, invoice lookup, risk-score by ref; boundary: unknown ref (404), missing param (400), ref with no risk data; data quirks: null `clerk_id`, zero-amount payment, multi-currency; authz: no credential required (unchanged) |
| **Golden capture** | Captured against the unmodified legacy handlers before any code change; committed to `tests/golden/payment-status-*.json` and `tests/golden/risk-score-*.json` |
| **Comparison** | HTTP status code; full response body field-by-field; monetary precision (amount_cents integer, no rounding); date strings verbatim; error message text; `Content-Type` header |
| **Intended differences** | None — the v2 endpoints are a behaviorally identical replacement; no deliberate behavior changes |
| **Exit criteria** | ≥12 cases executed, 0 unexplained diffs; legacy routes remain mounted (no retirement in this epic) |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Legacy routes stay mounted with `Deprecation` header | Retire legacy routes immediately | Vendor Enquiry Desk and AP Hotline are live consumers; retirement is a migration, not this epic |
| All 6 config literals move to `process.env` | Credentials only | Consistent with rule 01; non-credential literals (`SMTP_HOST`, `ERP_FEED_USER`) are still configuration, not source code constants |
| XML feed route (`/api/exceptions.xml`) untouched except secret reference | Parameterize the XML feed too | ERP Batch Bridge has a fixed joint release; changing element names or auth is a separate dependency; the secret literal is the only non-UI obligation this epic carries for that route |
| Agent data surface: status, risk_band, vendor_name, amount, reason_text | Include bank_bic and clerk name | `bank_bic` is a payment instruction field (PCI scope); clerk names are operator PII; both reduce self-serve value without proportional hotline reduction |
| Side-by-side v2 routes, not in-place rewrite | In-place rewrite of legacy handlers | Preserves the legacy path for equivalence testing; a rewrite that destroys the legacy code before golden capture is in violation of rule 08 |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Recorded on** | KAN-78 |
| **Approving comment** | "approved" (comment id 10349, 2026-08-13T17:46:29-0700) |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Reviewed** | KAN-78 BEFORE / AFTER frames, https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
