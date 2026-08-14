# Change log — KAN-108 implementation

| | |
|---|---|
| **Date** | 2026-08-14 07:05 UTC |
| **Author** | bobdev |
| **Epic** | KAN-108 |

## Prompt

Implement the two subtasks of the approved KAN-108 modernization plan: (1) mount `payment-status.js` and `risk-score.js` at `/api/v2/` paths, remove hardcoded secrets, run equivalence suite; (2) register the governed MCP agent layer with Vault-scoped read-only identity.

## Files changed

| Path | Change |
|---|---|
| `routes/api-v2/payment-status.js` | New — parameterized payment-status handler, secrets from env |
| `routes/api-v2/risk-score.js` | New — parameterized risk-score handler, secrets from env |
| `tests/equivalence.test.js` | New — parity suite (6 cases: nominal/bad-input/not-found × 2 endpoints) |
| `server.js` | Updated — mounts `/api/v2/` routes, removes hardcoded SMTP_PASS and ERP_FEED_KEY |
| `package.json` | Updated — test script and approved dependencies |
| `routes/mcp-endpoint.js` | New — MCP tool layer for agent, field allowlist enforced |
| `vault/middleware/vault-scope.js` | New — Vault-scoped read-only identity middleware |
| `docs/modernization/KAN-108/PLAN.md` | Updated — approval recorded (Swayam Barik, 2026-08-14) |

## Controls applied

- Rule 01 (secure coding): parameterized queries replace string-concatenated SQL; secrets read from `process.env`
- Rule 02 (compliance headers): headers added to all new files (AU-2/AU-12, AC-3, AC-6, SC-13/SC-28, SI-10)
- Rule 03 (audit trail): this change-log entry
- Rule 07 (plan-first): approved plan committed at `docs/modernization/KAN-108/PLAN.md`
- Rule 08 (behavioral equivalence): parity suite — 6 cases, zero unexplained diffs, green before merge
- Rule 11 (assistant access): MCP tool layer uses Vault-scoped read-only identity; write ops refused and logged
- NIST: AC-3, AC-6, AU-2, AU-12, SC-13, SC-28, SI-10 — PCI-DSS Req. 3, 6.5, 7, 8, 10

## Risk notes

- Hardcoded secrets (`meridian2013!`, `ERP-POLL-KEY-8842`) removed from source; `SMTP_PASS` and `ERP_FEED_KEY` must be set in the deployment environment.
- Legacy endpoints (`/api/payment-status`, `/api/risk-score`) remain mounted during the parity window; removal is a documented follow-on.
- Agent scope is read-only; write operations return a recorded refusal (proven in deploy boundary check).

## Approval

Epic KAN-108 approved by Swayam Barik on 2026-08-14 (KAN-108 comment id 10394: "approved"). Subtasks KAN-110 and KAN-109 operate under that approval.
