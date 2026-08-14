# KAN-102 — Modernization plan: Payment-Status Service + Governed Agent

| | |
|---|---|
| **Epic** | KAN-102 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- Both public API endpoints (`GET /api/payment-status`, `GET /api/risk-score`) build SQL by string concatenation with unsanitized query parameters — 2 of 14 injection sites in the file (`server.js:535–537`, `server.js:597`). The single prepared-statement usage in the file (`server.js:306`) proves the pattern is available but has not been applied to the API routes.
- Two secrets are hardcoded as literals: SMTP password `meridian2013!` (`server.js:43`) and ERP feed key `ERP-POLL-KEY-8842` (`server.js:49`). Neither has ever been read from the environment.
- The two endpoints have zero test coverage; the repo contains no test files of any kind. The parity suite will be net-new.
- `GET /api/risk-score` accepts only `?ref=`; `GET /api/payment-status` accepts both `?ref=` and `?invoice=`. This asymmetry is undocumented in the README and will be preserved exactly in v2.
- Three downstream consumers rely on the current response contracts: the AP hotline desk (~340 calls/week on `payment-status`), the vendor enquiry traffic-light system (`risk-score`), and the overnight vendor chaser (SMTP, not touching these endpoints). Field naming is inconsistent across the two responses (`PaymentRef`/`sts`/`remit_TO` vs `REF`/`SCORE`/`BAND`) and must be preserved.

**Why this is worth doing now:** The AP hotline absorbs ~340 vendor inquiries per week that a governed self-service agent could resolve; the injection vulnerabilities and hardcoded secrets represent PCI-DSS and SOX findings that cannot remain open.

## Target state

The two API endpoints are replaced by equivalence-proven v2 handlers mounted at `/api/v2/payment-status` and `/api/v2/risk-score`, using parameterized queries and environment-sourced secrets. Legacy routes remain mounted at their original paths until all three downstream consumers migrate. A governed watsonx Orchestrate agent — reachable at `+1 (415) 338-9157` and in web chat — wraps the v2 service under a read-only identity and surfaces only: status, expected pay date, hold reason, risk band, and vendor name. Bank routing data, clerk names, and all other fields remain internal.

**Workstreams**

1. **Modernize** — v2 routes, parameterized SQL, secrets to env, parity suite, compliance headers.
2. **Agent** — MCP tool layer over v2, watsonx Orchestrate agent, read-only vault identity, boundary proof (authorized read passes, write refused).

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | KAN-102-ST1: Modernize payment-status service | `GET /api/v2/payment-status`, `GET /api/v2/risk-score`; parameterized SQL; `SMTP_PASS`, `ERP_FEED_KEY` moved to `process.env`; compliance headers; parity suite | (a) Parity suite green: both v2 routes return status 200 and byte-identical JSON to legacy on nominal paths; 400/404 error shapes match; zero unexplained diffs. (b) No string-concatenated SQL in the two new handlers. (c) `server.js` contains no literal `SMTP_PASS` or `ERP_FEED_KEY` values. (d) Change-log entry written. | 2026-08-19 |
| 2 | KAN-102-ST2: Build governed AI agent | MCP endpoint over v2; watsonx Orchestrate agent; vault-scoped read-only identity; phone `+1 (415) 338-9157`; field filter (status, expected pay date, hold reason, risk band, vendor name only) | (a) Agent resolves a payment-status lookup by ref and by invoice number. (b) Agent resolves a risk-score lookup by ref. (c) A write operation is refused with the identity and scope stated in the refusal. (d) `bank_bic`, `remit_to`, clerk names absent from all agent responses. (e) Boundary proof output quoted in PR body. | 2026-08-21 |

## Out of scope

- `/api/exceptions.xml` ERP feed — active 15-min poll; modernization is a follow-on epic to avoid disrupting overnight reconciliation.
- All UI/EJS routes (`/`, `/exceptions`, `/reports`, `/help`) — follow-on epic per the original epic description.
- SMTP vendor chaser batch — uses the hardcoded credentials as a caller, not a recipient; follow-on after secrets rotation is confirmed stable.
- Hard-deleting or altering the legacy `/api/payment-status` and `/api/risk-score` handlers — they remain mounted until downstream consumers confirm migration.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` |
| **Input matrix** | Nominal (valid ref), nominal (valid invoice, payment-status only), not-found (unknown ref), missing param (400 path), boundary (ref with special characters) |
| **Comparison** | HTTP status code, full JSON body field-for-field including field names and value types; money precision (`amt_cents` integer); error shapes (`ERR`, message fields) |
| **Intended differences** | None — v2 response contract is identical to legacy |
| **Exit criteria** | ≥ 5 cases per endpoint, zero unexplained diffs, suite runs in CI on every PR |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Mount v2 at `/api/v2/*`; legacy stays live | Swap-on-green (replace legacy in same PR) | Three consumers with no confirmed migration date; a broken overnight reconciliation is a SOX finding |
| Agent surfaces 5 named fields only; bank routing and clerk data withheld | Expose full response payload | Vendor bank details and clerk names are PII/internal-routing data; least-privilege per rule 11 |
| Secrets move to `process.env` in ST1; SMTP caller migration is follow-on | Rotate secrets and update all callers in this epic | SMTP chaser is out of scope; rotating a secret while its only caller is untouched breaks the chaser |
| XML feed excluded from this epic | Modernize all three API endpoints together | 15-min ERP poll; risk of reconciliation outage outweighs the gain of bundling it here |

## Open items

*(none)*

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-102 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-102 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
