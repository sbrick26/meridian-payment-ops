# Change log — KAN-95 implementation

| Field | Value |
|---|---|
| **Date** | 2026-08-14 04:05 UTC |
| **Author** | bobdev |
| **Epic** | KAN-95 |
| **Branch** | feature/KAN-95-implementation |

## Prompt

"check tickets" — routed to KAN-95 In Review (approval on record from Swayam Barik, 2026-08-13). Execute PHASE 3: implement both slices, run equivalence suite, open PR.

## Files changed

| File | Summary |
|---|---|
| `docs/modernization/KAN-95/PLAN.md` | Recorded approval (Swayam Barik, 2026-08-13, comment 10370) and design review |
| `server.js` | Externalized 3 hardcoded secrets to `process.env`; required and mounted v2 route modules and MCP endpoint; added `Deprecation` + `Link` headers on legacy routes; compliance header added |
| `routes/api-v2/payment-status.js` | New: parameterized v2 handler for `GET /api/v2/payment-status` (copied from gate-proven template) |
| `routes/api-v2/risk-score.js` | New: parameterized v2 handler for `GET /api/v2/risk-score` (copied from gate-proven template) |
| `routes/mcp-endpoint.js` | New: MCP tool layer (inquiry scope; write permanently refused) |
| `vault/middleware/vault-scope.js` | New: Vault agent-identity scope enforcement middleware |
| `tests/equivalence.test.js` | New: live-vs-live parity suite — 12 cases, 12 pass, 0 diffs |
| `package.json` | Added `express-validator`, `node-fetch` dependencies; added `test` script; version bumped to 2.5.0 |

## Controls applied

| Rule | NIST 800-53 | SOX / PCI-DSS |
|---|---|---|
| Rule 01 — secrets via process.env | SC-28 | PCI-DSS Req. 3 |
| Rule 02 — compliance headers | AU-2, AU-12 | SOX 404 |
| Rule 03 — change log (this file) | AU-12 | PCI-DSS Req. 10 |
| Rule 07 — plan-first delivery | CM-2, CM-6 | SOX ITGC |
| Rule 08 — behavioral equivalence | SI-4 | FFIEC operational risk |
| Rule 11 — agent identity / scope | AC-3, AC-6 | PCI Req. 7, 8 |

## Risk notes

- **Secrets externalized**: `SMTP_PASSWORD`, `ERP_FEED_KEY`, and `ENVIRONMENT` were hardcoded in `server.js` (lines 44, 49, 35 pre-patch). They are now read from `process.env`. The `.env` file is blocked by `.bobignore` — operators must set these environment variables before starting the service.
- **Legacy routes unchanged**: `GET /api/payment-status` and `GET /api/risk-score` are preserved unchanged (only `Deprecation` headers added). No downstream consumer is broken.
- **PII filter active on MCP endpoint**: `BankBIC`, `remit_TO`, `Clerk`, `clerk_initials` stripped before responses reach the agent layer.
- **Write scope refused**: `payment_release` tool is listed and permanently refused (identity_scope_denied) — the refusal is the auditable control (rule 11(b)).

## Equivalence

Parity suite result: **12/12 pass, 0 unexplained diffs.**
Cases: PS-01 through PS-07 (payment-status), RS-01 through RS-05 (risk-score).
Suite runner: `node --test tests/equivalence.test.js`.

## Approval

Authorized under KAN-95 plan approved by **Swayam Barik** on **2026-08-13**,
Jira comment ID 10370: *"approved"*.
