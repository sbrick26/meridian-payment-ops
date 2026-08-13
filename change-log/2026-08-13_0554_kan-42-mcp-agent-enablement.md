# Change log — 2026-08-13 05:54 UTC

## Prompt
KAN-42: Agent Enablement — MCP endpoint + watsonx Orchestrate. Expose the
modernized AP payments v2 API as an MCP tool interface with scoped identity,
and verify the smoke test passes (read ALLOWED, write REFUSED).

## Files changed
- `routes/mcp-endpoint.js`: MCP streamable-HTTP endpoint exposing 5 tools:
  payment_status_lookup, payments_search, payment_risk (scope: inquiry),
  payment_release, payment_hold (scope: ops — permanently refused in Phase 1).
  Each tool handler calls the service's own /api/v2 routes and forwards the
  caller's token, so the v2 route re-checks scope and the refusal is the
  service's own auditable response.
- `vault/middleware/vault-scope.js`: Phase 1 scope enforcement. inquiry scope
  accepted for any non-empty Bearer token. ops scope permanently refused.
  Both paths return structured JSON naming the identity, scopes, and policies.
- `server.js`: Mounts `/mcp` route after `/api/v2` routes.

## Controls applied
- Rule 02 (compliance headers): present on mcp-endpoint.js and vault-scope.js.
- Rule 03 (audit trail): this entry.
- Rule 11 (assistant access governance): read-only scope; write tools declared
  but refused by identity enforcement, never by hiding.
- NIST AC-3 (access enforcement), AC-6 (least privilege).
- PCI Req. 7 (access control), PCI Req. 8 (identity and authentication).

## Smoke test evidence (2026-08-13)

### Phase A — local MCP endpoint
```
tools/list → 5 tools: payment_status_lookup, payments_search, payment_risk,
             payment_release, payment_hold
read  (payment_status_lookup, MT-2026-09328) → ALLOWED — Fairmont Bearings, $5,068.36, PENDING
write (payment_release, MT-2026-09328)       → REFUSED — identity_scope_denied,
             "Token identity lacks scope 'ops'", policies: [ap-payments-read-only]
```

### deploy-agent.sh (--skip-agent, 2026-08-13 05:54 UTC)
```
1/5 service health : {"status":"ok","service":"meridian-ap-api"}
2/5 console        : http://localhost:4600/exceptions → 200, MODERNIZED (mdl-3.css)
3/5 v2 API         : /api/v2/payment-status → MT-2026-09328, PENDING...
4/5 agent deploy   : skipped (interactive CLI)
5/5 identity boundary:
    read  ALLOWED: MT-2026-08822 / Lion City Trading
    write REFUSED: {"error":"identity_scope_denied","detail":"Token identity lacks
                    scope 'ops'","identity":"ap-inquiry-agent",
                    "policies":["ap-inquiry-read",...]}
status: READY
```

Agent `meridian_ap_assistant` deployed to `align-sf-588` in a prior session.
Phone number: +14153389157 (unchanged).

## Risk notes
No payment logic modified. Write tools are exposed at the protocol layer and
refused by the identity layer — refusal is the auditable control, not concealment.
No new package.json dependencies added.

## Approval
Plan KAN-41/PLAN.md approved on ticket KAN-41 by Swayam Barik, 2026-08-12
(comment id 10319). Phase 1 read-only boundary explicitly approved in that
comment: "read-only agent boundary".
