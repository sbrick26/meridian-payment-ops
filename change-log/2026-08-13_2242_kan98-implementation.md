# Change log — KAN-98 implementation

**Date:** 2026-08-13 22:42 UTC  
**Author:** bobdev  
**Epic:** KAN-98 — Modernize the legacy payment-status service and expose it through a governed AI agent  
**Authorisation:** Approved by Swayam Barik on 2026-08-13 (KAN-98 comment id 10378). Plan committed at `docs/modernization/KAN-98/PLAN.md`.

---

## Prompt

> check tickets

Routed to PHASE 3 (approved epic → implement). Session-start note confirmed KAN-98 In Review with approval on record.

---

## Files changed

| File | Change |
|---|---|
| `docs/modernization/KAN-98/PLAN.md` | Recorded approval (Swayam Barik, 2026-08-13), design review, status updated to Approved |
| `routes/api-v2/payment-status.js` | New v2 payment-status handler — parameterized SQL, express-validator, statusDescription aligned to server.js:676-683 |
| `routes/api-v2/risk-score.js` | New v2 risk-score handler — parameterized SQL, express-validator, scoreRow verbatim from server.js |
| `tests/equivalence.test.js` | Live-vs-live parity suite — 12 test cases across payment-status and risk-score (nominal, 404, 400 paths) |
| `routes/mcp-endpoint.js` | MCP tool layer — payment_status_lookup, payment_risk (inquiry scope), payment_release (ops scope — permanently refused) |
| `vault/middleware/vault-scope.js` | Vault-backed scope enforcement middleware — requireScope, checkScope, governance event emission |
| `server.js` | Mounted v2 routes at /api/v2/*; added Deprecation headers on legacy routes; required psV2, rsV2, mcpRouter; mounted /mcp |
| `package.json` | Added express-validator, node-fetch dependencies; added `test` script |

---

## Controls applied

| Control | Rule | Description |
|---|---|---|
| SI-10, AC-3 | Rule 01 | Parameterized queries replace string-concatenated SQL in the two public endpoints |
| AC-6, AC-2, IA-2 | Rule 11 | Agent identity scoped read-only (inquiry:read); write scope permanently refused at service layer |
| AU-2, AU-12 | Rule 03 | This change-log entry; governance events emitted on every allow/deny |
| CM-2, CM-6 | Rule 04 | express-validator and node-fetch added (both approved library list) |
| Plan-first | Rule 07 | Plan approved by named approver before any code written |
| Behavioral equivalence | Rule 08 | 12/12 parity suite green, 0 unexplained diffs |
| Compliance headers | Rule 02 | All new files carry owner/control/reviewed headers |

---

## Risk notes

- Legacy routes `/api/payment-status` and `/api/risk-score` are retained unchanged (dual-stack). Only v2 routes are new. Three downstream consumers unaffected.
- `statusDescription` in server.js (line 676) uses different text from the template default; v2 and the test's inline comparator have been aligned to the server.js text to ensure faithful parity.
- SMTP and ERP credentials remain hardcoded — out of scope per plan decision 3. No production credentials touched.
- `payment_release` is exposed in the MCP tool catalogue but refused with an auditable 403 — rule 11(b): the operation is not hidden.

---

## Approval

Plan approved by Swayam Barik, 2026-08-13, KAN-98 comment id 10378. Subtasks KAN-99 and KAN-100 created under KAN-98.
