# Behavioral parity (proportionate verification)

When existing behaviour is replaced, the change ships with an automated
parity suite proving the replacement behaves like what it replaces - run
green before merge, proportionate to the surface being replaced.

## Requirements

- **Coverage**: every replaced endpoint or rule, exercised on its nominal
  path AND its error paths (bad input, not found), comparing HTTP status
  and response body against the legacy behaviour.
- **Live comparison**: the suite exercises both implementations at test
  time (legacy stays mounted); it does not depend on pre-recorded fixtures.
- **Zero unexplained diffs**: intended differences are listed in the plan
  and excluded explicitly; everything else must match.
- **Green before merge**: the suite runs in the pull request and passes.

That is the whole requirement. No golden-fixture capture, no capture-first
commit choreography, and no evidence beyond the passing suite is required -
a proportionate suite that runs on every PR outlives any one-time ceremony.
