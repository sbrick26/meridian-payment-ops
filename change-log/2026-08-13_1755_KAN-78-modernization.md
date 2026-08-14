# Change log — 2026-08-13_1755 — KAN-78 modernization: service + agent

## Prompt

"check my tickets" — session-start with KAN-78 In Review, approval comment on record.
Executed PHASE 3: implement both subtasks (service modernization and agent enablement).

## Files changed

| Path | Change |
|---|---|
| `docs/modernization/KAN-78/PLAN.md` | Approval section filled in (approver: Swayam Barik, 2026-08-13, comment id 10349) |
| `server.js` | (a) All 6 config literals moved to `process.env`; (b) v2 routes and MCP endpoint mounted; (c) Legacy `/api/payment-status` and `/api/risk-score` annotated with `Deprecation: true` and `Link` successor headers; (d) `module.exports = app` added for supertest; (e) Changelog entry in file header |
| `package.json` | Version 2.4.1 → 2.5.0; `test` script added; `express-validator` added as dependency; `jest` and `supertest` as devDependencies |
| `routes/api-v2/payment-status.js` | New. Parameterized replacement for `GET /api/payment-status`. Identical response contract proven by equivalence suite |
| `routes/api-v2/risk-score.js` | New. Parameterized replacement for `GET /api/risk-score`. Identical scoring logic (APRSK01), identical response contract |
| `routes/mcp-endpoint.js` | New. MCP tool layer over v2 endpoints. Tools: `payment_status_lookup` (inquiry), `payment_risk` (inquiry), `payment_release` (ops — always refused). Adapted from template |
| `vault/middleware/vault-scope.js` | New. Production-proven Vault scope enforcement middleware copied verbatim from `.bob/skills/agent-enablement/templates/vault-scope.js` |
| `tests/golden/ps-01-nominal-ref.json` … `rs-06-400-missing.json` | 14 golden fixture files captured from unmodified legacy handlers before any code change (rule 08) |
| `tests/equivalence.test.js` | New. 14-case equivalence suite; runs legacy and modern endpoints in parallel, asserts identical status codes, body fields, Content-Type, and correct `Deprecation` headers |

## Controls applied

| Rule | Control |
|---|---|
| Rule 01 (secure coding) | All 6 literals removed from source; replaced with `process.env` reads with safe fallbacks |
| Rule 01 (SQL injection) | v2 routes use `db.prepare(...).get(param)` — parameterized throughout |
| Rule 02 (compliance headers) | Every new file carries the required compliance header comment |
| Rule 03 (audit trail) | This file |
| Rule 07 (plan-first) | Plan approved by Swayam Barik on 2026-08-13 before implementation began |
| Rule 08 (behavioral equivalence) | Golden fixtures captured before modification; equivalence suite reports 14/14, 0 unexplained diffs |
| Rule 09 (design fidelity) | Figma frames KAN-78 BEFORE / AFTER rendered and approved as part of plan |
| Rule 11 (agent access governance) | Agent identity `ap-inquiry-agent` holds only `inquiry` scope; `payment_release` tool refused at scope check |
| NIST SI-10 | Input validated via `express-validator` at route boundary |
| NIST AC-6 | Agent scope model: inquiry allowed, ops refused |
| PCI Req. 6.5.1 | Parameterized queries eliminate SQL injection surface for agent-facing endpoints |

## Risk notes

- Legacy routes remain mounted and are the only paths touched by the ERP batch bridge and
  the Vendor Enquiry Desk; no consumer migration is required in this epic.
- `bank_bic` and clerk names are intentionally excluded from the agent data surface
  (PCI scope / operator PII). This is a deliberate difference in the agent response,
  not an equivalence violation — the agent calls `/api/v2/*`, not the legacy routes.
- The `ops` scope is never granted to the `ap-inquiry-agent` identity; `payment_release`
  and `payment_hold` tools will always return `identity_scope_denied`.

## Approval

Authorized under approved plan `docs/modernization/KAN-78/PLAN.md`.
Approver: Swayam Barik. Date: 2026-08-13. Jira comment id: 10349.
