# KAN-21 — Modernization Plan
## AP Payment Operations Console — Phase 1

**Version:** 1.0 (initial)  
**Date:** 2026-08-12  
**Author:** Bob (AI modernization agent)  
**Status:** AWAITING APPROVAL  

---

## 1. Objective

Deliver a demonstrably equivalent, security-hardened replacement for the
`/api/payment-status` and `/api/risk-score` endpoints (the "payment-status/risk
API"), and modernize the Held Payments screen (`/exceptions`) to Meridian Design
Language 3.0. Expose the modernized API to an AI assistant channel (watsonx
Orchestrate) under scoped-identity governance so vendor status inquiries can be
self-served, measurably reducing AP hotline volume.

---

## 2. Scope

### In scope

| Workstream | Description |
|------------|-------------|
| **WS-1: API security hardening** | Replace string-concatenated SQL with parameterized queries, add input validation, move credentials to env vars, add `helmet`, add `pino` logging — for `/api/payment-status`, `/api/risk-score`, and their shared database helpers |
| **WS-2: Equivalence test suite** | Golden capture + automated equivalence suite proving WS-1 output matches legacy behavior field-for-field |
| **WS-3: Held Payments UI modernization** | Redesign `/exceptions` view to MDL 3.0 (design review gate before code) |
| **WS-4: Agent access channel** | MCP tool wrapper for the modernized API + watsonx Orchestrate agent wired to scoped identity |

### Out of scope (Phase 1)

- Replacing the ERP XML feed (`/api/exceptions.xml`) — downstream ERP batch bridge has no change window
- Modernizing `/reports`, `/reports/export.csv`, or the dashboard UI
- Adding authentication/session management to the web UI (future phase)
- Addressing INC-44192 (business-day age) or INC-45077 (blank clerk column) — not in Phase 1 spec
- Adding CSRF protection to `POST /exceptions/:id/resolve` — future phase
- Retiring the legacy endpoints before equivalence suite is green

---

## 3. Target State

### API layer (WS-1)

The two JSON API endpoints keep their current paths and response shapes.
Internally they are rewritten to use `db.prepare().get()` parameterized queries,
`express-validator` input validation, `dotenv`-loaded credentials, and `pino`
structured logging. `helmet` is added to the Express app for all routes.

Legacy endpoints remain mounted throughout Phase 1. They will be marked
deprecated in the response headers once the equivalence suite is green.

### Frontend (WS-3)

`views/exceptions.ejs` is redesigned to MDL 3.0. Design tokens (colour, type,
spacing) are derived exclusively from the Meridian Design Language 3.0 Figma
page. WCAG 2.2 AA compliance is a hard acceptance criterion: font size ≥ 11px,
no colour-only indicators, keyboard-accessible row navigation.

### Agent channel (WS-4)

An MCP server wraps the two modernized endpoints as tools. A watsonx Orchestrate
agent, authenticated via a scoped service identity, can answer "what is the
status of invoice INV-XXXX" and "what is the risk on payment MT-XXXX" without
involving an AP clerk. Write access (resolving exceptions) is explicitly not
granted to the agent.

---

## 4. Subtask Table

| # | Key | Summary | Workstream | Scope | Acceptance Criteria | Due Date |
|---|-----|---------|------------|-------|---------------------|----------|
| 1 | KAN-21-S1 | Golden capture for payment-status and risk-score APIs | WS-2 | Run legacy app; capture responses for full input matrix into `tests/golden/`; write equivalence suite that FAILs against an empty impl | Golden fixtures committed; suite fails against empty impl; passes against legacy | 2026-08-14 |
| 2 | KAN-21-S2 | Harden `/api/payment-status` and `/api/risk-score` | WS-1 | Parameterize all SQL, add express-validator, move credentials to env, add helmet + pino; keep legacy endpoints mounted | Equivalence suite: ≥40 cases, 0 diffs; `npm test` green; no `db.exec(` or string-concat SQL in modified files | 2026-08-18 |
| 3 | KAN-21-S3 | Design — Held Payments screen (MDL 3.0) | WS-3 | Before/after Figma frames; tokens from MDL 3.0 only; WCAG 2.2 AA review | Design approved on KAN-21-S3 Jira comment; screenshot-verified before/after frames in Figma | 2026-08-14 |
| 4 | KAN-21-S4 | Implement Held Payments screen (post-design approval) | WS-3 | Implement approved Figma design in `views/exceptions.ejs` + CSS; compliance headers; fidelity check | Screenshot diff vs approved Figma frame: no material deviation; `npm test` green; WCAG: keyboard row nav, no colour-only indicators, min 11px font | 2026-08-20 |
| 5 | KAN-21-S5 | MCP tool wrapper + watsonx Orchestrate agent | WS-4 | MCP server with two tools (payment_status, risk_score); agent wired to scoped identity (read-only); write-scope refusal test | Agent answers status query correctly; unauthorized write attempt returns 403; smoke test output in PR body | 2026-08-22 |

**Sequencing:**
- S1 must complete before S2 (golden captures before code change)
- S3 must be approved before S4 begins (design gate)
- S2 must complete before S5 (agent targets the modernized endpoints)
- S1 and S3 can run in parallel

---

## 5. Equivalence Strategy

### 5.1 Surface inventory

| Endpoint | Legacy location | Replacement |
|----------|----------------|-------------|
| `GET /api/payment-status` | `server.js:525–586` | Same path, rewritten handler in WS-1 |
| `GET /api/risk-score` | `server.js:588–626` | Same path, rewritten handler + `scoreRow()` refactored |

### 5.2 Input matrix

Minimum case classes to be exercised for each endpoint:

**`/api/payment-status`**

| Case class | Input | Expected outcome |
|------------|-------|-----------------|
| Nominal — lookup by ref | `?ref=MT-2026-08815` (seeded open item) | 200 + full payment object |
| Nominal — lookup by invoice | `?invoice=INV-2026-4471` | 200 + full payment object |
| RESOLVED item | ref of a resolved item | 200 + resolution fields present |
| HIGH-risk item | ref of a HIGH risk_flag item | 200 + risk_flag = HIGH |
| Each ptype | WIRE, ACH, SEPA refs | 200, ptype field preserved |
| Missing both params | `GET /api/payment-status` | 400 + error body |
| ref not found | `?ref=DOES-NOT-EXIST` | 404 + error body |
| invoice not found | `?invoice=INV-DOES-NOT-EXIST` | 404 + error body |
| Over approval limit | ref where amount_cents > 5000000 | 200, `over_limit: true` |
| Under approval limit | ref where amount_cents ≤ 5000000 | 200, `over_limit: false` |

**`/api/risk-score`**

| Case class | Input | Expected outcome |
|------------|-------|-----------------|
| HIGH band (score ≥ 70) | ref of HIGH item | 200, band = HIGH, score ≥ 70 |
| MEDIUM band | ref of MEDIUM item | 200, band = MEDIUM, 40 ≤ score < 70 |
| LOW band | ref of LOW item | 200, band = LOW, score < 40 |
| Missing ref | `GET /api/risk-score` | 400 + error body |
| ref not found | `?ref=DOES-NOT-EXIST` | 404 + error body |
| New vendor flag | ref where new_vendor = Y | 200, new_vendor = Y in response |
| Bank change flag | ref where bank_chg_days ≤ 30 | 200, bank_change = true |
| Duplicate hold (H21) | ref with reason_code = H21 | 200, duplicate = true |
| Round dollar | ref with round-dollar amount | 200, round_dollar = true |
| Large amount (≥ $50K) | ref where amount_cents ≥ 5000000 | 200, over_limit = true |

**Minimum total:** 20 cases across both endpoints.

### 5.3 Golden capture procedure

Executed as step 1 of S1, before any code is modified:

1. `npm start` — verify legacy app running on port 4600
2. Run capture script `tests/golden/capture.js` (to be written in S1) against
   each case in the matrix above
3. Save responses as `tests/golden/payment-status/<case>.json` and
   `tests/golden/risk-score/<case>.json`
4. Commit the fixtures to the repository before the WS-1 branch is created

### 5.4 Comparison method

For each golden case, the equivalence suite (`tests/equivalence.test.js`, written
in S1) runs the same request against the **modern implementation** and compares:

- HTTP status code (exact match)
- Response body: every field present in the golden fixture, by name
- Numeric precision: `amount_cents` as integer, `score` as integer
- String enumerations: `status`, `band`, `ptype`, `currency`, `risk_flag`
  (case-sensitive)
- Boolean fields: `over_limit`, `bank_change`, `duplicate`, `new_vendor`,
  `round_dollar` (exact match)
- Error body: `error` field present and non-empty for 4xx responses

Fields **not** compared (order-insensitive; implementation detail):
- Key ordering within the JSON object
- Any field not present in the golden fixture (additional fields in the modern
  response are allowed and encouraged where they aid the agent channel)

### 5.5 Intended differences

None. Phase 1 makes no deliberate behavior changes to these two endpoints.
Any difference discovered during equivalence testing is a bug in the modern
implementation, not an authorized deviation.

### 5.6 Exit criteria

- ≥ 20 cases executed, 0 unexplained diffs
- Equivalence suite runs in `npm test`
- Result reported verbatim in the PR body for S2
- Legacy endpoints remain mounted; retirement is a separate change after
  downstream teams confirm the modern endpoints are stable

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| scoreRow() algorithm has undocumented edge cases not covered by seeded data | Medium | High | Expand input matrix to cover all nine scoring factors; log any diff as a finding |
| MDL 3.0 Figma page is not accessible or missing tokens | Low | Medium | Check Figma connection at S3 start; if bridge is down, request user assistance before proceeding |
| WS-4 agent identity provisioning requires IAM team input | Medium | Medium | Flag in S5 comment; proceed with local mock if provisioning is delayed; do not merge S5 without scoped identity in place |
| better-sqlite3 prepared statements return slightly different type coercion than legacy concatenated queries | Low | Low | Verify in equivalence suite; document any type difference in intended-differences section |

---

## 7. Approval

| Field | Value |
|-------|-------|
| Plan submitted | 2026-08-12 |
| Approver | _[awaiting]_ |
| Approval date | _[awaiting]_ |
| Approval comment | _[awaiting]_ |

Implementation begins only after the approver records "plan approved" on KAN-21.

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2026-08-12 | Bob | Initial version submitted for review |
