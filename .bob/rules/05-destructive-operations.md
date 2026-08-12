# Destructive operations and high-risk actions (human-in-the-loop)

Some actions are not "write safer code" — they are "do not do this without a
human." These require an explicit approval gate: describe what you are about to
do, why it is high-risk, and wait for confirmation before writing files or
running commands.

## Hard deletes of financial records — prohibited

Payment records, payment exceptions, customer records, operator records, and
audit records must never be removed with a hard `DELETE`. Propose a
**soft-delete** pattern instead — a `status` change plus a `deleted_at`
timestamp, with every read path filtered to exclude soft-deleted rows — and
flag the request for human review.

Permanent destruction of a financial record is a records-retention event, not a
feature. Retention periods are set by Legal and Compliance under SOX and
FFIEC record-retention obligations; no engineering change may shorten them.

## Destructive shell and database commands — blocked

Never generate or run commands that destroy data or infrastructure without an
explicit, confirmed human approval: `rm -rf`, `DROP TABLE` / `DROP DATABASE`,
`TRUNCATE`, unfiltered `UPDATE`/`DELETE` statements, schema migrations that drop
columns, force pushes, mass credential rotation, or anything that deletes cloud
resources.

## Bulk and unauthenticated agent actions

An agent that issues high volumes of API calls with no attributable identity
produces traffic that security operations cannot distinguish from an incident,
and activity that audit cannot attribute to an authorized actor.

- Do not generate loops or scripts that fire large volumes of API calls against
  an external or internal endpoint without an explicit, confirmed request that
  states the target, the expected volume, and the credential source.
- Never embed a long-lived shared credential in such a script. If a script must
  authenticate, read a short-lived credential from the environment (rule 01) and
  note in the change log that runtime identity governance is the system of
  record for that call.
- Rate-limit and checkpoint any batch that touches payment records, so a partial
  run is recoverable and reconcilable.
- Flag any request of this shape for human review before producing it.
