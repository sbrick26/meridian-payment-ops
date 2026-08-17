# Change log — KAN-120 implementation

| | |
|---|---|
| **Date** | 2026-08-17 |
| **Branch** | feature/KAN-120-implementation |
| **Epic** | KAN-120 |
| **Author** | payments-platform-team |

## Files changed

- `/api/v2` routes modernize payment status, risk, search, recent, release, and hold operations while preserving the legacy API.
- `routes/mcp-endpoint.js` exposes the complete six-tool MCP contract.
- `vault/middleware/vault-scope.js` enforces `ap-inquiry-agent` read scope and refuses operations scope.
- `agent/` contains the canonical agent, remote MCP toolkit, and connection definitions.
- The parity and identity suites verify legacy equivalence plus one allowed and one refused MCP operation.

## Controls applied

- Rule 02 (compliance headers) — governed implementation files carry the required control headers.
- Rule 03 (audit trail) — this change-log entry written at time of change.
- Rule 05 (destructive operations) — no destructive operations; `payment_release` is permanently refused and auditable (rule 11(b)).
- Rule 07 (plan-first delivery) — implementation authorized under the approved KAN-120 plan.
- Rule 11 (assistant access governance) — agent holds `inquiry:read` only; write operations (`ops` scope) are refused with an auditable 403 relayed verbatim to the caller.
- NIST AC-6 (least privilege), AC-2 (account management), IA-2 (identification and authentication).
- SOX 404 change management — change made under approved plan.
- PCI-DSS Req. 7 (restrict access), Req. 8 (identify users), Req. 10 (track access).

## Risk notes

- `payment_release` and `payment_hold` require `ops`; the inquiry identity receives the service's auditable 403 refusal (rule 11(b)).
- PII fields (`BankBIC`, `remit_TO`, `Clerk`, `clerk_initials`) are stripped from inquiry responses before reaching the caller.
- The agent identity (`ap-inquiry-agent`) holds `ap-inquiry-read` policy only. Scope enforcement is fail-closed: an unverifiable Vault token yields a 401, not a pass.
- Standing suspension (governance control plane) is checked on every request with a 5-second TTL cache; a suspension propagates within 5 s.

## Approval

Approved for implementation on the KAN-120 epic by Swayam Barik, 2026-08-17.
Ticket comment quoted verbatim: "approved" (comment on KAN-120).
