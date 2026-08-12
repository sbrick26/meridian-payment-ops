#!/usr/bin/env python3
"""Meridian - Engineering Governance: deterministic governance guard.

A pure path check, no model judgment. Reads changed file paths (one per line) on
stdin. If any touch a protected, owner-only governance path, writes a FAIL
verdict (to $VERDICT_JSON and to the markdown summary path in argv[1]) and exits
2. Otherwise exits 0.

Protected paths (rule 06-governance-protection.md): everything under `.bob/`,
plus `.bobignore`, `governance/`, `.github/`, and `dashboard/`. These define the
control environment. They travel on the `governance` branch, reviewed separately
by the governance owner via CODEOWNERS - never folded into a code pull request.

This runs BEFORE the model audit so tampering is blocked by math, not opinion.
"""

import json
import os
import re
import sys

PROTECTED = re.compile(r"^(\.bob/|\.bobignore$|governance/|\.github/|dashboard/)")

RULE = "06-governance-protection.md"
DETAIL = ("Protected governance file modified in a pull request; the .bob/, "
          ".bobignore, governance/, .github/, and dashboard/ paths define the "
          "control environment and change only on the governance branch with "
          "code-owner review (deterministic block).")


def main():
    changed = [l.strip() for l in sys.stdin if l.strip()]
    hits = [f for f in changed if PROTECTED.match(f)]
    summary_path = sys.argv[1] if len(sys.argv) > 1 else None

    if not hits:
        print("Deterministic guard: no protected governance files touched.")
        sys.exit(0)

    violations = [{"file": f, "rule": RULE, "detail": DETAIL} for f in hits]

    vj = os.environ.get("VERDICT_JSON")
    if vj:
        with open(vj, "w") as f:
            json.dump({"verdict": "FAIL", "violations": violations}, f)

    if summary_path:
        lines = [
            "## Meridian - Engineering Governance: guardrail audit",
            "",
            "**Verdict: FAIL**",
            "",
            "Deterministic governance guard - this pull request modifies "
            "protected, owner-only governance files and cannot merge.",
            "",
            "| File | Rule | Detail |",
            "|---|---|---|",
        ]
        for f in hits:
            lines.append(
                "| `%s` | %s | Protected governance file modified in a code PR "
                "(deterministic block). |" % (f, RULE)
            )
        lines += ["", "Governance changes belong on the `governance` branch, "
                      "reviewed by the code owner."]
        with open(summary_path, "w") as f:
            f.write("\n".join(lines) + "\n")

    print("Deterministic guard FAIL - protected files touched:")
    for f in hits:
        print("  " + f)
    sys.exit(2)


if __name__ == "__main__":
    main()
