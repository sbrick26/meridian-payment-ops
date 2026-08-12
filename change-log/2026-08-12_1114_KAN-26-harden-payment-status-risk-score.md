# Change Log Entry

**Date:** 2026-08-12 18:14 UTC  
**Ticket:** KAN-26 — Harden /api/payment-status and /api/risk-score  
**Branch:** feature/KAN-26-harden-apis  
**Author:** payments-platform-team (AI-assisted, Bob)

---

## Prompt

> Continue working KAN-28 (golden capture) and then KAN-26 (harden the payment-status and risk-score endpoints). Capture the golden responses from the legacy endpoints first, then implement the modern equivalents, run the equivalence suite, and open the pull request with the equivalence report in the body.

---

## Files changed

| File | Change |
|------|--------|
| `server.js` | Replaced legacy SQL-concatenation handlers for `/api/payment-status` (lines 525–586) and `/api/risk-score` (lines 588–626) with hardened, parameterized, validated implementations. Added `require` statements for `helmet`, `pino`, `express-validator`. Replaced hardcoded `SMTP_PASS` literal with `process.env.SMTP_PASSWORD`. Replaced hardcoded `ERP_FEED_KEY` literal with `process.env.ERP_POLL_KEY`. Applied `helmet()` middleware globally. Added pino logger instance. Compliance headers added to both new route handlers. |
| `package.json` | Added `express-validator`, `helmet`, `pino` as runtime dependencies. Added `jest` as dev dependency. Added `test` script. Added jest configuration (globalSetup, globalTeardown, testEnvironment, testTimeout). Version bumped 2.4.1 → 2.4.2. |
| `tests/jest.setup.js` | New — Jest globalSetup: spawns server process, waits for readiness on port 4600. |
| `tests/jest.teardown.js` | New — Jest globalTeardown: sends SIGTERM to server process. |

*Note: `tests/capture-golden.js`, `tests/equivalence.test.js`, and `tests/golden/**` were introduced by KAN-28 (cherry-picked onto this branch) and are not modified here.*

---

## Controls applied

| Rule | NIST 800-53 | SOX / PCI-DSS |
|------|-------------|---------------|
| Rule 01 (secrets from env) | SC-28 | PCI Req. 3 — secrets removed from source |
| Rule 01 (parameterized SQL) | SI-10 | PCI Req. 6.5.1 — SQL injection eliminated |
| Rule 02 (compliance headers) | AU-2 | SOX 404 traceability |
| Rule 03 (this change log) | AU-12 | PCI Req. 10; SOX 404 change management |
| Rule 04 (approved libraries) | CM-2, CM-6 | SOX ITGC — helmet, pino, express-validator, jest all on approved list |
| Rule 07 (plan-first) | — | Plan approved on KAN-21 before this code was written |
| Rule 08 (behavioral equivalence) | AU-6, SI-4 | FFIEC operational risk — 32 golden cases, 0 diffs |

---

## Risk notes

- **Secrets moved to env:** `SMTP_PASS` (was `meridian2013!` literal, `server.js:44`) and `ERP_FEED_KEY` (was `ERP-POLL-KEY-8842` literal, `server.js:49`) are now read from `process.env.SMTP_PASSWORD` and `process.env.ERP_POLL_KEY` respectively. The SMTP chaser job and ERP feed operator must export these before deploying. No runtime path currently uses these values in the production screens — they are read at startup but only consumed by the overnight mail job and the ERP batch endpoint, which remain unchanged. Risk: if env vars are not set, `SMTP_PASS` and `ERP_FEED_KEY` will be `undefined` (not a startup crash, but the mail job and ERP auth would fail at use time). Documented in 03-decisions.md under DEC-005.
- **Legacy handler removed in place:** The SQL-concatenation handlers are fully replaced. The endpoint paths (`/api/payment-status`, `/api/risk-score`) are unchanged — no consumer URL changes. Legacy behavior is preserved exactly as proven by the equivalence suite.
- **helmet() applied globally:** Adds `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and other headers to all responses including the HTML screens. No regressions observed in manual smoke test of dashboard, held payments, and reports pages.

---

## Equivalence report

| Metric | Value |
|--------|-------|
| Endpoints hardened | 2 (`/api/payment-status`, `/api/risk-score`) |
| Golden fixtures (captured before any edit) | 32 |
| Test cases executed | 32 |
| Unexplained diffs | **0** |
| Test suite result | **PASS** |
| Suite run | `npm test` — Jest 29 with globalSetup/Teardown |

---

## Approval

Human approval required before merging: this change removes hardcoded credentials from source.  
Plan approval was recorded on KAN-21 by the plan approver before this code was written.  
PR review required per SOX ITGC change control.
