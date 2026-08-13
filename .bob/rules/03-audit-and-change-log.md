# Audit trail and change log

No AI-assisted change to a Meridian Corp system may be unaccounted for. Every
change Bob makes writes its own record, in-repo, at the time of the change.

After **every** change you make to code in this repository, write a file in
`change-log/`. Create the folder if it does not exist.

File name: `YYYY-MM-DD_HHMM_short-description.md` (read the real clock first —
rule 10).

Each entry contains:

- **Prompt** — the requester's instruction, verbatim.
- **Files changed** — each path with a one-line summary of the change.
- **Controls applied** — which Constitution rules and which NIST 800-53 /
  SOX / PCI-DSS controls governed the change (cross-reference the compliance
  header written under rule 02).
- **Risk notes** — anything a reviewer must see: a refused sub-request, a
  `Control: TBD`, a touch on payment or customer records, a substituted
  library, an intended behavior change under rule 08.
- **Approval** — record the authorisation this change was made under: for
  planned work, the epic whose plan was approved, who approved it and when
  (quote the ticket comment); for any high-risk generation (rule 05), that
  human confirmation was requested and given before files were written. A
  change-log entry that cannot name its authorisation is not decision lineage,
  it is a diary.

This is decision lineage for SOX 404 change management and PCI-DSS Req. 10.
It is the in-repository record; it feeds, and does not replace, the enterprise
audit system of record. Treat it as the seam where per-change evidence flows
into the firm's control-testing evidence pack.
