# Assessment — AP Payment Operations console (Phase 1)

Epic: KAN-29
Date: 2026-08-12
Author: Bob (automated assessment)

---

## Application overview

**PAYOPS v2.4.1** — server-side Express + EJS application, no build step, SQLite
persistence (`payops.db`). In service since 2013. Entry point: [`server.js`](../../server.js),
utilities in [`utils.js`](../../utils.js). The app runs on port 4600 (`server.js:37`).

Configuration is entirely hardcoded at [`server.js:28–54`](../../server.js) — no `.env` file,
no `process.env` reads. This includes an SMTP password and an ERP API key (see
Security below).

No test files exist. `package.json` declares no test script and no test
framework dependency.

---

## Routes inventory

| Method | Path | Purpose | SQL style |
|--------|------|---------|-----------|
| GET | `/` | Dashboard — KPI tiles, status/type breakdowns | String concat |
| GET | `/exceptions` | Held Payments list — filter, sort, paginate | String concat |
| GET | `/exceptions/:id` | Payment detail + notes + risk score | String concat |
| POST | `/exceptions/:id/resolve` | Status update + note creation | Mixed (UPDATE concat; note INSERT parameterized) |
| GET | `/reports` | Six aggregate reports | String concat |
| GET | `/reports/export.csv` | CSV export of held payments | String concat |
| GET | `/api/payment-status` | JSON lookup by payment ref or invoice | String concat |
| GET | `/api/risk-score` | Risk score and band for a payment ref | String concat |
| GET | `/api/exceptions.xml` | XML feed for ERP batch bridge | String concat |
| GET | `/help` | Help/support page — renders SMTP_HOST, ERP_FEED_USER | — |

---

## Data model

Four tables. All schema in [`seed.js:154–208`](../../seed.js).

| Table | Key columns |
|-------|------------|
| `exceptions` | `id`, `payment_ref` (MT-2026-XXXX), `vendor_id`, `ptype` (WIRE/ACH/SEPA), `amount_cents`, `status` (PENDING/REVIEW/HOLD/ESCALATED/RESOLVED), `risk_flag` (HIGH/MED/LOW), `reason_code`, `clerk_id`, `resolved_date`, `resolution` |
| `vendors` | `id`, `name`, `country`, `vendor_no`, `category`, `new_vendor` |
| `ap_clerks` | `id`, `name`, `initials`, `team`, `email` |
| `notes` | `id`, `exception_id`, `author`, `note_date`, `body` |

Indexes: `ix_exc_status`, `ix_exc_ref`, `ix_exc_inv`, `ix_notes_exc`.

---

## Security liabilities

### Critical — SQL injection (15 locations)

Every SELECT, UPDATE, and the XML/CSV exports build SQL by string concatenation.
Examples:

- **[`server.js:155`](../../server.js)** — `/exceptions` `status` filter:
  `where + " AND e.status = '" + status + "' "`
- **[`server.js:163–165`](../../server.js)** — `/exceptions` search box `q`:
  multi-field `LIKE '%' + q + '%'` concatenation — 5 columns
- **[`server.js:225`](../../server.js)** — detail page `:id` path parameter:
  `"WHERE e.id = " + id` (no numeric validation)
- **[`server.js:292–299`](../../server.js)** — resolve POST: `newStatus`, `resolution`,
  `resolvedDate`, `clerk`, `id` all concatenated into UPDATE
- **[`server.js:535–537`](../../server.js)** — `/api/payment-status` `ref`/`invoice`:
  `"AND e.payment_ref = '" + ref + "'"`
- **[`server.js:597`](../../server.js)** — `/api/risk-score` `ref`:
  `"AND e.payment_ref = '" + ref + "'"`

Seed.js uses parameterized queries correctly ([`seed.js:222–232`](../../seed.js));
the production handlers do not.

### Critical — Hardcoded secrets

