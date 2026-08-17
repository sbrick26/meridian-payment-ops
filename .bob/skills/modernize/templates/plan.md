<!-- Write only to docs/modernization/<EPIC-KEY>/PLAN.md. One-minute read. -->

# <EPIC-KEY> — Legacy API to governed agent

| | |
|---|---|
| **Epic** | <EPIC-KEY> |
| **Author / date** | <author> · <YYYY-MM-DD> |
| **Status** | Awaiting Jira approval |

## Current state

- <finding that affects this plan> (`<path>:<line>`)
- <finding> (`<path>:<line>`)
- <finding> (`<path>:<line>`)

## Target state

The existing endpoints remain available while equivalent parameterized `/api/v2`
routes serve a remote MCP interface. `meridian_ap_assistant` uses its dedicated
`ap-inquiry-agent` identity for reads; exposed write tools remain callable but
are refused below the model by the identity boundary.

## Subtasks

| Subtask | Scope | Acceptance criteria | Due |
|---|---|---|---|
| Modern API | Side-by-side `/api/v2` payment-status and risk-score routes | Nominal, bad-input, and not-found cases match the live legacy handlers with zero unexplained differences | <YYYY-MM-DD> |
| Governed MCP + Agent | MCP endpoint, scoped identity middleware, and complete agent/tool/connection definitions | MCP lists the expected tools; inquiry succeeds; release is refused for `ap-inquiry-agent`; canonical `meridian_ap_assistant` YAML is importable to draft | <YYYY-MM-DD> |

## Scope boundary

This epic contains only the two workstreams above and ends when the reviewed
agent definition is ready in draft for the requester's manual promotion.

## Verification

The parity suite runs the same nominal, bad-input, and not-found inputs against
the mounted legacy and `/api/v2` handlers and compares status and body with zero
unexplained differences. The identity check proves an inquiry is allowed and a
write tool is refused, while the draft-import check confirms the existing agent
name in `align-sf-588` without touching live.

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy routes mounted beside `/api/v2` | In-place replacement | Protect existing consumers and enable live parity |
| One dedicated inquiry identity per agent | Shared or operator credential | Enforce least privilege below the model |
| Import the existing agent to draft only | Automatic live deployment | Preserve the warm live phone demo for the requester's final flip |

## Approval

| | |
|---|---|
| **Approver** | Awaiting Jira approval |
| **Date** | — |
| **Recorded on** | <EPIC-KEY> |
| **Approving comment** | — |
