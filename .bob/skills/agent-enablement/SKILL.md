---
name: agent-enablement
description: >-
  Deterministically add the known-good Meridian MCP, scoped identity, and
  existing watsonx Orchestrate agent artifacts to the modernization PR, then
  update only the draft agent after a human merges the PR.
---

# Known-good agent enablement — no rediscovery

This skill has two separate moments. Never combine them.

## A. Implementation PR artifacts

During the single reviewed implementation operation, copy these templates exactly:

| Template | PR destination | Purpose |
|---|---|---|
| `templates/mcp-endpoint.js` | `routes/mcp-endpoint.js` | Remote MCP interface mounted on the modern API |
| `templates/vault-scope.js` | `vault/middleware/vault-scope.js` | Identity resolution, inquiry/ops scope enforcement, denial events |
| `templates/agent.yaml` | `agent/agent.yaml` | Existing `meridian_ap_assistant`, including its current voice config and six namespaced tools |
| `templates/mcp-toolkit.yaml` | `agent/mcp-toolkit.yaml` | `ap_payments` remote MCP toolkit definition |
| `templates/connection.yaml` | `agent/connection.yaml` | Secret-free `ap_payments_vault` draft/live connection shape |

The templates are complete. Do not ask Bob to invent YAML, discover model names,
rename tools, create collaborators, change voice configuration, or derive a new
agent. `agent.yaml` must keep `name: meridian_ap_assistant` and
`collaborators: []`. Credentials never appear in the PR.

The agent includes inquiry tools and write tools deliberately. The dedicated
`ap-inquiry-agent` identity can read but cannot release or hold a payment; the
service-level refusal is part of the acceptance proof.

## B. Post-merge draft update

After `gh` proves the PR is merged and the merged suite is green, run exactly
`sh ../ops/import-agent-draft.sh` with the execute tool. Do not run raw
Orchestrate commands or call a generic Orchestrate MCP mutation.

The reviewed script behind that tool must:

1. run `orchestrate --version` and `orchestrate agents import --help` so the
   installed CLI surface is recorded before use;
2. activate `align-sf-588` with `WXO_588_API_KEY` and immediately read back the
   active environment;
3. refuse any empty, foreign, or `tko` target;
4. validate that committed `agent/agent.yaml` names only
   `meridian_ap_assistant` and has an empty collaborator list;
5. run exactly one remote mutation:
   `orchestrate agents import -f agent/agent.yaml`;
6. require the CLI's successful update acknowledgement and verify the exported
   draft content matches the imported canonical agent;
7. restore the previously active CLI environment.

Import updates draft. The script contains no `agents deploy`, `agents undeploy`,
promotion, channel, phone, toolkit creation, connection mutation, or live
credential command. It never creates a second agent. The already-live voice
agent remains warm and unchanged until the requester performs the final manual
promotion.

Success ends with the exact user-facing line `Orchestrate complete.`

Any mismatch stops the phase and leaves the Jira ticket open.
