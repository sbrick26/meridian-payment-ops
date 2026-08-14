---
name: implement-slices
description: >-
  Use at PHASE 3 step 3, after the approval is recorded and the subtasks
  exist, to build both implementation slices. One tool call executes the
  gate-proven implementation in seconds.
---

# One call, both slices

The implementation is a deterministic sequence, so it runs as a governed
operation rather than being re-derived: every file comes from a template
that has already passed the guardrail gate, the parity suite, and the
byte-identity check.

Call the tool:

    ops_implement_slices  { epic_key: "<EPIC-KEY>" }

It checks out feature/<EPIC-KEY>-implementation (creating it from
demo-integration if needed), copies the v2 routes, the live parity suite,
the MCP endpoint, the vault scope middleware (byte-identical - CI verifies),
the modernized entrypoint and package manifest, writes the rule 03
change-log entry for this epic, runs the suite, commits and pushes.

It does NOT open the pull request. You do, because the PR body carries
judgement: cite every subtask key, the committed plan path, the approval
comment, and the parity counts from the tool's output.

If the tool is unavailable, the same sequence by hand (from the repo root,
templates in .bob/skills/implement-slices/templates/): cp each template to
its destination (payment-status.js and risk-score.js into routes/api-v2/,
equivalence.test.js into tests/, mcp-endpoint.js into routes/,
agent-enablement's vault-scope.js into vault/middleware/,
server-modernized.js over server.js, package.json over package.json),
write the change-log entry, npm test, commit, push. Never retype a
template - copy it.
