You are performing a read-only governance audit of a pull request against the
Meridian Engineering Constitution. The unified diff of the pull request is
provided on stdin above this instruction block.

The Constitution is loaded as workspace rules in `.bob/rules/` (files `00` to
`10`). It has been pinned from the immutable `governance` branch for this audit,
so the rules you judge against are the canonical ones regardless of what this
pull request does to them.

Do not modify any files. Do not audit unchanged code. Judge only what the diff
adds or changes.

This codebase is JavaScript (Node/Express) with EJS templates and a SQLite data
layer. Application code means files such as `app.js`, `server.js`, and anything
under `routes/`, `api/`, `src/`, `lib/`, `db/`, `views/`, `public/`, plus
`package.json`.

Judge these specifically:

1. **Inline secrets** (`01-secure-coding.md`) - any API key, password, token,
   connection string, or certificate written into a source file as a literal
   instead of read from `process.env` at the point of use.

2. **Unsafe SQL** (`01-secure-coding.md`) - SQL built by string concatenation,
   template literals, or any interpolation, instead of parameterized queries
   with bound `?` placeholders.

3. **Missing input validation** (`01-secure-coding.md`) - a new or changed
   route handler or user-facing query path that accepts request input
   (`req.body`, `req.query`, `req.params`) without validation before it reaches
   the data layer or a response.

4. **Hard deletes and destructive operations** (`05-destructive-operations.md`) -
   a hard `DELETE` of payment, payment-exception, customer, operator, or audit
   records instead of the required soft-delete pattern (`status` change plus
   `deleted_at`, with read paths filtered); or generated `DROP TABLE`,
   `DROP DATABASE`, `TRUNCATE`, `rm -rf`, unfiltered `UPDATE`/`DELETE`, or a
   column-dropping migration.

5. **Missing compliance header** (`02-compliance-headers.md`) - a new route
   handler, exported function, module, or EJS view template that does not begin
   with the required header comment carrying Function/View, Owner, Control (NIST
   800-53 id plus SOX/PCI reference), and Reviewed date.

6. **Unapproved libraries** (`04-approved-libraries.md`) - a dependency added to
   `package.json` that is not on the allowlist (express, ejs, better-sqlite3,
   sqlite3, helmet, express-validator, dotenv, pino, jest, supertest, eslint,
   prettier, node-fetch) and carries no approval note in the plan document
   naming the library, need, license, maintenance status, and approver.

7. **Bulk or unauthenticated agent actions** (`05-destructive-operations.md`) -
   loops or scripts firing high volumes of API calls without a stated target,
   expected volume, and credential source; or a long-lived shared credential
   embedded in such a script.

8. **Governance tampering** (`06-governance-protection.md`) - the diff adds,
   removes, modifies, or weakens ANY file under `.bob/` (the entire folder -
   rules, skills, modes, everything), `.bobignore`, `governance/`, `.github/`, or
   `dashboard/`. These define the control environment and change only on the
   `governance` branch under code-owner review. If the diff touches any of them
   at all, that is a FAIL.

9. **Change log** (`03-audit-and-change-log.md`) - when the diff changes
   application code it must ALSO add a `change-log/YYYY-MM-DD_HHMM_short-description.md`
   entry, complete and unblocked. FAIL for any of:
   (a) *Missing* - code changed, no change-log entry added in the same diff.
   (b) *Incomplete* - an entry is present but missing any required section, or
       leaves one empty or placeholder. Required sections: Prompt, Files changed,
       Controls applied, Risk notes, Approval.
   (c) *Open blocker* - an unresolved item that should block merge: a
       `Control: TBD` shipped with no noted human review, an Approval marked
       pending/withheld/TODO for a high-risk (rule 05) change, or any explicit
       open blocker, unresolved question, or `BLOCKED`/`FIXME` marker.
   State which case (missing / incomplete / open blocker) in the detail.

