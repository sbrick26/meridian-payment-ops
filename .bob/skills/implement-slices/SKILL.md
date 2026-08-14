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

1. Golden fixtures FIRST, committed ALONE (the gate verifies this commit
   order mechanically):

   The console must be serving the UNMODIFIED legacy app (ops_start_console
   if it is not). Then:

   ```bash
   cp .bob/skills/implement-slices/templates/capture-golden.js scripts/capture-golden.js
   node scripts/capture-golden.js
   git add tests/golden scripts/capture-golden.js && git commit -m "test(<EPIC-KEY>): golden fixtures - legacy responses captured before any code change"
   ```

   (The capture script rides in the fixtures commit - the gate's ordering
   check permits tests/ and scripts/capture-golden there, nothing else.)

2. Copy the modern routes and the suite - these satisfy live-vs-live
   equivalence, express-validator boundaries, env-var config, and carry
   compliant headers:

   ```bash
   mkdir -p routes/api-v2
   cp .bob/skills/implement-slices/templates/payment-status.js routes/api-v2/payment-status.js
   cp .bob/skills/implement-slices/templates/risk-score.js routes/api-v2/risk-score.js
   cp .bob/skills/implement-slices/templates/equivalence.test.js tests/equivalence.test.js
   ```

3. Mount v2 in server.js, move the six hardcoded literals to process.env,
   add the Deprecation header on the two legacy routes. This is the ONLY
   hand-edited file in the slice.

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
