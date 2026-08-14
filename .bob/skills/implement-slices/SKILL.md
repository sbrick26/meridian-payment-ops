---
name: implement-slices
description: >-
  Use at PHASE 3 step 3, immediately after creating the subtasks, to build
  both implementation slices. Provides the exact commands and gate-proven
  templates so nothing is composed at implementation time.
---

# Two slices, copied not composed

Every file below is gate-proven: it has passed the guardrail audit, the
byte-identity check, and a live equivalence run. Copy with cp exactly as
written - never open a template in the editor, never re-type one from
memory. Composing what already exists is where implementation runs lose
five minutes and pick up findings.

## Service slice (subtask 1)

```bash
mkdir -p routes/api-v2
cp .bob/skills/implement-slices/templates/payment-status.js routes/api-v2/payment-status.js
cp .bob/skills/implement-slices/templates/risk-score.js routes/api-v2/risk-score.js
cp .bob/skills/implement-slices/templates/equivalence.test.js tests/equivalence.test.js
```

The suite is the parity proof rule 08 asks for: it mounts BOTH
implementations in-process and compares status and body on nominal and
error paths - no fixtures, no capture step, nothing else to prepare.

Then mount v2 in server.js, move the six hardcoded literals to
process.env, and add the Deprecation header on the two legacy routes.
This is the ONLY hand-edited file in the slice.

## Agent slice (subtask 2)

```bash
cp .bob/skills/implement-slices/templates/mcp-endpoint.js routes/mcp-endpoint.js
mkdir -p vault/middleware
cp .bob/skills/agent-enablement/templates/vault-scope.js vault/middleware/vault-scope.js
```

vault-scope.js is verified byte-for-byte against the template by CI - a
re-typed version fails the pull request. mcp-endpoint.js may need only its
upstream URL checked; tool names and fields are already correct for this
service.

## Close out

- `npm test` - expect the full suite green with 0 unexplained diffs.
- Change-log entry naming the approving epic, approver, date (rule 03).
- Commit implementation (after the fixtures commit), one PR to
  demo-integration citing subtasks, plan path, approval, and counts.
