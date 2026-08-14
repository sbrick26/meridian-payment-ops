---
name: implement-slices
description: >-
  Use at PHASE 3 step 3, after the approval is recorded and the subtasks
  exist, to build both implementation slices in parallel: two implementer
  subagents work simultaneously, then the parent finishes with the suite,
  the commit and the push.
---

# Three hands, then the parent closes

Both slices are built from gate-proven templates by TWO implementer-persona
subagents running AT THE SAME TIME. Your next reply after loading this
skill contains EXACTLY three spawn_subagent calls and nothing else - no prose
before, between, or after them. Both briefs verbatim, epic key substituted.
The subagents write files only - the parent owns testing and git.

Spawn 1 - use the implementer persona:
"SERVICE SLICE for <EPIC-KEY>. From the repository root run exactly these
commands and nothing else, then report DONE with the file list:
mkdir -p routes/api-v2 tests
cp .bob/skills/implement-slices/templates/payment-status.js routes/api-v2/payment-status.js
cp .bob/skills/implement-slices/templates/risk-score.js routes/api-v2/risk-score.js
cp .bob/skills/implement-slices/templates/equivalence.test.js tests/equivalence.test.js
cp .bob/skills/implement-slices/templates/server-modernized.js server.js
cp .bob/skills/implement-slices/templates/package.json package.json
Do not run tests, do not commit."

Spawn 2 - use the implementer persona:
"AGENT SLICE for <EPIC-KEY>. From the repository root run exactly these
commands, then write the change-log entry, then report DONE with the file
list:
mkdir -p vault/middleware change-log
cp .bob/skills/implement-slices/templates/mcp-endpoint.js routes/mcp-endpoint.js
cp .bob/skills/agent-enablement/templates/vault-scope.js vault/middleware/vault-scope.js
Then create change-log/<YYYY-MM-DD>_<HHMM>_<EPIC-KEY>-implementation.md -
the HHMM timestamp is REQUIRED by rule 03; read the real clock - by copying
.bob/skills/implement-slices/templates/change-log-entry.md and replacing
every KAN-98 with <EPIC-KEY> and the old date with today's date.
Do not run tests, do not commit."

Spawn 3 - use the implementer persona:
"AGENT DEFINITION SLICE for <EPIC-KEY>. From the repository root run
exactly these commands, then report DONE with the file list:
mkdir -p agent
cp .bob/skills/agent-enablement/templates/agent.yaml agent/agent.yaml
cp .bob/skills/agent-enablement/templates/openapi-tools.json agent/openapi-tools.json
These are the watsonx Orchestrate agent and tool definitions that the
deployed assistant runs - committed here so the pull request carries the
complete governed artifact set. Do not modify them, do not run tests, do
not commit."

WAIT for all three. If one fails: respawn it once, else run its commands
yourself. Never proceed with any slice's files missing.

## The parent finishes - testing and git, in the main conversation

    npm install --no-audit --no-fund --loglevel=error
    npm test          # expect the full suite green, 0 unexplained diffs
    git add -A
    git commit -m "feat(<EPIC-KEY>): modernized v2 API, secrets-to-env, governed MCP agent layer"
    git push -u origin feature/<EPIC-KEY>-implementation

Then the LOCAL GATE - the same audit GitHub will run, run it here first:

    sh ../ops/preflight-audit.sh

Fix every finding it reports BEFORE pushing (for template-derived files the
only fix is re-copying the template). Push only on VERDICT: PASS - a pull
request must pass the gate on its first run.

Quote the suite counts in the PR body. The branch must already exist with
the plan and approval commits - never create it here.

Fallback if subagents are unavailable: ops_implement_slices { epic_key }
does the whole sequence in one call.
