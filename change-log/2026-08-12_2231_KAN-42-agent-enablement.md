# KAN-42 Phase A — MCP endpoint + vault scope middleware

| | |
|---|---|
| **Prompt** | KAN-42 Phase A implementation (MCP endpoint + vault scope middleware) |
| **Date** | 2026-08-12 |
| **Author** | bobdev |
| **Branch** | feature/KAN-41-implementation |

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `routes/mcp-endpoint.js` | Created | Streamable-HTTP MCP endpoint; 5 tools; no new npm dependencies |
| `vault/middleware/vault-scope.js` | Created | Phase 1 scope enforcement middleware (AC-3, AC-6) |

## Controls applied

| Control | Reference |
|---------|-----------|
| AC-3 | Access enforcement — every tool route gated by `requireScope()`; write tools gated on `ops` scope, permanently refused in Phase 1 |
| AC-6 | Least privilege — inquiry-only identity; no token holds `ops`; write path unreachable without a separate identity policy |
| NIST SP 800-53 rule 11 | Audit record on every scope refusal: structured JSON error body names the required scope, the granted scopes, and the enforcing policies |
| PCI Req. 7 | Access control: read/write scopes declared per tool; router-level gate (`requireScope('inquiry')`) ensures no unauthenticated call reaches the tool dispatcher |
| PCI Req. 8 | Identity enforcement: `requireScope` reads the Bearer token from `Authorization` or `x-vault-token`; a missing or empty token is refused 401 before any tool is invoked |

## What was built

### `routes/mcp-endpoint.js`

- Streamable-HTTP JSON-RPC 2.0 endpoint; answers `initialize`, `tools/list`, `tools/call`, `ping`, and notifications.
- Five tools declared:
  - `payment_status_lookup` (inquiry) → `GET /api/v2/payment-status?ref=` or `?invoice=`
  - `payments_search` (inquiry) → `GET /api/v2/payment-status?status=&q=`
  - `payment_risk` (inquiry) → `GET /api/v2/risk-score?ref=`
  - `payment_release` (ops) → POST path intentionally non-existent; ops scope fires before upstream call
  - `payment_hold` (ops) → same as above
- Router-level `requireScope('inquiry')` gates the entire endpoint; per-tool `checkScope` provides the inner enforcement and returns the structured refusal as a tool result so the assistant can relay it verbatim.
- No MCP SDK, no new `package.json` dependencies — Express + Node stdlib only.
- Tool results relay the service's own `/api/v2` responses verbatim; no business logic in this file.

### `vault/middleware/vault-scope.js`

- Compliance header: AC-3, AC-6, PCI Req. 7, PCI Req. 8.
- `requireScope(scope)` — Express middleware factory. Returns 401 (no token), 403 (ops denied or unknown scope), or calls `next()` (inquiry with non-empty token).
- `checkScope(token, scope)` — async function for use in the MCP invoke path. Returns `{ allowed, scopes, policies, error }`.
- Identity tier in Phase 1: `GRANTED_SCOPES = ['inquiry']`, `POLICIES = ['ap-payments-read-only']`.

## Verification results

```
$ node --check routes/mcp-endpoint.js && echo "OK"
OK

$ node --check vault/middleware/vault-scope.js && echo "OK"
OK

$ node -e "
const {checkScope} = require('./vault/middleware/vault-scope');
async function test() {
  const r1 = await checkScope('Bearer test-token-123', 'inquiry');
  console.log('inquiry:', JSON.stringify(r1));
  const r2 = await checkScope('Bearer test-token-123', 'ops');
  console.log('ops:', JSON.stringify(r2));
}
test().catch(console.error);
"
inquiry: {"allowed":true,"scopes":["inquiry"],"policies":["ap-payments-read-only"],"error":null}
ops:     {"allowed":false,"scopes":["inquiry"],"policies":["ap-payments-read-only"],"error":null}
```

**Identity boundary confirmed:** `inquiry.allowed=true`, `ops.allowed=false`.

## Orchestrate environment check

```
$ orchestrate env list
tko-pilot-wxo     https://api.us-south.watson-orchestrate.cloud.ibm…  (active)
align-sf          https://api.ca-tor.watson-orchestrate.cloud.ibm.c…
align-sf-588      https://api.us-south.watson-orchestrate.cloud.ibm…
align-sf-prod     https://api.us-south.watson-orchestrate.cloud.ibm…
...
```

**Finding:** `tko-pilot-wxo` is active; `align-sf` is listed but **not active**. Per the
agent-enablement skill and task instructions, no environment activation was performed on own
initiative. Phase B (agent import) and Phase C–F (toolkit, connection, deploy, smoke test) are
blocked until a human operator activates `align-sf`.

## Orchestrate platform state (active env: tko-pilot-wxo)

- `orchestrate agents list`: no `meridian_ap_assistant` present in `tko-pilot-wxo`.
- `orchestrate toolkits list`: one toolkit `workday_promotion` (MCP, Workday); no `ap_payments_tools`.
- `orchestrate tools list`: all tools belong to EIB/Job Change/Workday workflows; no AP payment tools.
- `orchestrate connections list`: connections are `jobreq_kv`, `teams_notify_creds`, `workday_ibm_184bdbd3`; no `ap_inquiry_identity`.

None of these objects were created — they belong to the wrong environment. All Phase B–F objects
(`ap_inquiry_identity` connection, `ap_payments_tools` toolkit, `meridian_ap_assistant` agent) must
be created after `align-sf` is activated.

## Risk notes

- **Phase 1 uses stub Vault middleware.** `requireScope('inquiry')` grants access to any non-empty
  Bearer token — no real Vault server lookup. The boundary is demonstrated by the ops scope being
  permanently refused regardless of token value. Real Vault integration (KV v2 token validation,
  PKI cert binding) is a follow-on.
- **Write path is exposed (tools declared) but unreachable at the scope layer.** `payment_release`
  and `payment_hold` are declared in the tool catalogue so the identity refusal can be demonstrated.
  The `requireScope('ops')` check fires inside `invoke()` before any upstream HTTP call; the
  `/api/v2/payment-status/release` and `/api/v2/payment-status/hold` paths do not exist in Phase 1.
  A caller with only the inquiry scope will receive the structured `identity_scope_denied` JSON
  as a tool result, as designed.
- **Server.js not touched.** Mounting (`app.use('/mcp', require('./routes/mcp-endpoint'))`) is
  left to the parent task per instructions.

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-12 |
| **Recorded on** | KAN-41 Jira comment 10319 |
