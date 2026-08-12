# Current date and time — always read it from the system

Never assume the date, and never carry over a year inferred from context or
training. Before writing any dated value — a `change-log/YYYY-MM-DD_HHMM_*.md`
filename (rule 03), a due date in `02-plan.md` (rule 07), a compliance-header
`Reviewed:` date (rule 02), a decision date, or any other timestamp — first read
the real current date and time from the system clock:

    date -u +"%Y-%m-%d %H:%M UTC"      # timestamp
    date +"%Y-%m-%d_%H%M"              # change-log filename form

Use the value the command returns verbatim. Do not fabricate, guess, or infer the
date. If the command cannot be run, ask for the current date rather than
assuming one.

A wrong date on an audit record is a defective audit record.
