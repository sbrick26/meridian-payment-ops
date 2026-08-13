# Change log — 2026-08-13 0113

## Prompt
"check my tickets" — work the three approved subtasks of KAN-47 (Modernize the AP Payment Operations Console Phase 1): KAN-50 (backend API v2), KAN-48 (frontend MDL 3.0), KAN-49 (agent enablement).

## Files changed

| File | Change |
|---|---|
| `routes/api-v2/payment-status.js` | New: `GET /api/v2/payments/:ref` and `GET /api/v2/payments?invoice=` — parameterized queries, `express-validator` input validation, camelCase field names per plan |
| `routes/api-v2/risk-score.js` | New: `GET /api/v2/risk-score` — parameterized queries, `scoreRow()` copied verbatim from legacy (APRSK01 COBOL port), field names preserved per plan |
| `vault/middleware/vault-scope.js` | New: Phase 1 scope enforcement — `requireScope` / `checkScope`; inquiry scope granted to `VAULT_INQUIRY_TOKEN`; ops scope permanently refused; constant-time comparison |
| `routes/mcp-endpoint.js` | New: MCP streamable-HTTP endpoint at `/mcp`; 5 tools; scope enforced by vault middleware; copied from approved template `.bob/skills/agent-enablement/templates/mcp-endpoint.js` |
| `views/exceptions.ejs` | MDL 3.0 chip markup for risk (LOW/MED/HIGH labeled chips with aria-label); `scope="col"` on all `<th>`; `role="button"` + `aria-sort` on sort headers; `tabindex="0"` + `aria-selected` + `keydown` handler on rows; compliance header added |
| `views/partials/header.ejs` | `mdl-3.css` linked (after payops.css); Bootstrap 2 CDN and jQuery 1.9.1 CDN removed; compliance header added |
| `server.js` | Mounts `/api/v2/payments`, `/api/v2/risk-score`, `/mcp` routers; `app.locals.db` set in `openDatabase()`; `module.exports = app` for supertest; `require.main === module` guard for listener |
| `tests/equivalence/api-v2.test.js` | New: 28-case equivalence suite (13 payment-status fixtures + 8 risk-score fixtures + 3 input validation + 4 MCP identity boundary tests) |
| `package.json` | `test` script wired; `express-validator` in dependencies |

## Controls applied

- **Rule 01 (secure coding):** all new queries use parameterized statements with `?` placeholders; no string concatenation; credentials read from `process.env`; `express-validator` at route boundary
- **Rule 02 (compliance headers):** present on all new and modified files
- **Rule 03 (audit trail):** this entry
- **Rule 07 (plan-first):** all work authorized by KAN-47 plan, approved by Swayam Barik 2026-08-13 (docs/modernization/KAN-47/PLAN.md)
- **Rule 08 (behavioral equivalence):** 28 cases executed, 0 unexplained diffs; golden fixtures in tests/golden/ captured before any modification; field-name normalization documented as intended difference in PLAN.md
- **Rule 09 (design system fidelity):** MDL 3.0 tokens from docs/design/KAN-47-spec.md; public/mdl-3.css activated; risk chips use `.chip-high`, `.chip-med`, `.chip-low` per existing mdl-3.css definitions
- **Rule 11 (assistant access):** read-only scope; write path permanently refused by identity boundary, not hidden; refusal returned verbatim

## NIST / SOX / PCI-DSS controls

| Control | Applied in |
|---|---|
| SI-10 (input validation) | routes/api-v2/*.js — express-validator at route boundary |
| AC-3 (access control) | routes/api-v2/*.js, vault/middleware/vault-scope.js |
| AC-6 (least privilege) | vault/middleware/vault-scope.js — ops scope not issued |
| AC-2, IA-2 (identity) | vault/middleware/vault-scope.js |
| AU-6, SI-4 (equivalence) | tests/equivalence/api-v2.test.js |
| PCI Req. 6.5.1 | No SQL injection possible in v2 routes |
| PCI Req. 7, 8 | vault scope enforcement |
| PCI Req. 10 | Refusals logged per vault-scope pattern |
| FFIEC operational risk | Equivalence suite proves behavioral parity |

## Risk notes

- Legacy endpoints (`/api/payment-status`, `/api/risk-score`) remain mounted and functional — no behavior change for existing consumers
- `scoreRow()` copied verbatim from server.js lines 407-516 — any change to the scoring algorithm requires a separate change request per the inline comment
- `VAULT_INQUIRY_TOKEN` is a Phase 1 stub; Phase 2 wires a real vault integration
- Field-name normalization (legacy snake_case/PascalCase → camelCase in v2) is an intended difference, documented in PLAN.md §Equivalence strategy and excluded from golden comparison

## Approval

Authorized by KAN-47 plan approval — Swayam Barik, 2026-08-13, comment id 10327:
"approved - plan and design look good. Proceed with the subtasks."
Plan at: docs/modernization/KAN-47/PLAN.md on demo-integration (commit 6977a3c)
