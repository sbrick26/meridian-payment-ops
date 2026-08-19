# Change log — KAN-151 implementation

| | |
|---|---|
| **Date** | 2026-08-19 |
| **Branch** | feature/KAN-151-implementation |
| **Epic** | KAN-151 |
| **Author** | payments-platform-team |

## Prompt

> Assess the service and produce a short modernization plan, get it approved,
> then execute in two subtasks: (1) MODERN API - add side-by-side, parameterized,
> equivalence-proven v2 implementations of payment-status and risk-score while
> leaving the legacy endpoints mounted; (2) GOVERNED MCP + AGENT - expose the
> v2 service through MCP, enforce the dedicated ap-inquiry-agent read-only
> identity below the model, and commit the complete known-good
> meridian_ap_assistant agent, toolkit, and connection definitions. After merge,
> update that existing agent in the align-sf-690 draft environment only.

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
- Rule 07 (plan-first delivery) — implementation authorized under the approved KAN-151 plan.
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

Approved for implementation on the KAN-151 epic by Swayam Barik, 2026-08-19.
Ticket comment quoted verbatim: "approved" (comment on KAN-151).
