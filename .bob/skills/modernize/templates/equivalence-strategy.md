# Equivalence strategy — <replaced surface>

<!-- Expands the equivalence section of 02-plan.md. Write to docs/modernization/<EPIC-KEY>/04-equivalence-strategy.md and link it from the plan. -->

Epic: <EPIC-KEY>
Date: <YYYY-MM-DD>
Author: <name>

## Surface inventory

<!-- Every endpoint, view, or business rule being replaced, with the legacy implementation's file path. -->

| Surface | Legacy implementation | Replacement | Consumers |
|---------|-----------------------|-------------|-----------|
|         |                       |             |           |

## Input matrix

<!-- The case classes to be exercised, and the case count per class. Cover nominal, boundary, error, authorization, and known production data quirks. -->

| Case class | Description | Cases |
|------------|-------------|-------|
| Nominal    |             |       |
| Boundary   |             |       |
| Error / rejection |      |       |
| Authorization variants |  |      |
| Data quirks |            |       |

Total cases: <n>

## Golden capture

<!-- How responses from the current implementation are recorded, when (before any modification), from which environment, and where the fixtures are committed. -->

## Comparison method

<!-- Field-by-field comparison rules: status codes, body contents, monetary precision and rounding, date and timestamp formatting, error codes, observable side effects. Note any normalisation applied before comparison and why it is safe. -->

## Intended differences

<!-- Every behaviour that deliberately changes, with the plan line that authorizes it. Anything not listed here must match exactly. -->

| # | Legacy behaviour | New behaviour | Reason | Authorized in |
|---|------------------|---------------|--------|---------------|
| 1 |                  |               |        |               |

## Execution

<!-- Where the suite lives, how it runs in CI, and how results are reported in the pull request body. -->

## Exit criteria

<!-- Cases executed, zero unexplained differences, sign-off, and the conditions under which the legacy path is retired. -->
