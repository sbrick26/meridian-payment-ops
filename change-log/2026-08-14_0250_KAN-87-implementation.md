# Change log — KAN-87 implementation (service slice + agent slice)

| | |
|---|---|
| **Date** | 2026-08-14 02:50 UTC |
| **Author** | IBM Bob / payments-platform-team |
| **Epic** | KAN-87 |
| **Approved by** | Swayam Barik, 2026-08-13 (KAN-87 comment ID 10362) |

## Prompt

Epic KAN-87 approved — implement both slices (service modernization + governed agent).

## Files changed

| Path | Change |
|---|---|
| `server.js` | Require v2 route modules + mcp-endpoint; move `SMTP_PASS`, `ERP_FEED_KEY`, `ERP_FEED_USER`, `ERP_FEED_ROWS`, `APPROVAL_LIMIT_CENTS` to `process.env`; mount `/api/v2/*` and `/mcp`; add `Deprecation` header on legacy routes |
| `routes/api-v2/payment-status.js` | New — parameterized `GET /api/v2/payment-status` handler (replaces injectable legacy at server.js:525-586) |
| `routes/api-v2/risk-score.js` | New — parameterized `GET /api/v2/risk-score` handler (replaces injectable legacy at server.js:588-625) |
| `routes/mcp-endpoint.js` | New — MCP JSON-RPC tool layer; exposes `payment_status_lookup`, `payment_risk`, `payment_release` (permanently refused); PII filter strips `BankBIC`, `remit_TO`, `Clerk`, `clerk_initials` |
| `vault/middleware/vault-scope.js` | New — Vault token identity resolution, scope enforcement, governance event emission |
| `tests/equivalence.test.js` | New — 12-case live-vs-live equivalence suite (PS-01..PS-07, RS-01..RS-05) |
| `package.json` | Added `test` and `golden` scripts; added `express-validator`, `node-fetch` dependencies |
| `scripts/capture-golden.js` | New — golden fixture capture script (committed before any server.js edit) |
| `tests/golden/*.json` | 8 pre-change legacy response fixtures (separate commit, before this one) |
| `change-log/2026-08-14_0250_KAN-87-implementation.md` | This entry |

## Env vars declared (ops team provisions values — rule 01)

| Variable | Replaces |
|---|---|
| `PAYOPS_SMTP_PASS` | hardcoded `'meridian2013!'` (server.js L44) |
| `PAYOPS_ERP_FEED_KEY` | hardcoded `'ERP-POLL-KEY-8842'` (server.js L49) |
| `PAYOPS_ERP_FEED_USER` | hardcoded `'ERPBATCH01'` (server.js L48) — falls back to `'ERPBATCH01'` if unset |
| `PAYOPS_ERP_FEED_ROWS` | hardcoded `200` (server.js L50) — falls back to `200` if unset |
| `PAYOPS_APPROVAL_LIMIT_CENTS` | hardcoded `5000000` (server.js L53) — falls back to `5000000` if unset |

## Controls applied

| Rule | Control |
|---|---|
| Rule 01 | SC-13, SC-28, PCI Req. 3 — secrets removed from source; `process.env` pattern only |
| Rule 01 | SI-10, PCI Req. 6.5.1 — parameterized queries replace string-concatenated SQL |
| Rule 02 | AU-2, compliance headers on all new files |
| Rule 03 | AU-2, AU-12 — this entry |
| Rule 04 | CM-2, CM-6 — only approved libraries added (`express-validator`, `node-fetch`) |
| Rule 07 | CM-2 — plan approved before implementation; plan path `docs/modernization/KAN-87/PLAN.md` |
| Rule 08 | AU-6, SI-4 — 8 golden fixtures captured pre-change; 12/12 equivalence cases pass; 0 unexplained diffs |
| Rule 11 | AC-6, AC-2, IA-2, PCI Req. 8 — `payment_release` permanently refused; vault-scope enforces read-only identity |

## Equivalence result

**12/12 cases executed. 0 unexplained differences. Suite runs in CI.**

| Case | Description | Result |
|---|---|---|
| PS-01 | payment-status nominal hit by ref | ✔ |
| PS-02 | payment-status nominal hit by invoice | ✔ |
| PS-03 | ESCALATED / HIGH risk row | ✔ |
| PS-04 | RESOLVED row (resolved_date + resolution populated) | ✔ |
| PS-05 | 404 miss by ref | ✔ |
| PS-06 | 404 miss by invoice | ✔ |
| PS-07 | 400 missing param | ✔ |
| RS-01 | risk-score nominal (LOW) | ✔ |
| RS-02 | HIGH risk row | ✔ |
| RS-03 | MED risk row | ✔ |
| RS-04 | 404 miss | ✔ |
| RS-05 | 400 missing ref | ✔ |

## Risk notes

- `statusDescription()` in the template diverged from legacy (rule 08 finding pre-empted): corrected to match `server.js:676-683` verbatim before any test run.
- Legacy routes untouched (plan decision: v2 is purely additive); `Deprecation` header is additive and not part of the equivalence comparison.
- `payment_release` tool is exposed but permanently refused — the refusal is the control, not hiding the operation (rule 11(b)).
- Four other injectable routes (`/exceptions`, POST resolve, CSV export, XML feed) remain out of scope per approved plan.

## Approval

Plan approved by Swayam Barik, 2026-08-13, KAN-87 comment ID 10362.
