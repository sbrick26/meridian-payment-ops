---
name: parallel-analysis
description: >-
  Use at PHASE 2 step 2, immediately after moving the epic to In Progress, to
  launch the three codebase analysts. Provides the exact spawn calls so the
  fan-out is one message with nothing to compose.
---

# Three analysts, one message

Your NEXT reply is exactly three spawn_subagent calls - the three below,
verbatim, epic key substituted. No prose in that reply: any sentence between
spawns turns the fan-out into a queue, because the runtime finishes a lone
call before dispatching the next.

Spawn 1 - name: explore
"Subagent A - routes and endpoints: Read server.js fully. List every route
(method, path, purpose, response shape). Note SQL construction style per
route, config and error handling, and test coverage. Report as a table plus
findings with line numbers."

Spawn 2 - name: explore
"Subagent B - data model and risk: Read seed.js and package.json. Report the
schema (tables, columns, indexes), hardcoded secrets with exact line numbers,
vulnerable query patterns, and each dependency with age and support status."

Spawn 3 - name: explore
"Subagent C - docs and dependents: Read README.md fully. List every claim the
code contradicts, and every downstream consumer of the payment-status and
risk-score endpoints you can identify from code, docs, or headers."

Then WAIT for all three. If one fails: respawn that one once, else read its
area yourself. Never end the phase because a subagent died.
