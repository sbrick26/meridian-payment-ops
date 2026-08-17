---
name: implement-slices
description: >-
  After plan approval, build the modern API, MCP identity layer, and complete
  known-good agent artifacts with three simultaneous implementer subagents.
---

# Three parallel implementation hands

Your NEXT reply after loading this skill is exactly THREE `spawn_subagent`
calls and nothing else. Use the `implementer` persona for all three, substitute
the epic key, and emit them together. Subagents write files only; the parent
runs tests, git, and the gate.

Spawn 1:
"MODERN API SLICE for <EPIC-KEY>. From the repository root run exactly:
mkdir -p routes/api-v2 tests
cp .bob/skills/implement-slices/templates/payment-status.js routes/api-v2/payment-status.js
cp .bob/skills/implement-slices/templates/risk-score.js routes/api-v2/risk-score.js
cp .bob/skills/implement-slices/templates/equivalence.test.js tests/equivalence.test.js
cp .bob/skills/implement-slices/templates/server-modernized.js server.js
cp .bob/skills/implement-slices/templates/package.json package.json
Report DONE with the file list. Do not run tests, commit, or push."

Spawn 2:
"MCP AND IDENTITY SLICE for <EPIC-KEY>. From the repository root run exactly:
mkdir -p routes vault/middleware change-log
cp .bob/skills/implement-slices/templates/mcp-endpoint.js routes/mcp-endpoint.js
cp .bob/skills/agent-enablement/templates/vault-scope.js vault/middleware/vault-scope.js
Read the real clock, copy the change-log template to
change-log/YYYY-MM-DD_HHMM_<EPIC-KEY>-implementation.md, and replace KAN-98 and
the template date with this epic and today's date. Report DONE with the file
list. Do not run tests, commit, or push."

Spawn 3:
"CANONICAL AGENT ARTIFACTS SLICE for <EPIC-KEY>. From the repository root run
exactly:
mkdir -p agent
cp .bob/skills/agent-enablement/templates/agent.yaml agent/agent.yaml
cp .bob/skills/agent-enablement/templates/mcp-toolkit.yaml agent/mcp-toolkit.yaml
cp .bob/skills/agent-enablement/templates/connection.yaml agent/connection.yaml
Report DONE with the file list. Do not modify the copies, run tests, import,
deploy, commit, or push. These are the known-good existing agent, MCP toolkit,
and secret-free connection definitions; `collaborators` must remain empty."

Wait for all three. Retry a failed hand once, otherwise perform only its listed
copies yourself. Never proceed with a slice missing.

The parent then runs:

    npm install --no-audit --no-fund --loglevel=error
    npm test
    git add -A
    git commit -m "feat(<EPIC-KEY>): modern API and governed MCP agent"
    sh ../ops/preflight-audit.sh

Expect the full suite green, zero unexplained parity differences, and `VERDICT:
PASS`. The implementation must be committed before the gate runs because the
gate audits committed branch history, not uncommitted files. Fix findings by
amending that local commit and rerunning the gate. Push only after PASS, then
open one PR to `demo-integration` citing both Jira subtasks, the plan/approval,
parity counts, identity, and refused write.

The skill never imports or deploys an agent. Draft import happens only after a
human merges the PR, through `ops_update_agent_draft`.
