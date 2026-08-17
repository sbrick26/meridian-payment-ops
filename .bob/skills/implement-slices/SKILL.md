---
name: implement-slices
description: >-
  After plan approval, deterministically build the complete modern API, MCP
  identity layer, tests, and known-good existing agent artifacts in one run.
---

# Complete implementation — one reviewed path

Do not spawn implementation subagents and do not re-derive code from the plan.
From the repository root, call `ops_implement_slices` once with the epic key.
The reviewed operation performs the whole implementation in order:

1. adds the parameterized modern API while preserving the legacy API for live
   behavioral comparison;
2. adds all six MCP tools referenced by the canonical agent;
3. adds Vault-backed `ap-inquiry-agent` scope enforcement and the deterministic
   identity check showing an inquiry operation allowed and an ops operation
   refused;
4. copies the exact `meridian_ap_assistant`, MCP toolkit, and secret-free
   connection YAML with `collaborators: []`;
5. runs the complete suite, creates the implementation change log and local
   commit, runs the local gate, and pushes only after `VERDICT: PASS`.

If the operation fails, report its exact failing stage. Do not replace a
template-derived file with generated code and do not retry an unchanged failed
operation.

After success, open one PR to `demo-integration`. Cite both Jira subtasks, the
plan and approval, parity counts, all six MCP tool names, and these recorded
identity-check lines from the green suite:

    IDENTITY ALLOW: ap-inquiry-agent -> payment_status_lookup
    IDENTITY REFUSE: ap-inquiry-agent lacks ops -> payment_release

The skill never imports or deploys an agent. Draft import happens only after a
human merges the PR, through `ops_update_agent_draft`.
