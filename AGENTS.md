# AGENTS.md

## What this repository is

The **AP Payment Operations Console** — the internal web application Meridian Corp's
Accounts Payable team uses to review supplier invoices, assemble payment batches,
approve or hold disbursements, and pull remittance and audit reports. It is owned by
the Finance Systems team inside Meridian Corp IT.

It is a legacy Node application: Express with server-rendered EJS views, a SQLite
data file (`payops.db`), and no build step. `npm start` serves it on port 4600;
`npm run seed` rebuilds the local database. Real money moves on the back of what
this console records, so it is in scope for SOX 404 change control — which is why
every change is governed.

Run `./setup.sh` once to bootstrap local configuration (`.env`, `.bob/mcp.json`,
dependencies, seed data).

## Working in this repository

All changes must follow the rules under `.bob/rules/`. Treat the rules as
non-negotiable: they are the Meridian Engineering Constitution, not style
preferences, and they are enforced independently by the guardrail gate in CI
(`.github/workflows/guardrail-gate.yml`) as well as in-session. Start with
`.bob/rules/00-engineering-constitution.md` and read the numbered rules it
indexes before proposing an edit. Modernization work follows the plan-first
workflow (rule 07): assessment and an approved plan come before any code, and
behavioral equivalence against the legacy console (rule 08) is what the change
is judged on. The control environment itself — `.bob/`, `.bobignore`,
`.github/`, `governance/`, `dashboard/` — is protected (rule 06) and is never
modified as part of a feature change.
