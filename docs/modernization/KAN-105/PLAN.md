<!-- TEMPLATE: modernization plan -->
<!-- Write to docs/modernization/KAN-105/PLAN.md. This is the ONLY planning
     document: no separate assessment, decision or equivalence files.
     Target length is roughly two pages — a three-minute read.
     Append-only once committed: add a dated revision section, do not rewrite. -->

# KAN-105 — Modernization plan: Legacy Payment-Status Service

| | |
|---|---|
| **Epic** | KAN-105 |
| **Author** | IBM Bob Modernization Engine |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- **Exposed Plaintext Credentials**: Plaintext SMTP relay credentials (`SMTP_PASS = 'meridian2013!'` at line 44) and the ERP API feed key (`ERP_FEED_KEY = 'ERP-POLL-KEY-8842'` at line 49) are hardcoded in the source code of `server.js`.
- **CRITICAL SQL Injection Vulnerabilities**: Direct string concatenation is used to interpolate user-supplied query parameters directly into SQL queries at lines 535, 537 (`/api/payment-status`), and line 597 (`/api/risk-score`) in `server.js`, posing immediate PCI-DSS and SOX compliance risks.
- **Untested & Inconsistent API Behavior**: The legacy endpoints have 0% automated test coverage, and show inconsistent parameter behavior—`/api/payment-status` accepts both reference and invoice parameters, while `/api/risk-score` accepts reference only.
- **PII and Sensitive Data Leakage**: Legacy JSON responses (`/api/payment-status` lines 565-566) return sensitive bank routing codes (`BankBIC`) and operator details (`remit_TO` and `Clerk` initials) completely unmasked and unmanaged to external inquiries.

**Why this is worth doing now:** The Accounts Payable hotline absorbs roughly 340 vendor status calls a week because nothing self-serve can be safely pointed at this legacy service. Deploying a secure virtual agent will automate these inquiries safely while remediating severe compliance and security deficiencies.

## Target state

The modernized service will expose secure, parameterized `/api/v2/payment-status` and `/api/v2/risk-score` endpoints in `server.js` that utilize custom light-weight parameter validation, read credentials from environment variables, and mask sensitive PII fields (`BankBIC` and `remit_TO`). A governed virtual agent with a Vault-scoped read-only identity will be deployed on phone number +1 (415) 338-9157, exposing only lookup capabilities and strictly refusing any attempt to alter payment states or release funds early.

**Workstreams**

1. **Modernize the service** — Build secure, parameterized `/api/v2` endpoints with custom validation, process-level configuration, and PII masking.
2. **Build the governed agent** — Expose the modernized service through an MCP tool layer with active write-refusal boundaries and live verification tests.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | Touches `server.js` route handlers, config variables, and PII masking functions. | Build `/api/v2/payment-status` and `/api/v2/risk-score` endpoints using safe SQLite parameterized statements, process-level configuration, and custom light-weight input validation. Mask `BankBIC` and `remit_TO` responses (showing only the last 4 characters, preceded by `*`s) while maintaining unmasked clerk initials. Pass 100% of golden parity tests with zero unexplained differences against legacy routes (excluding PII masking differences). | 2026-08-17 |
| 2 | Build the governed virtual agent | Touches `mcp-endpoint.js`, agent tool definition, and write-refusal testing. | Deploy an MCP tool layer exposing `payment_status_lookup` and `payment_risk` under a Vault-scoped read-only identity. Expose virtual agent on phone number +1 (415) 338-9157. Formally verify that any attempt to perform payment modifications or early releases (e.g. write-operations) is strictly refused with an auditable `403 Forbidden` response. | 2026-08-18 |

## Out of scope

- **User-Interface Build**: Any web dashboard, form redesign, or portal GUI. The Figma `KAN-105 AFTER` frame is an experiential concept mock for the Virtual Agent experience, not a code deliverable.
- **Legacy Endpoint Remediation**: Legacy `v1` endpoints (`/api/payment-status` and `/api/risk-score`) will remain mounted and completely unsecured (unparameterized) to prevent breaking any undocumented downstream legacy integrations.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | Legacy `/api/payment-status` and `/api/risk-score` logic modernized at `/api/v2`. |
| **Input matrix** | Nominal (valid refs, valid invoices), boundary (large payment centroids over approval limits, aged items), error (missing ref, non-existent ref/invoice), and write-operation attempts. |
| **Golden capture** | Done live at test execution time by querying both legacy and `/api/v2` endpoints simultaneously and comparing responses. |
| **Comparison** | Direct field-by-field verification of HTTP status, numeric precision, date formats, and error structures. |
| **Intended differences** | `/api/v2` returns masked `BankBIC` and `remit_TO` (e.g., `******1234` instead of full values). Legacy `v1` returns full raw values. |
| **Exit criteria** | Full automated parity suite executes successfully with 0 unexplained differences. |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Leave legacy `v1` endpoints unparameterized | Parameterizing legacy `v1` endpoints too | Satisfies Option B of Question 1 to minimize regression risks for existing batch integrations/ERP. |
| Store agent credentials in `process.env` with custom light validation | Standardize entire system on `.env` with `express-validator` | Satisfies Option B of Question 2 for minimal codebase change and simplicity. |
| Mask `BankBIC` and `remit_TO` on the `/api/v2` endpoints | Exclude bank details and clerk initials entirely from responses | Satisfies Option B of Question 3 to preserve structure compatibility while guarding customer/vendor PII. |

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-105 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-105 AFTER frame (ID 159:718), page "KAN-105 - Service Modernization" on Figma file `saGgyANlhq6lW8zEJd1RWu` |
