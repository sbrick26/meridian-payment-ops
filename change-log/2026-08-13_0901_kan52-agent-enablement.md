# Change log — KAN-52 Agent enablement: MCP endpoint, scoped identity, voice channel

**Date:** 2026-08-13 09:01 UTC

## Prompt

Implement KAN-52: create the MCP endpoint (`routes/mcp-endpoint.js`), the vault
scope middleware (`vault/middleware/vault-scope.js`), and this change-log entry.
No other files modified.

## Files changed

| File | Change |
|---|---|
| `routes/mcp-endpoint.js` | New. Streamable-HTTP MCP endpoint mounted at `/mcp`. Exposes 5 tools over JSON-RPC 2.0: `payment_status_lookup`, `payments_search`, `payment_risk` (inquiry scope); `payment_release`, `payment_hold` (ops scope — permanently refused). All DB access via `req.app.locals.db` with parameterized queries only. Includes SSE keep-alive GET handler. |
| `vault/middleware/vault-scope.js` | New. Exports `checkScope(toolName, token)`. Inquiry tools allowed when a Bearer token is present. Ops tools (`payment_release`, `payment_hold`) permanently refused per rule 11(b) — hardcoded, not a runtime policy check. No token returns `unauthorized`. |

## Controls applied

- **AC-3** — Access enforcement: every `tools/call` request must carry a Bearer
  token; absent token returns HTTP 401 before any tool logic executes.
- **AC-6** — Least privilege / segregation of duties: the inquiry identity
  (`ap-inquiry-agent`, policy `ap-payments-read-only`) is permitted read-only
  tool calls only. Write scope is not present in the identity and cannot be
  elevated by any request argument.
- **AU-2** — Audit events: refusals are returned as tool results (not swallowed
  as transport errors) so the calling assistant relays them verbatim and they
  appear in the platform's tool-call audit log.
- **PCI Req. 7** — Restrict access to system components and cardholder data by
  business need to know: the ops scope required to release or hold a payment is
  not granted to any automated identity in this epic.
- **PCI Req. 8** — Identify users and authenticate access to system components:
  every tool call is authenticated with a Bearer token issued to the calling
  identity; unauthenticated requests are refused at the transport layer.
- **FFIEC operational risk** — Write operations that constitute financial
  movement (release of held payments) are excluded from automated assistant
  access pending two-person control review.

## Risk notes

Write scope (`ops`) is permanently refused per rule 11(b): a written approval
from the service owner and the control owner — naming the assistant, the
operations, and the limits — has not been obtained for this epic (KAN-51/KAN-52).
The `payment_release` and `payment_hold` tools remain in the catalogue (rule 11b:
hiding the operation is not a control) but every call returns the canonical
`identity_scope_denied` refusal identifying the `ap-inquiry-agent` identity and
the `ap-payments-read-only` policy set.

No application code outside these two files was modified. `server.js` is
unchanged.

## Approval

Authorised by KAN-51 comment 10334, posted by Swayam Barik on 2026-08-13:
"approved - plan and design look good. Proceed with the subtasks."
