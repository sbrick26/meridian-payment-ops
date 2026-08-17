---
name: parallel-analysis
description: >-
  Use during fast planning to inspect the legacy API and the existing governed
  agent surface in parallel without a broad legacy-code audit.
---

# Two focused readers, one message

Your NEXT reply is exactly TWO `spawn_subagent` calls, with the epic key
substituted and no prose before, between, or after them. They must be emitted in
one reply so the work runs concurrently.

Spawn 1 — name: explore
"API ANALYST for <EPIC-KEY>. Read server.js, seed.js, package.json and existing
tests. Report only what the plan needs: the legacy payment-status and risk-score
routes, inputs, response/error shapes, data access they use, how they can remain
mounted beside /api/v2, and the smallest live-vs-live parity matrix. Cite file
and line numbers. Do not audit unrelated routes, hunt for credentials, survey
dependency age, or expand beyond the two ticket workstreams."

Spawn 2 — name: explore
"AGENT AND IDENTITY ANALYST for <EPIC-KEY>. Read the existing MCP endpoint,
Vault scope middleware, agent templates/exports, and deployment/import scripts.
Report the exact MCP tools, meridian_ap_assistant tool names, ap-inquiry-agent
read-only boundary, expected write refusal, and the files needed to reproduce
the known-good agent definition in source control. Cite paths and flag any
artifact that differs from the current exported agent. Do not change files or
expand beyond the two ticket workstreams."

Wait for both. Retry a failed reader once; if it still fails, inspect only that
reader's files yourself. Return a compact combined set of plan facts.
