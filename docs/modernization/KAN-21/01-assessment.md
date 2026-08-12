# KAN-21 — Current-State Assessment
## AP Payment Operations Console (PAYOPS v2.4.1)

**Assessed:** 2026-08-12  
**Assessor:** Bob (AI modernization agent)  
**Codebase revision analysed:** HEAD of main, workspace `/meridian-payment-ops`

---

## 1. Architecture Overview

The console is a single-file, server-rendered Node.js application with no build
step and no automated tests. All request handling lives in
[`server.js`](../../server.js) (731 lines). Helper utilities live in
[`utils.js`](../../utils.js) (206 lines). The view layer is five EJS templates
under [`views/`](../../views/), each pulled together by
[`views/partials/header.ejs`](../../views/partials/header.ejs) and
[`views/partials/footer.ejs`](../../views/partials/footer.ejs).

The persistence layer is a single SQLite file (`payops.db`) accessed directly
via `better-sqlite3`. All queries are constructed and executed inside
[`server.js`](../../server.js); there is no separate data-access layer.

The UI framework is a locally-hosted 2013 Meridian intranet Bootstrap 2.0 CSS
subset ([`public/vendor/bootstrap.css`](../../public/vendor/bootstrap.css)) and
jQuery 1.9.1 ([`public/vendor/jquery-1.9.1.min.js`](../../public/vendor/jquery-1.9.1.min.js)).
Neither is loaded from an external CDN. All client-side behaviour is in
[`public/payops.js`](../../public/payops.js) (122 lines).

---

## 2. Endpoint Inventory

| # | Method | Path | Template / Response | Purpose |
|---|--------|------|---------------------|---------|
| 1 | GET | `/` | `views/dashboard.ejs` | KPI summary tiles, queue breakdown |
| 2 | GET | `/exceptions` | `views/exceptions.ejs` | **Held Payments queue — primary operational screen** |
| 3 | GET | `/exceptions/:id` | `views/detail.ejs` | Single-payment detail with action form |
| 4 | POST | `/exceptions/:id/resolve` | Redirect | Clerk action (RELEASE, RETURN, HOLD, ESCALATE, REVIEW) |
| 5 | GET | `/reports` | `views/reports.ejs` | Six standard aggregation reports |
| 6 | GET | `/reports/export.csv` | CSV stream | Full-queue or filtered CSV download |
| 7 | GET | `/api/payment-status` | JSON | Vendor payment-status lookup (by ref or invoice) |
| 8 | GET | `/api/risk-score` | JSON | Risk score + band (APRSK01 algorithm, ported from COBOL) |
| 9 | GET | `/api/exceptions.xml` | XML | ERP batch-bridge polling feed (every 15 min) |
| 10 | GET | `/help` | `views/help.ejs` | Help/documentation page |
| 11 | Catch-all | — | 404 HTML | Undefined routes |

**APIs in scope for Phase 1:** endpoints 7 (`/api/payment-status`) and 8
(`/api/risk-score`). Endpoint 9 (`/api/exceptions.xml`) and the HTML routes are
out of Phase 1 scope.

---

## 3. Data Model Summary

Four tables in [`payops.db`](../../payops.db), schema defined in
[`seed.js`](../../seed.js) lines 154–209.

| Table | Rows (seeded) | Purpose |
|-------|--------------|---------|
| `vendors` | 60 | Vendor master: name, country, vendor_no, category, new_vendor flag |
| `ap_clerks` | 8 | Operator roster: name, initials, team (AP-DESK-1/2, AP-CONTROLS) |
| `exceptions` | 397 (247 open + 150 resolved) | Core held-payment records |
| `notes` | ~660 | Clerk notes and audit events per exception |

**Key enumerations (from `seed.js` lines 95–130):**

- **`exceptions.status`:** `PENDING`, `REVIEW`, `HOLD`, `ESCALATED`, `RESOLVED`
- **`exceptions.ptype`:** `WIRE`, `ACH`, `SEPA`
- **`exceptions.risk_flag`:** `LOW`, `MED`, `HIGH`
- **`exceptions.resolution`:** `RELEASED`, `RETURNED`, `CANCELLED`, `CORRECTED`
- **`exceptions.reason_code`:** H07, H09, H14, H18, H21, H26, H33, H41, H52, H63

**Risk scoring** is implemented in `scoreRow()` at
[`server.js:407–516`](../../server.js) — a nine-factor algorithm ported from
COBOL routine APRSK01. Scores 0–100 map to bands LOW (<40), MEDIUM (40–69),
HIGH (≥70).

---

## 4. Security Findings

All findings below are grounded in direct code inspection. Findings are ordered
by severity.

### 4.1 Hardcoded Credentials — CRITICAL (PCI-DSS Req. 3.2.1, NIST SC-28)

[`server.js:43`](../../server.js) — SMTP service account password `'meridian2013!'` hardcoded as a
variable literal.  
[`server.js:49`](../../server.js) — ERP feed API key `'ERP-POLL-KEY-8842'` hardcoded.  
[`server.js:48`](../../server.js) — ERP batch username `'ERPBATCH01'` hardcoded.

No `dotenv` package is installed. No `process.env` reads exist in
[`server.js`](../../server.js). The comment at line 29 reads: "edit here, there
is no properties file."

### 4.2 SQL Injection — CRITICAL (PCI-DSS Req. 6.5.1, NIST SI-10)

Eleven confirmed injection points across seven endpoints. The application builds
SQL by string concatenation throughout [`server.js`](../../server.js). The
**only** parameterized query in the codebase is the `notes` INSERT at
[`server.js:306–307`](../../server.js).

Representative examples:

