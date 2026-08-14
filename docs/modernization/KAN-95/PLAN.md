# KAN-95 — Modernization plan: payment-status service and AI agent

| | |
|---|---|
| **Epic** | KAN-95 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- **Nine of eleven routes build SQL by string concatenation** — direct injection risk on every user-controlled input; only the `INSERT INTO notes` path uses prepared statements (`server.js` lines 155, 163, 225, 292, 535, 537, 597, 632).
- **Two hardcoded credentials** live in source: SMTP password `'meridian2013!'` and ERP feed key `'ERP-POLL-KEY-8842'`; `ENVIRONMENT` is also hardcoded as `'PROD-DR'` — all three violate PCI-DSS Req. 3 and Constitution rule 01 (`server.js` lines 44, 49, 35).
- **Zero tests** — no `.test.js` or `.spec.js` files exist anywhere in the repository; no behavioral safety net before or after any change.
- **Both public API endpoints** (`GET /api/payment-status`, `GET /api/risk-score`) are consumed by the AP hotline desk (~340 vendor calls/week) and embedded in the internal UI (`views/detail.ejs` lines 116–124); a broken change has immediate operational impact.
- **README under-documents** the dual-lookup capability (`?ref=` and `?invoice=`) of `/api/payment-status` and does not mention the SQL or credential risks (`README.md`).

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor calls/week that a governed read-only agent can self-serve; the SQL injection and credential exposures are PCI/SOX findings that become reportable if discovered first by an external audit.

## Target state

`GET /api/v2/payment-status` and `GET /api/v2/payment-status` are replaced by parameterized, tested equivalents mounted alongside the unchanged legacy routes (no decommission this epic). The three hardcoded secrets are externalized to `process.env`. A governed AI agent, authenticated as `meridian-payment-agent@meridian.internal` with a read-only `inquiry` scope, is deployed to web chat and to phone number +1 (415) 338-9157; it surfaces the Standard field set (status, expected_pay_date, reason_text, amount, currency, risk_flag) and refuses all write operations demonstrably.

**Workstreams**

1. **Modernize** — parameterize the two API endpoints, externalize the three hardcoded secrets, and prove behavioral equivalence via a live parity suite.
2. **Agent** — expose the modernized service through a governed AI agent with a scoped read-only identity, reachable in web chat and by phone.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | `server.js` — `GET /api/v2/payment-status`, `GET /api/v2/risk-score`; externalize `SMTP_PASSWORD`, `ERP_FEED_KEY`, `ENVIRONMENT` to `process.env` | Legacy routes still respond; v2 routes return identical HTTP status and body on all nominal + error cases; parity suite green at zero unexplained diffs; `npm test` passes | 2026-08-19 |
| 2 | Build governed payment-status agent | MCP tool layer + watsonx Orchestrate agent wired to v2 endpoints; phone +1 (415) 338-9157 | Agent returns Standard fields on authorized read; write attempt returns a refusal with identity and scope in the body; `ops_deploy_agent` completes without error | 2026-08-21 |

## Out of scope

- Decommission of legacy `GET /api/payment-status` and `GET /api/risk-score` — kept permanently alongside v2; a future follow-on may retire them if all consumers migrate.
- Any UI changes (exceptions list, dashboard, detail views, reports) — documented follow-on, not this epic.
- `/api/exceptions.xml` ERP feed — separate endpoint, unchanged; ERPBATCH01 integration unaffected.
- PCI field masking beyond the Standard field set decision — caller authentication and field-level access control are a separate identity epic.

## Equivalence strategy

The parity suite starts both `legacy` (existing routes remounted at `/legacy/*`) and `v2` simultaneously. It exercises each endpoint on four input classes: nominal `?ref=`, nominal `?invoice=` (payment-status only), missing-parameter 400 error, and unknown-reference 404 — eight cases total. HTTP status and every response body field are compared field-by-field; the only excluded difference is the route path prefix. The suite runs on every pull request; merge is blocked until zero unexplained diffs.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes permanently alongside v2 | Redirect or remove legacy after v2 ships | Three downstream consumers confirmed; decommission is a follow-on requiring coordinated migration |
| Externalize all three hardcoded secrets (`SMTP_PASSWORD`, `ERP_FEED_KEY`, `ENVIRONMENT`) | Scope fix to payment-status paths only | A partial fix leaves two PCI findings open; whole-file is the right boundary |
| Expose Standard field set to agent (status, expected_pay_date, reason_text, amount, currency, risk_flag) | Full read minus bank fields, or minimal status-only | Standard balances vendor utility against PCI sensitivity; bank routing data (BIC, remit_to) stays out |

## Open items

*(none — no blockers)*

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-95 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-95 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
