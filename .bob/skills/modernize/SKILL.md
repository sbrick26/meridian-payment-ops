---
name: modernize
description: >-
  Use when planning or executing an application modernization: producing an
  assessment, modernization plan, decision record, or equivalence test strategy
  for replacing legacy functionality. Applies when the request is to analyse a
  legacy component, scope a migration, break an epic into subtasks with
  acceptance criteria and dates, decide between modernization options, or work
  out how to prove a replacement behaves like the system it replaces.
---

# Modernization workflow

This skill governs how modernization work is documented and approved. The
always-on engineering controls live in `.bob/rules/` and apply throughout; this
skill does not restate them and does not override them.

The output of a modernization engagement is not a running branch. It is a
planning record that a reviewer, an auditor, and the next engineer can all read
and act on.

## Where documents live

One directory per epic, keyed by the tracker key of the epic:

```
docs/modernization/<EPIC-KEY>/
    01-assessment.md      current state, grounded in the code
    02-plan.md            target state, workstreams, subtasks, approval
    03-decisions.md       decisions taken, with rationale
```

Skeletons for each are in `templates/`. An equivalence strategy is a required
section of `02-plan.md`; `templates/equivalence-strategy.md` expands that section
when the surface being replaced is large enough to warrant its own document, in
which case it is written as `04-equivalence-strategy.md` in the same directory
and referenced from the plan.

Create the directory if it does not exist. Once a document is committed it is
append-only: add a dated revision section rather than rewriting history.

## The three documents

**01-assessment.md — what exists today.** Read the code before writing anything.
Describe the current architecture, the data model, the request paths, the
integrations, and the specific liabilities that justify the work: duplicated
logic, unparameterized queries, missing validation, absent tests, unsupported
dependencies, undocumented behaviour. Quantify where you can — route counts,
file sizes, dependency versions and their support status.

**02-plan.md — what will change.** Target state, then workstreams, then a
subtask table. Each subtask is independently deliverable and independently
verifiable. State what is out of scope as explicitly as what is in scope; most
modernization overruns are scope that was never written down as excluded.

**03-decisions.md — what was decided and why.** One entry per decision: the
question, the options considered, the option chosen, the rationale, the date, and
the decider. Include decisions to *not* do something. A decision that only exists
in a chat log will be re-litigated.

## Quality bar

- **Every claim about the existing system cites a file path.** "The application
  builds SQL by string concatenation" is an opinion; "`routes/payments.js` builds
  SQL by string concatenation at the exception-search handler" is a finding.
  Statements without a citation must be removed or verified.
- **Acceptance criteria are testable.** A criterion that cannot be turned into a
  test or an observable check is not a criterion. "Improve performance" fails;
  "exception list returns in under 400 ms at 10,000 rows" passes.
- **Due dates are business-day based.** Read the real current date from the
  system clock, then count working days. Do not place a due date on a weekend.
  Sequence dates so dependent subtasks do not complete before their prerequisites.
- **No open blockers at approval.** Mark unresolved must-answer items
  `[BLOCKER]`. A plan with an open blocker cannot be approved.
- **Sized honestly.** If an estimate is a guess, say it is a guess and say what
  would make it firm.

## Equivalence strategy

Any plan that replaces existing behaviour must contain an equivalence strategy
covering:

- **Surface inventory** — every endpoint, view, or business rule being replaced.
- **Input matrix** — the case classes to be exercised: nominal paths, boundary
  values, error and rejection paths, authorization variants, and known data
  quirks in production data.
- **Golden capture** — how and when responses from the current implementation
  will be recorded, which must be before any modification, and where the
  fixtures will be committed.
- **Comparison method** — what is compared field by field: status codes, body
  contents, monetary precision and rounding, date and timestamp formatting,
  error codes, and observable side effects.
- **Intended differences** — every behaviour that will deliberately change,
  listed here and excluded explicitly from the comparison.
- **Exit criteria** — the case count that must execute, zero unexplained
  differences, and the conditions under which the legacy path is retired.

## Gate semantics

Produce the documents, then stop.

Implementation begins only after plan approval has been recorded on the epic in
the tracker, by a named approver, with a date. Until that record exists, the
correct output is planning artifacts — not code, not a branch, not a
proof-of-concept. If asked to begin implementation without a recorded approval,
say what is missing and offer to complete the plan instead.

At the end of a run, list every document written and every item still flagged
for a human decision.