```js
// server.js:155 — status parameter injected into WHERE clause
where = where + " AND e.status = '" + status + "' ";

// server.js:163–165 — search query injected across five LIKE clauses
where = where + " AND (e.payment_ref LIKE '%" + q + "%' ...

// server.js:225 — path parameter id injected into SELECT
"... WHERE e.vendor_id = v.id AND e.id = " + id

// server.js:297 — clerk body parameter injected into UPDATE
sql = sql + ", clerk_id = " + clerk;

// server.js:597 — ref query parameter injected into /api/risk-score
"... WHERE e.vendor_id = v.id AND e.payment_ref = '" + ref + "'"
```

The complete injection matrix covers: `GET /exceptions` (status, ptype, q),
`GET /exceptions/:id` (id), `POST /exceptions/:id/resolve` (id, clerk),
`GET /reports/export.csv` (status), `GET /api/payment-status` (ref, invoice),
`GET /api/risk-score` (ref), `GET /api/exceptions.xml` (status).

### 4.3 Missing Input Validation (NIST SI-10, PCI-DSS Req. 6.5)

Only two parameters are validated in the entire application: `page` (parseInt +
min check, [`server.js:150–151`](../../server.js)) and `max` (parseInt,
[`server.js:636`](../../server.js)). Parameters `status`, `ptype`, `q`, `sort`,
`ref`, `invoice`, `id`, `clerk`, and `action` have no type, length, or whitelist
validation before reaching SQL or template output.

`express-validator` is on the approved library list but is not installed.

### 4.4 No Authentication or Authorization

Every endpoint — including the JSON APIs and the XML feed — is accessible
without credentials. There is no session middleware, no API key check, and no
operator identity established from a request. The header template hardcodes
"Signed in as DWH01" ([`views/partials/header.ejs:25`](../../views/partials/header.ejs)).

The ERP feed endpoint ([`server.js:628`](../../server.js)) is documented as
requiring `ERPBATCH01` authentication, but the server performs no such check.

### 4.5 Missing Security Headers

`helmet` is on the approved library list but is not installed.
[`server.js`](../../server.js) sets no `Content-Security-Policy`,
`X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security`
headers. Inline `onclick` handlers throughout the EJS templates are
incompatible with a strict CSP.

### 4.6 No CSRF Protection

`POST /exceptions/:id/resolve` ([`server.js:260`](../../server.js)) accepts form
submissions with no CSRF token. The form in
[`views/detail.ejs:79–101`](../../views/detail.ejs) has no hidden token field.

---

## 5. Frontend Findings

### 5.1 Design System Debt

The UI uses a 2013 Meridian intranet Bootstrap 2.0 subset
([`public/vendor/bootstrap.css`](../../public/vendor/bootstrap.css)) that
predates Meridian Design Language 3.0. Color tokens, type scale, spacing, and
component anatomy do not conform to MDL 3.0.

### 5.2 Outdated JavaScript Dependency

jQuery 1.9.1 ([`public/vendor/jquery-1.9.1.min.js`](../../public/vendor/jquery-1.9.1.min.js))
was released in February 2013 and is end-of-life. It carries known prototype
pollution and XSS-related CVEs.

### 5.3 Accessibility Failures (WCAG 2.2 AA)

- **Font size 10px** throughout the exception table (`.exc-table`, [`public/payops.css:81`](../../public/payops.css)) — below minimum readable size
- **Colour-only risk indicators** — row pink background and `.risk-high` text colour with no text label or icon
- **No keyboard navigation** for row selection — `onclick`/`ondblclick` handlers in [`views/exceptions.ejs:86–87`](../../views/exceptions.ejs) with no keyboard equivalents
- **Missing ARIA** — no `role`, `aria-label`, `aria-sort`, `aria-selected`, or `aria-live` attributes on interactive elements
- **No `scope` attributes** on `<th>` elements in the held-payments table
- **No skip link** in [`views/partials/header.ejs`](../../views/partials/header.ejs)

---

## 6. Test Coverage

Zero test files exist in the repository. No `jest.config.js`, no `*.test.js`,
no `*.spec.js`. The [`package.json`](../../package.json) defines `start` and
`seed` scripts but no `test` script. Any change to application behaviour today
is entirely unverified.

---

## 7. Compliance Header Coverage

No route handler, utility function, or EJS template carries a compliance header
as required by rule 02. This is a pre-existing legacy condition; the
modernization plan addresses it for every new or modified file.

---

## 8. Known Production Issues (from README)

| ID | Description | Risk |
|----|-------------|------|
| INC-0042 | No vendor self-service — 340 calls/week to AP hotline | Business |
| INC-44192 | Age counted in calendar days, not business days | Operational |
| INC-45077 | Clerk column blank for batch-keyed items | Data integrity |
| INC-45310 | Print function only covers current page | Operational |

---

## 9. Modernization Drivers

1. **PCI-DSS and SOX exposure:** Hardcoded credentials, SQL injection across
   payment-record endpoints, and zero test coverage constitute reportable control
   deficiencies.
2. **Downstream API consumers:** Three internal teams and the AP hotline consume
   `/api/payment-status` and `/api/risk-score`. Those endpoints must become
   stable, tested, and secured before any of those consumers can be given
   governed access.
3. **AI deflection opportunity:** 340 weekly vendor calls can be deflected once
   the API surface is clean, scoped-identity-governed, and MCP-wrapped for
   assistant consumption (watsonx Orchestrate).
4. **Design system debt:** The Held Payments screen is the primary operator
   interface. Its 2013 Bootstrap CSS is not MDL 3.0-compliant and fails WCAG 2.2 AA.
5. **Maintainability:** All logic in one 731-line file with no tests makes safe
   change expensive and risky.
