# KAN-91: Modernize Payment-Status Service and Expose AI Agent

**Epic:** KAN-91  
**Status:** Draft (pending approval)  
**Created:** 2026-08-13  

---

## Current State

The legacy payment-status service (PAYOPS v2.4.1, in production since 2013) serves two public JSON endpoints consumed by internal operators, external batch systems, and the AP hotline desk:

- `GET /api/payment-status?ref=<ref>&invoice=<invoice>` — returns payment status, amount, vendor, and due date (server.js:525–586)
- `GET /api/risk-score?ref=<ref>` — returns traffic-light risk flag and priority score (server.js:588–625)

### Current implementation issues

**SQL Injection (Critical):** Both endpoints use string concatenation to build WHERE clauses (lines 535, 537, 597), violating rule 01 (Secure Coding). The risk-score endpoint accepts only `ref`, not invoice, despite README claiming vendors "almost never have" reference numbers — a contradiction the modernization must resolve.

**Hardcoded secrets (Critical):** SMTP credentials (lines 43–45) and ERP feed credentials (lines 48–50) in source; must move to `process.env` per rule 01.

**No tests:** Zero test coverage for either endpoint; equivalence suite must capture golden responses across boundary cases (empty results, null fields, both lookup modes, error paths, and real production data quirks).

**Downstream consumers (blocking retirement):**
- **AP hotline desk:** 340 vendor calls/week via `GET /api/payment-status?invoice=<invoice>` — manually performs lookups to answer vendor inquiries
- **Vendor enquiry desk:** Uses `/api/risk-score?ref=<ref>` to determine traffic-light priority
- **ERP batch bridge (ERPBATCH01):** Polls `GET /api/exceptions.xml` every 15 minutes for payment extraction (not in scope for this epic; XML endpoint remains as-is)

### Known contradictions to resolve

README claims "no self service for vendors" (line 136) yet help.ejs exposes both API endpoints and links to them from detail screens — the agent resolves this by making endpoints self-serve and audited.

---

## Target State and Workstreams

### Workstream 1: MODERNIZE — Service Endpoints (v2 JSON endpoints)

**Deliverable:** Two new endpoints at v2 paths with parameterized queries, secrets in environment, and golden equivalence suite proving zero behavioral drift from legacy routes.

**Surface:**
- `GET /api/v2/payment-status?ref=<ref>&invoice=<invoice>` — returns payment status with all legacy fields, same error codes and bodies
- `GET /api/v2/risk-score?ref=<ref>` — returns risk score with all legacy fields, same error codes

