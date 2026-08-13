<!-- TEMPLATE: modernization plan -->
<!-- Write to docs/modernization/<EPIC-KEY>/PLAN.md. This is the ONLY planning
     document: no separate assessment, decision or equivalence files.
     Target length is roughly two pages — a three-minute read.
     Append-only once committed: add a dated revision section, do not rewrite. -->

# <EPIC-KEY> — Modernization plan: <component>

| | |
|---|---|
| **Epic** | <EPIC-KEY> |
| **Author** | <author> |
| **Date** | <YYYY-MM-DD> |
| **Status** | Awaiting approval |

## Current state

<!-- 3-6 findings that change the plan. Each cites a real file path. Summarize,
     do not inventory: group like problems into one line with a count. -->

- <finding> (`<path>`)
- <finding> (`<path>`)

**Why this is worth doing now:** <one or two sentences of business consequence.>

## Target state

<!-- What the system looks like when this epic is done. 3-5 sentences. -->

**Workstreams**

1. **<name>** — <one line>
2. **<name>** — <one line>

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | <name> | <what it touches> | <observable, testable> | <YYYY-MM-DD> |
| 2 | | | | |

<!-- Business-day dates read from the system clock. No weekends. Dependent
     subtasks cannot be due before their prerequisites. -->

## Out of scope

- <excluded item> — <why, and where it goes instead>

## Equivalence strategy

<!-- Required whenever existing behaviour is replaced. One or two lines each. -->

| | |
|---|---|
| **Surface replaced** | <endpoints / views / rules> |
| **Input matrix** | <case classes: nominal, boundary, error, authz, data quirks> |
| **Golden capture** | <how and when, before any modification; fixture location> |
| **Comparison** | <fields compared: status, body, money precision, dates, errors> |
| **Intended differences** | <deliberate changes, excluded from comparison> |
| **Exit criteria** | <case count, zero unexplained diffs, legacy retirement> |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| <what was decided> | <what was not chosen> | <one line> |

<!-- Include decisions NOT to do something. -->

## Open items

<!-- `[BLOCKER]` marks anything that must be answered before approval.
     A plan with an open blocker cannot be approved. Delete if none. -->

- [BLOCKER] <question> — <who must answer>

## Approval

<!-- Filled in the moment approval is recorded on the ticket, before any
     subtask is created. Left as "(pending)" this document reads - correctly -
     as work that began without approval, and every code pull request for the
     epic will fail rule 07. -->

| | |
|---|---|
| **Approver** | <name> |
| **Date** | <YYYY-MM-DD> |
| **Recorded on** | <EPIC-KEY> |
| **Approving comment** | <quote the sentence that approved it> |

## Design review

<!-- Required by rule 09 before any user-visible change is implemented. The
     person who approved the plan approved the frames attached to it. -->

| | |
|---|---|
| **Reviewing designer** | <name> |
| **Date** | <YYYY-MM-DD> |
| **Reviewed** | <EPIC-KEY> BEFORE / AFTER frames, <figma url> |
