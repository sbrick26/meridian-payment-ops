# Plan-first delivery (modernization work)

No application-code change ships without an approved plan. Before adding or
modifying code in this repository, the work must be planned, and the planning
record must exist in the repository under:

```
docs/modernization/<EPIC-KEY>/PLAN.md
```

`<EPIC-KEY>` is the tracker key of the **epic** the work belongs to — never the
key of the subtask doing the work. One epic has one plan; its subtasks share it.
A pull request for subtask KAN-39 is satisfied by the plan at
`docs/modernization/KAN-37/PLAN.md` when KAN-37 is its parent epic, and looking
for a plan named after the subtask will always fail.

**The plan does not have to appear in the diff.** It is approved on the ticket
and committed to the integration branch before implementation starts, so by the
time code is written the plan is already in the repository and a diff that adds
code correctly contains no plan. Check the branch, not the change: the question
is whether an approved plan exists for the epic, not whether this commit
introduced one.

This applies to **every** code-adding change — any commit or pull request —
whether or not the modernization skill was invoked by name. If a request would
add code without a plan, plan it first.

## What PLAN.md must contain

One document, not several. An approver reads one file or they read none.

- **Current state** — grounded in the codebase. Every factual claim about
  existing behavior must cite a file path, and where useful a line or function
  name. A current-state section that describes the system in general terms
  without file references is not analysis and must be rejected. Summarize
  findings; an inventory of the codebase is not required and is not wanted.
- **Target state and workstreams.**
- **Subtask table** in which every subtask has a name, a scope, **testable**
  acceptance criteria, and a due date.
- **Out of scope**, stated explicitly.
- **Verification approach** - one short paragraph: what the parity suite covers (rule 08).
- **Key decisions** — one line each: the decision and the alternative rejected.
- **Approval record.**

Separate assessment, decision-record or equivalence documents must not be
created; those are sections of PLAN.md. The document is a decision surface for
an approver, and is expected to be readable in about three minutes.

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
