# Plan-first delivery (modernization work)

No application-code change ships without an approved plan. Before adding or
modifying code in this repository, the work must be planned, and the planning
record must exist in the repository under:

```
docs/modernization/<EPIC-KEY>/
    01-assessment.md
    02-plan.md
    03-decisions.md
```

`<EPIC-KEY>` is the tracker key of the epic the work belongs to. This applies to
**every** code-adding change — any commit or pull request — whether or not the
modernization skill was invoked by name. If a request would add code without a
plan, plan it first.

## Required documents

- **01-assessment.md** — current-state analysis grounded in the codebase. Every
  factual claim about existing behavior must cite a file path, and where useful
  a line or function name. An assessment that describes the system in general
  terms without file references is not an assessment and must be rejected.
- **02-plan.md** — target state, workstreams, and a subtask table in which every
  subtask has a name, a scope, **testable** acceptance criteria, and a due date.
  Includes out-of-scope items, the equivalence strategy required by rule 08,
  risks, and the approval record.
- **03-decisions.md** — the decision record: each decision, the options
  considered, the choice, the rationale, and the date.

## Rules for the planning record

- **Required.** A code change must be traceable to a committed plan document for
  its epic. Code with no plan is a finding.
- **Unblocked.** The plan must carry no unresolved `[BLOCKER]` marker at the time
  of approval. Planning is not complete — and implementation must not begin —
  while a blocker is open.
- **Append-only.** Once committed, planning documents are immutable history. A
  change may add new documents or append a dated revision section; it must never
  rewrite or delete previously committed content.

## The gate

Implementation begins only after **plan approval is recorded on the epic** in the
tracker, by a named approver, with a date. "Approved verbally", "approved in
chat", and "approver is on leave, proceeding" are not approvals. Until that
record exists, produce planning artifacts only.

This pairs with rule 03: the plan says what will be built and why; the change log
records what was built.