**Implementation changes:**
1. Parameterized queries using `db.prepare()` with `?` placeholders (server.js line 306 pattern)
2. Move `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, `ERP_FEED_USER`, `ERP_FEED_KEY` to `process.env` (rule 01)
3. Input validation on `ref` and `invoice` parameters (rule 01): type check, length limit, reject coercion
4. Same response shape and error paths as legacy (rule 08a: golden captures first)
5. Add pino logging for audit trail (control AU-2)

**Legacy paths:** Remain active, unchanged, for 90 business days post v2 go-live (deprecation period). After day 90, remove.

### Workstream 2: AGENT — Governed AI Assistant

**Deliverable:** watsonx Orchestrate agent reachable via phone at +1 (415) 338-9157, calling the v2 endpoints with Vault-scoped read-only identity, demonstrating boundary enforcement (read allowed, write refused).

**Surface:**
- Natural-language payment inquiry: "What's the status of payment MT-2026-08847?"
- Risk lookup: "Is this payment flagged?"
- Escalation: "I need to hold this payment" → refusal with AP hotline contact
- Remittance details: amount, expected date, bank, status, exceptions

**Authorization:**
- Agent identity: Vault-scoped credential with read-only scope
- Operations allowed: `GET /api/v2/payment-status` and `GET /api/v2/risk-score`
- Operations refused: any POST, PUT, DELETE, or PATCH (demonstrated at review)

**Channels:** Phone only (+1 (415) 338-9157). Web chat out of scope.

---

## Subtasks

| # | Name | Scope | Acceptance Criteria | Due Date |
|---|------|-------|---------------------|----------|
| 1 | MODERNIZE: Replace payment-status and risk-score endpoints with v2, parameterized queries, secrets in environment | New endpoints `/api/v2/payment-status` and `/api/v2/risk-score` with parameterized queries, input validation, logging, and equivalence suite (golden captures + automated test matrix) | (a) Endpoints deployed side-by-side at v2 paths; (b) 100% input coverage in equivalence test suite (nominal, boundary, error, authorization variants); (c) Zero unexplained diffs from legacy to v2 responses; (d) Secrets in `process.env`, no literals in code; (e) Pino audit log for every request; (f) Deprecation notice added to legacy endpoints | 2026-08-27 (business days) |
| 2 | AGENT: Deploy governed watsonx Orchestrate agent for payment inquiry, phone channel only | Agent definition, phone number binding, Vault credential, tool layer scoped to read-only `GET /api/v2/*` endpoints | (a) Agent callable at +1 (415) 338-9157; (b) Demo conversation: authorized read succeeds, unauthorized write (e.g., "hold payment") returns refuse with exact scope denial; (c) Agent identity verified in Vault with read-only scope; (d) Console serves; (e) Proof of boundary in PR (both outcomes quoted); (f) Downstream ERP batch bridge and AP hotline routes unchanged | 2026-09-03 (business days) |

---

## Out of Scope

- **UI dashboard, clerk exception screens, and XML ERP feed:** Remain unchanged. Future follow-on epic.
- **Web chat channel:** Phone only. Chat is a follow-on.
- **Payment hold, release, or state-change operations:** Agent holds read-only scope by design; refuses all writes.
- **Vendor self-service portal:** Out of scope; agent serves this need via phone.
- **Load testing and volume metrics:** Deployment success is availability and boundary correctness, not throughput targets.

---

## Equivalence Strategy (Rule 08)

### (a) Golden Captures — First

Before any code change:
1. Exercise legacy `/api/payment-status` and `/api/risk-score` against live `payops.db`
2. Capture across input matrix:
   - **Nominal:** Single valid payment by ref, by invoice, by both
   - **Boundary:** Empty result set (404), single-row result, pagination (if supported), max field lengths
   - **Error paths:** Missing `ref` (400), missing `invoice` (400), invalid format, non-existent record (404)
   - **Authorization variants:** If any auth is enforced, test each role (none currently documented, but note if present)
   - **Data quirks:** Null vs. empty fields, legacy date/time formatting, amount rounding, currency handling
3. Commit fixtures to `tests/golden/payment-status-legacy.json` and `tests/golden/risk-score-legacy.json`

### (b) Equivalence Test Suite

Automated test that runs every input from (a) against both legacy and v2 endpoints and compares:
- HTTP status code
- Response body, field by field (including field ordering if consumers depend on it)
- Numeric precision (monetary amounts in cents)
- Date/timestamp formatting and timezone
- Error codes and message text
- Side effects (if any — none expected for read-only endpoints)

Location: `tests/equivalence.test.js`  
Gate: CI runs this on every PR touching v2 endpoints; zero unexplained diffs required to merge.

### (c) Intended Behavior Changes

**None.** This modernization preserves legacy behavior exactly. All differences discovered at review must be:
1. Documented in this PLAN.md under "Intended behavior changes" (none yet), or
2. Treated as a test failure and fixed before PR merge

---

## Key Decisions

| Decision | Rationale | Alternative Rejected |
|----------|-----------|----------------------|
| **v2 side-by-side, not in-place replacement** | Allows equivalence testing against running legacy before cutover; reduces risk of broken downstream consumers | In-place replacement (legacy removed immediately) — no proving ground for equivalence, higher risk to ERP batch bridge and AP hotline |
| **Read-only agent identity, write scope refused at boundary** | Least privilege (rule 11b); demonstrates governance; operators route holds/changes to AP desk | Giving agent write scope for "convenience" — violates rule 11 and creates audit liability |
| **Phone channel only, no web chat** | Narrows delivery scope, reduces complexity, focuses on highest-use consumer (AP hotline); chat is follow-on | Include web chat now — scope creep; delays agent go-live; can add later |
| **90 business-day legacy retention, then retire** | Allows consumers time to migrate; creates forcing function; documented timeline in PLAN | No retirement date ("pending forever") — technical debt accumulates, confusion about canonical path |
| **Input validation and parameterized queries (rule 01)** | Eliminates SQL injection; meets PCI-DSS Req. 6.5.1 and NIST SI-10 | Leaving SQL concatenation — fails security audit, operational risk |

---

## Approval Record

**Pending.** Awaiting review and approval comment on KAN-91 ticket.

---

## Out of Scope for This Modernization (Follow-On Epics)

- **Dashboard and clerk UI:** Modernize in a separate epic (legacy routes remain active)
- **ERP batch XML feed:** Out of scope; remains on legacy codebase
- **Web chat agent:** Implement after phone v2 is live and stable
- **Vendor self-service portal:** Future; agent supports inquiries via phone in this epic
