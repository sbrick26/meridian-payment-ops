---
name: modernize
description: >-
  Produce the fast one-page modernization plan for the legacy API and governed
  MCP agent, before implementation begins.
---

# Fast API modernization plan

Write one document only:

`docs/modernization/<EPIC-KEY>/PLAN.md`

Use `templates/plan.md`. It must be readable in about sixty seconds and contain:

- three to five current-state findings, each citing a real file;
- the side-by-side `/api/v2` target and governed MCP/agent target;
- exactly two subtasks: **Modern API** and **Governed MCP + Agent**;
- testable acceptance criteria and business-day due dates;
- a scope boundary limited to the two ticket workstreams and draft handoff;
- one short verification paragraph covering nominal, bad-input, and not-found
  live-vs-live parity plus an inquiry-allowed/write-refused identity check;
- at most three decisions, each naming the rejected alternative;
- an approval section initially marked Awaiting Jira approval.

Ask at most two questions before writing, and only when the ticket and code do
not already settle compatibility or agent data/scope. Do not create assessment,
design, decision, or equivalence companion documents. Once committed, append a
dated revision or approval record rather than rewriting history.

Stop after the plan is committed, attached to the epic, and the epic is In
Review. Implementation requires a named, dated approval comment on that epic.