10. **Plan-first delivery** (`07-plan-first-delivery.md`) - application-code
    changes must be traceable to a committed plan for their epic, under
    `docs/modernization/<EPIC-KEY>/` with `01-assessment.md`, `02-plan.md`, and
    `03-decisions.md`. FAIL for any of:
    (a) *Missing plan* - application code changed but no plan document for that
        epic exists in the repository or is added by this diff.
    (b) *Open blocker* - an added or existing plan document for the epic still
        carries an unresolved `[BLOCKER]` marker; implementation must not begin
        while a blocker is open.
    (c) *Rewritten plan* - the diff modifies or deletes an EXISTING
        `docs/modernization/…` file. Planning records are append-only: a change
        may add documents or append a dated revision section, never rewrite or
        delete committed content.
    (d) *Ungrounded assessment* - an added `01-assessment.md` describes existing
        behavior without citing file paths.
    State which case in the detail.

11. **Behavioral equivalence** (`08-behavioral-equivalence.md`) - any diff that
    replaces, rewrites, re-platforms, or re-implements an existing API endpoint
    or business rule must carry equivalence evidence. FAIL for any of:
    (a) *No golden fixtures* - no committed capture of the legacy responses
        across the input matrix (nominal, boundary, error paths, authorization
        variants, data quirks).
    (b) *No equivalence suite* - no automated test that runs the same inputs
        against modern and legacy implementations and compares status code,
        response body field by field, monetary precision and rounding, date and
        timestamp formatting, error codes, and observable side effects.
    (c) *Undocumented behavior change* - an intended difference that is not
        listed in `02-plan.md` as excluded from the comparison.
    An endpoint rewritten with no equivalence evidence in the diff is a FAIL
    even if the new implementation looks correct.

12. **Design system fidelity** (`09-design-system-fidelity.md`) - a change to
    what a user sees (new screens, changed layouts, new or restyled components,
    changed interface copy in `views/` or `public/`) must reference Meridian
    Design Language 3.0. FAIL for any of:
    (a) *Invented tokens* - a hex colour, font size, spacing, radius, or
        elevation value introduced by judgement rather than taken from the
        design system.
    (b) *No design reference* - a user-visible change with no reviewing designer
        and date recorded in the plan document, and no statement of which screens
        were verified against which design frames.

Mechanically-verified requirements are OUT of audit scope: the gate itself
verifies (a) that a copied vault-scope.js is byte-identical to the template
and (b) that the golden-fixture commit precedes every legacy-code change in
the branch history. Do not report findings on those two points - the machine
check is the authority, and the diff alone cannot show commit order.

Grounding requirement - the pinned rule files are the ONLY authority. Before
reporting a violation, re-read the named rule file and find the exact sentence
the diff violates. Include it verbatim in a "quote" field. If no sentence of
the current rule text supports the finding, DISCARD the finding - do not
require a document structure, filename, or practice remembered from an older
version of a rule. (A real failure this clause exists for: an audit demanded a
three-file planning record that the current rule 07 explicitly forbids.)

Output format - print EXACTLY one JSON object as the final line of your answer,
no code fences, no trailing text:

{"verdict": "PASS", "violations": []}

or

{"verdict": "FAIL", "violations": [{"file": "<path>", "rule": "<rule file>", "detail": "<one sentence>", "quote": "<verbatim sentence from the rule file>"}]}

The "rule" field is the authoritative classification and must be the exact rule
filename, one of:

  00-engineering-constitution.md, 01-secure-coding.md, 02-compliance-headers.md,
  03-audit-and-change-log.md, 04-approved-libraries.md,
  05-destructive-operations.md, 06-governance-protection.md,
  07-plan-first-delivery.md, 08-behavioral-equivalence.md,
  09-design-system-fidelity.md, 10-current-date.md

The "detail" field states the specific problem in one plain sentence and must
NOT cite a rule number; if you name a rule at all it must be the same one in the
"rule" field. Never reference a different rule number inside the detail.

A diff with no rule violations is a PASS even if the code could be improved.
Any violation of the twelve points above is a FAIL.
