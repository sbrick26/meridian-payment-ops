# KAN-41 — Modernization plan: AP Payment Operations Console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-41 |
| **Author** | bobdev |
| **Date** | 2026-08-13 |
| **Status** | Awaiting approval |

## Current state

- **9 SQL injection sites** across 7 routes: every user-supplied query parameter is
  concatenated directly into `db.prepare()` strings or `db.exec()` calls — never bound
  (`server.js:155,160,163,225,292,365,535,537,597,632`). Two public APIs
  (`/api/payment-status`, `/api/risk-score`) are fully exposed to injection with no auth.
- **2 hardcoded credentials** committed to source: SMTP password `'meridian2013!'`
  (`server.js:44`) and ERP batch API key `'ERP-POLL-KEY-8842'` (`server.js:49`).
- **Zero test coverage**: no test directory, no test framework, no `npm test` script
  (`package.json:13-17`). Three downstream teams depend on the payment-status and
  risk-score APIs with no behavioral contract.
- **jQuery 1.9.1 (EOL Jan 2016)** is the only JS framework (`public/vendor/jquery-1.9.1.min.js`);
  all risk encoding is color-only — row background, score card, age cell — violating WCAG 2.2 AA
  (`exceptions.ejs:65-102`, `detail.ejs:105-118`).
- **340 vendor status calls/week** land on the AP hotline because the tooling has no
  self-service channel; the payment-status API exists but is inaccessible to an AI assistant.

**Why this is worth doing now:** The injection vulnerabilities are a PCI-DSS Req. 6.5.1 finding on a
system that proxies real payment decisions. The lack of a behavioral contract for the APIs means any
code change risks silent breakage for three consuming teams. The agent channel eliminates the hotline
load without any human workflow change.

## Target state

The console serves its existing workflows on a clean, tested surface: parameterized queries
throughout, credentials from `process.env`, and a Jest equivalence suite proving the modern
API matches the legacy behavior case-by-case. The Held Payments view is rebuilt to Meridian
Design Language 3.0 — risk encoded as labeled chips, not color alone, meeting WCAG 2.2 AA.
A scoped, read-only MCP endpoint exposes payment status and risk to a watsonx Orchestrate agent
reachable by phone, governed by a short-lived identity that can read but never write.

**Workstreams**

1. **Backend API v2** — Replace `GET /api/payment-status` and `GET /api/risk-score` with
   parameterized, validated, tested equivalents under `/api/v2/`; capture 30 golden fixtures
   first; keep legacy endpoints mounted and deprecated.
2. **Frontend UI + Accessibility** *(parallel with 3, starts after 1 lands)* — Rebuild
   `views/exceptions.ejs` and `views/detail.ejs` to MDL 3.0 spec; replace jQuery 1.9.1; fix all
   five WCAG 2.2 AA failures identified (color-only risk, missing ARIA labels, table scope,
   keyboard row selection, bar chart labels).
3. **Agent Enablement** *(parallel with 2, starts after 1 lands)* — Expose `/api/v2/` via a
   scoped MCP tool layer; deploy a watsonx Orchestrate agent with a bound voice line; read-only
   identity enforced and verified.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Backend API v2: payment-status and risk-score | `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, `server.js` (mount), `tests/golden/`, `tests/equivalence/` | 30 golden fixtures captured before any change; Jest equivalence suite runs `npm test` green; 0 unexplained diffs vs legacy; all queries parameterized; credentials from `process.env`; legacy routes mounted and returning `Deprecated` header | 2026-08-18 |
| 2 | Frontend: Held Payments to MDL 3.0 + WCAG 2.2 AA | `views/exceptions.ejs`, `views/detail.ejs`, `views/partials/header.ejs`, `public/payops.js` (jQuery removed), `public/mdl-3.css` (extended if needed) | Screen matches committed `docs/design/KAN-41-after.png` within accepted deviations; risk label chip present (not color-only) on every row; all 5 WCAG findings resolved; `npm test` green; no Bootstrap 2 / jQuery 1.9.1 tags remain | 2026-08-20 |
| 3 | Agent Enablement: MCP endpoint + watsonx Orchestrate | `routes/mcp-endpoint.js`, `vault/` (scoped credentials), `server.js` (mount) | MCP tool returns correct payment status for a known ref; write attempt refused with a quoted error; watsonx Orchestrate agent smoke test passes (PASS lines in PR body); phone number bound and reachable | 2026-08-20 |

## Out of scope

- **`POST /exceptions/:id/resolve` SQL injection** — the fix exists in principle (parameterize
  `server.js:292-299`), but changing the write path that mutates payment records requires its own
  equivalence strategy and human sign-off. Tracked separately.
- **`GET /exceptions` and `GET /reports/export.csv` SQL injection** — same rationale; scoped to
  the two public APIs in this epic.
- **Legacy endpoint retirement** (`/api/payment-status`, `/api/risk-score` → 410) — three
  downstream teams must confirm cut-over first. Separate follow-on epic.
- **Authentication / CSRF / rate limiting** — no auth layer exists today; adding one is a
  security architecture decision beyond Phase 1 scope.
- **Dashboard, Reports, Help views** — MDL 3.0 styling limited to the Held Payments experience.
- **Database foreign key constraints** — schema migration out of scope for Phase 1.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal ref lookup; nominal invoice lookup; each seeded status (PENDING, REVIEW, HOLD, ESCALATED); HIGH/MEDIUM/LOW risk bands; missing ref (404); empty string (400); ref with max-length value; null amount edge case |
| **Golden capture** | 30 fixtures captured from legacy endpoints via capture script before any route modification; committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` |
| **Comparison** | HTTP status code; all response body fields by name; monetary values to the cent (`amt_cents`); ISO-8601 date strings verbatim; `risk_flag` / `BAND` value; `retcode`; 404 and 400 error bodies |
| **Intended differences** | None — `risk_flag` field name preserved verbatim per analysis; date format unchanged |
| **Exit criteria** | 30 cases executed, 0 unexplained diffs; legacy routes deprecated (not removed); suite runs in CI via `npm test` |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| API first (Subtask 1 before UI) | UI first | Three downstream teams depend on the APIs; unblocks agent channel |
| Keep legacy routes mounted, deprecated | Remove on merge | Downstream teams need time to cut over; retirement is a separate epic |
| Read-only agent identity (permanent Phase 1 boundary) | Write scope for note/clerk actions | "Talk about money, never move it" — scoped by requester; write access requires separate approval and plan |
| Parameterize all queries in the two API routes only | Fix all 9 injection sites in one PR | The write-path endpoint (`/resolve`) requires its own equivalence proof; mixing it in blurs the review surface |
| MDL 3.0 from `public/mdl-3.css` (committed stylesheet) | Author styles inline | Stylesheet is reviewable, reproducible, and shared with the Figma script — drift cannot occur |
| WCAG 2.2 AA in scope for Phase 1 | Defer accessibility | Color-only risk encoding is an open finding; fixing it is required by rule 09 design fidelity |

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-41 |
