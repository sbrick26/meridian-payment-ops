---
name: modernize
description: >-
  Use when planning or executing an application modernization: producing a
  modernization plan for replacing legacy functionality. Applies when the
  request is to analyse a legacy component, scope a migration, break an epic
  into subtasks with acceptance criteria and dates, decide between
  modernization options, or work out how to prove a replacement behaves like
  the system it replaces.
---

# Modernization workflow

This skill governs how modernization work is documented and approved. The
always-on engineering controls live in `.bob/rules/` and apply throughout; this
skill does not restate them and does not override them.

The output of a modernization engagement is not a running branch. It is a
planning record that a reviewer, an auditor, and the next engineer can all read
and act on.

## The document

**One document per epic, and only one:**

```
docs/modernization/<EPIC-KEY>/PLAN.md
```

`templates/plan.md` is its skeleton. Do not split the assessment, the decision
record, or the equivalence strategy into separate files — they are sections of
this document. A reviewer who has to open four files to approve one plan will
approve it without reading it.

Create the directory if it does not exist. Once the document is committed it is
append-only: add a dated revision section rather than rewriting history.

## Length is a requirement, not a preference

**A reviewer must be able to read PLAN.md in ninety seconds** — one page. The plan is a decision surface for an approver, not a report on the
codebase. The approver already owns the system; they do not need it described
back to them.

That budget forces the right behaviour in each section:

- **Current state** — the findings that change the plan, not an inventory.
  Three to six of them, each citing a real file path. "Eleven of the fifteen
  routes build SQL by concatenation (`server.js`)" beats fifteen bullet points
  that each name one route.
- **Target state and workstreams** — what the system becomes, and the two to
  four streams that get it there.
- **Subtask table** — name, scope, acceptance criteria, proposed due date. One
  row per subtask, each independently deliverable and independently verifiable.
- **Out of scope** — as explicit as what is in scope. Most modernization
  overruns are scope that was never written down as excluded.
- **Equivalence strategy** — required whenever existing behaviour is being
  replaced (see below). Keep it to the shape of the proof, not the test list.
- **Key decisions** — one line each: what was decided, and the alternative
  rejected. Include decisions *not* to do something. A decision that only
  exists in a chat log will be re-litigated.

Do not pad, do not restate the codebase, and do not append appendices to get
detail back in. Detail that does not fit belongs in the subtask that will do
the work.

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

## Verification approach

One short paragraph: which surfaces the parity suite covers (nominal and
error paths, both implementations exercised live), and any intended
differences excluded from comparison. The suite itself is the proof; the
plan only commits to its shape.

## Gate semantics

Produce the document, then stop.

Implementation begins only after plan approval has been recorded on the epic in
the tracker, by a named approver, with a date. Until that record exists, the
correct output is the plan — not code, not a branch, not a proof-of-concept. If
asked to begin implementation without a recorded approval, say what is missing
and offer to complete the plan instead.

At the end of a run, state where PLAN.md was written and list every item still
flagged for a human decision.
