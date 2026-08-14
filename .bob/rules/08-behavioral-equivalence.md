# Behavioral equivalence for replaced functionality

FFIEC operational-risk guidance expects that a replacement system be shown to
behave as the system it replaces before the legacy path is retired. Assertion is
not evidence. Any replacement, rewrite, re-platforming, or re-implementation of
an existing API endpoint or business rule must satisfy all three requirements
below.

## (a) Capture golden responses before modification

Before the legacy implementation is changed, exercise it across a representative
input matrix and record the responses as fixtures committed to the repository.

The matrix must cover, at minimum:

- the nominal case for each supported request shape;
- boundary values (empty result sets, single row, pagination edges, maximum
  field lengths, zero and negative amounts);
- error and rejection paths, including the exact status codes and error bodies
  the legacy endpoint returns;
- authorization variants (each operator role that can reach the endpoint);
- known data quirks present in production data — null-vs-empty, legacy status
  codes, historical formatting of amounts and dates.

Golden captures taken *after* the implementation was modified are worthless. If
captures were not taken first, restore the legacy behavior, capture, then
proceed.

## (b) Ship an equivalence test suite

The change must include an automated suite that runs the same inputs against the
modern and legacy implementations and compares:

- HTTP status code;
- response body, field by field, including field ordering where a consumer
  depends on it;
- numeric precision and rounding of all monetary values;
- date and timestamp formatting and timezone handling;
- error codes and messages;
- observable side effects — rows written, statuses transitioned, events emitted.

The suite lives with the code and runs in CI. It is not a one-off script.

## (c) Report the result in the pull request

The pull request body must state:

- the number of cases in the input matrix and the number executed;
- **zero unexplained differences**, or the pull request does not merge;
- every difference that is intended, each one linked to the line in the plan
  document that authorizes it.

## Intended behavior changes

A modernization may deliberately change behavior — correcting a defect,
tightening validation, changing a rounding rule. Such changes must be documented
in `PLAN.md` before implementation, listed explicitly as excluded from the
equivalence comparison, and referenced from the pull request body. An
undocumented difference discovered at review is a failure of this rule
regardless of whether the new behavior is better.

Retirement of the legacy path requires the equivalence suite to be green and the
result recorded in the change log (rule 03).

## Ordering evidence within one pull request

Fixtures and implementation may arrive in the same pull request. Capture-first
is then evidenced by commit history, not by the diff: the commit introducing
`tests/golden/` must touch only the fixtures, and must precede every commit
that modifies legacy code. The gate verifies this ordering mechanically from
the branch history; a same-diff appearance of fixtures and implementation is
not, by itself, a violation.
