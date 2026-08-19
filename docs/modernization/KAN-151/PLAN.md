<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# KAN-151 — Legacy API to governed agent

| | |
|---|---|
| **Epic** | KAN-151 |
| **Author / date** | bobdev · 2026-08-19 |
| **Status** | Awaiting Jira approval |

## Current state

- No automated tests exist; `npm test` is absent from `package.json` (`package.json`, `server.js:32`)
- `GET /api/payment-status` (`server.js:525–586`) and `GET /api/risk-score` (`server.js:588–625`) are bare Express handlers with no v2 counterpart, no MCP interface, and no parameterized data access path for an external agent
- Risk scoring (`server.js:407–516`) and status formatting (`server.js:676–683`) are inline in the same file as the routes, making them callable from v2 without any copy
- No MCP endpoint, no vault-scope middleware, and no agent artifacts exist; templates are staged in `.bob/skills/agent-enablement/templates/`
- Three downstream teams consume the legacy endpoints; replacement must be side-by-side, not in-place

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2/payment-status` and `/api/v2/risk-score` routes sharing the existing `scoreRow()` and `statusDescription()` helpers | Nominal, bad-input (missing ref), and not-found cases match the live legacy handlers with zero unexplained differences; parity suite exits green | 2026-08-21 |
| Governed MCP + Agent | MCP endpoint at `POST /mcp` (6 tools), vault-scope middleware enforcing `ap-inquiry-read` → `ap-inquiry-agent`, and committed `agent/agent.yaml`, `agent/mcp-toolkit.yaml`, `agent/connection.yaml` | MCP lists all 6 tools; `payment_status_lookup` allowed for `ap-inquiry-agent`; `payment_release` refused with `identity_scope_denied`; canonical YAML is importable to `align-sf-690` draft | 2026-08-22 |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.
Changes to `.bob/`, `.github/`, `governance/`, or `dashboard/` are excluded.

## Verification

The parity suite exercises both legacy and `/api/v2` handlers live — nominal
(`?ref=<valid>`), bad-input (`?ref` omitted), and not-found (`?ref=ZZZZ`) — and
compares HTTP status codes and response body structure with zero unexplained
differences. The identity check submits an inquiry tool call under
`ap-inquiry-agent` (allowed) and a write tool call (refused), asserting the
exact `identity_scope_denied` refusal shape.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect the three downstream consumers and enable live parity |
| Reuse inline `scoreRow()` and `statusDescription()` helpers from `server.js` | Extract to a shared module | Minimal change; helpers are not duplicated, just called by the new route |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | KAN-151 |
| **Approving comment** | — |
