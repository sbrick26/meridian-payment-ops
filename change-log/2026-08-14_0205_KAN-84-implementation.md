# 2026-08-14 02:05 UTC — KAN-84 implementation: modernize payment-status service and governed AI agent

## Prompt
KAN-84 (approved by Swayam Barik, 2026-08-13): Modernize the legacy payment-status service and expose it through a governed AI agent.

## Files changed

| Path | Change |
|------|--------|
| `docs/modernization/KAN-84/PLAN.md` | Modernization plan — approval recorded |
| `tests/golden/ps-01-ref-hit.json` | Golden fixture: PS nominal hit by ref |
| `tests/golden/ps-02-invoice-hit.json` | Golden fixture: PS nominal hit by invoice |
| `tests/golden/ps-03-escalated-high.json` | Golden fixture: PS ESCALATED/HIGH row |
| `tests/golden/ps-04-resolved.json` | Golden fixture: PS RESOLVED row |
| `tests/golden/ps-05-404-ref.json` | Golden fixture: PS 404 miss by ref |
| `tests/golden/ps-06-404-invoice.json` | Golden fixture: PS 404 miss by invoice |
| `tests/golden/ps-07-400-missing.json` | Golden fixture: PS 400 missing param |
| `tests/golden/rs-01-ref-hit-low.json` | Golden fixture: RS LOW risk hit |
| `tests/golden/rs-02-ref-hit-high.json` | Golden fixture: RS HIGH risk hit |
| `tests/golden/rs-03-ref-hit-med.json` | Golden fixture: RS MED risk hit |
| `tests/golden/rs-04-404.json` | Golden fixture: RS 404 miss |
| `tests/golden/rs-05-400-missing.json` | Golden fixture: RS 400 missing ref |
| `routes/api-v2/payment-status.js` | v2 route: parameterized SQL, express-validator, identical response shape |
| `routes/api-v2/risk-score.js` | v2 route: parameterized SQL, express-validator, scoreRow verbatim copy |
| `routes/mcp-endpoint.js` | MCP JSON-RPC tool layer (payment_status_lookup, payment_risk, payment_release) |
| `vault/middleware/vault-scope.js` | Vault-scope middleware: vaultScope, requireScope, checkScope — inquiry:read only |
| `tests/equivalence.test.js` | Equivalence suite — 12 cases, 0 unexplained diffs, node:test + assert |
| `server.js` | Mount v2 routes + MCP; secrets → process.env; legacy routes + Deprecation header |
| `package.json` | Add express-validator, node-fetch; add npm test script |

## Controls applied

| Control | Reference |
|---------|-----------|
| SI-10 Input validation | PCI-DSS Req. 6.5.1 — express-validator on both v2 routes; parameterized queries replace string concatenation |
| AC-3 Data access | PCI-DSS Req. 7 — db access only through parameterized prepared statements |
| AC-6 Least privilege | SOX 404 segregation — vault-scope middleware: agent holds inquiry:read, write permanently refused |
| AC-2, IA-2 Identity | PCI-DSS Req. 8 — AGENT_IDENTITY env var; unauthenticated callers denied at requireScope |
| AU-2, AU-12 Audit | PCI-DSS Req. 10 — every denial logged as structured JSON; equivalence suite result recorded here |
| SC-28, SC-13 Secrets | PCI-DSS Req. 3 — SMTP_HOST, SMTP_USER, SMTP_PASS, ERP_FEED_USER, ERP_FEED_KEY moved to process.env |
| CM-2, CM-6 Configuration | SOX ITGC — express-validator and node-fetch added; both on approved-libraries list (rule 04) |

## Risk notes

- Legacy `/api/payment-status` and `/api/risk-score` routes remain mounted with `Deprecation: version="1"` and `Sunset: 2026-11-13`. No legacy behavior was removed.
- Secrets replaced with `process.env` reads with empty-string fallback. ERP feed and SMTP paths not exercised by the two target endpoints; behavior of those paths is unchanged.
- `payment_release` tool is listed in the MCP catalogue but scoped `ops` — permanently refused by vault-scope middleware. Denial is logged and relayed verbatim to the caller per rule 11(c).
- PII filter in `routes/mcp-endpoint.js` strips `BankBIC`, `remit_TO`, `Clerk`, `clerk_initials` from inquiry responses per plan §4 constraint.
- No test dependencies added. `node:test` and `assert` are Node built-ins.

## Equivalence result

12 cases executed. 0 unexplained differences.
- PS-01 through PS-07: payment-status endpoint (nominal, invoice, escalated/high, resolved, 404×2, 400)
- RS-01 through RS-05: risk-score endpoint (low, high, med, 404, 400)

## Approval

Authorised under KAN-84 modernization plan, approved by Swayam Barik, 2026-08-13 (Jira comment 10357).