- **[`server.js:44`](../../server.js)** — SMTP password: `'meridian2013!'`
- **[`server.js:49`](../../server.js)** — ERP feed API key: `'ERP-POLL-KEY-8842'`
- **[`server.js:48`](../../server.js)** — ERP batch user `ERPBATCH01` disclosed in
  XML feed response body ([`server.js:648`](../../server.js)) and help page
  ([`server.js:697–700`](../../server.js))

### High — No authentication on any route

All routes — including `/api/payment-status`, `/api/risk-score`, and
`/api/exceptions.xml` — accept unauthenticated requests. The XML feed URL
embeds `ERP_FEED_USER` in the response but never validates a credential from
the caller (`server.js:628–674`).

### High — Missing approved middleware

`helmet`, `express-validator`, `dotenv`, and `pino` are all on the approved
library list (`.bob/rules/04-approved-libraries.md`) but none are installed or
used. There are no Content-Security-Policy, X-Frame-Options, or
X-Content-Type-Options headers on any response.

### High — No CSRF tokens

Forms POST to `/exceptions/:id/resolve` with no CSRF token. State-changing
operations on held payments can be triggered cross-site.

### Medium — No transactions on status+note update

[`server.js:300`](../../server.js) executes a raw `db.exec(sql)` (dynamic SQL) for the
status UPDATE, then a parameterized `db.prepare().run()` for the note INSERT
([`server.js:306–307`](../../server.js)), with no wrapping transaction. A crash between
the two leaves a payment in an inconsistent state.

---

## Frontend liabilities

### CSS/JS stack is EOL

- **Bootstrap intranet subset** — local copy of a Bootstrap 2.x grid/table subset
  (`/public/vendor/bootstrap.css`). No version or provenance in the file.
- **jQuery 1.9.1** — released 2013, end-of-life, carries multiple known CVEs
  (`/public/vendor/jquery-1.9.1.min.js`).

### Held Payments screen gaps

[`views/exceptions.ejs`](../../views/exceptions.ejs) renders the main work queue.
Issues:

- Status badges rendered via `<%- u.statusLabel() %>` (unescaped output,
  `exceptions.ejs:94`) — safe only because values come from DB today, not from
  user input.
- No ARIA landmarks (`<main>`, `<nav>`) in [`views/partials/header.ejs`](../../views/partials/header.ejs).
- Risk-tier colour distinction is background-only (`payops.css:87-88`,
  `#fbf0ee`) — WCAG 2.2 AA colour-contrast failure likely.
- Table headers lack `scope="col"` (`exceptions.ejs:68–79`).
- Font size on table rows: 10 px (`payops.css:81`) — below minimum readable size.
- Hardcoded user `DWH01` in header partial (`header.ejs:25`) — not dynamic.
- Sort column headers use inline `onclick=` handlers; no keyboard alternative.

### Compliance header coverage

All views include `header.ejs` and `footer.ejs` which carry the IS-004 security
notice, environment indicator, and internal-use-only marking. No file-level
compliance header comments exist on any `.ejs` or `.js` file (required by
`.bob/rules/02-compliance-headers.md`).

---

## API consumers

Per the epic, `/api/payment-status` and `/api/risk-score` are consumed by three
downstream teams. Replacing these endpoints requires behavioral equivalence
proof (rule 08) before the legacy paths are retired.

---

## Test coverage

Zero test files. No test runner configured. No `npm test` script exists
(`package.json:7–10`).

---

## Dependency audit

| Package | Version | Approved | Gap |
|---------|---------|----------|-----|
| express | ^4.22.2 | ✅ | — |
| ejs | ^3.1.10 | ✅ | — |
| better-sqlite3 | ^12.11.1 | ✅ | — |
| helmet | not installed | ✅ approved, missing | Security headers |
| express-validator | not installed | ✅ approved, missing | Input validation |
| dotenv | not installed | ✅ approved, missing | Secrets management |
| pino | not installed | ✅ approved, missing | Structured logging |
| jest / supertest | not installed | ✅ approved, missing | Testing |
