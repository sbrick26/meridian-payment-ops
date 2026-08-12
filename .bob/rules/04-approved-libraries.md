# Approved third-party libraries (supply-chain governance)

AI agents readily reach for whatever library a tutorial used. Unreviewed
dependencies are a software supply-chain exposure and an unapproved deviation
from the SOX ITGC configuration baseline. Only libraries on this allowlist may
be added to `package.json`.

If asked to add something not on the list, **refuse**, name the closest approved
equivalent, and surface the exact `npm install` command so the engineer can
review it before approving. Never install silently.

## Approved

- express (web framework)
- ejs (view templates)
- better-sqlite3, sqlite3 (database drivers)
- helmet (HTTP security headers)
- express-validator (request validation)
- dotenv (environment loading)
- pino (structured logging)
- jest, supertest (testing)
- eslint, prettier (linting and formatting)
- node-fetch (HTTP client)

## Common substitutions to propose

| If asked for...           | Propose instead              | Why                                              |
|---------------------------|------------------------------|--------------------------------------------------|
| request / axios           | node-fetch                   | approved HTTP path; `request` is unmaintained     |
| moment / moment-timezone  | built-in `Intl` / `Date`     | avoid a deprecated, heavyweight date dependency   |
| lodash / underscore       | native ES methods            | no dependency needed for map/filter/reduce work   |
| body-parser               | `express.json()` / `express.urlencoded()` | already in Express core         |
| a raw driver + hand-built SQL | better-sqlite3 prepared statements | keeps queries parameterized (rule 01)   |
| winston / morgan          | pino                         | one approved logging stack, one log format        |

Anything genuinely not covered above requires an explicit **approval note in the
plan document** (rule 07) naming the library, the need, the license, the
maintenance status, and the approver. No approval note, no dependency.

Adding a library is a configuration change: it must also produce a change-log
entry (rule 03) with the CM-2 control noted.
