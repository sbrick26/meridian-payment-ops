#!/usr/bin/env python3
"""Verdict extraction must survive whatever the audit quotes in its findings.

The gate once reported UNPARSEABLE on a perfectly well-formed verdict because a
finding quoted a template literal — the ${...} braces defeated a fixed-depth
regex. Fail-closed kept it safe, but the reviewer lost the violation table.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PARSER = os.path.join(HERE, "parse-verdict.py")


def run(stdin_text):
    out = tempfile.NamedTemporaryFile(suffix=".md", delete=False)
    out.close()
    p = subprocess.run([sys.executable, PARSER, out.name], input=stdin_text,
                       capture_output=True, text=True)
    with open(out.name) as fh:
        summary = fh.read()
    os.unlink(out.name)
    return p.returncode, p.stdout, summary


def envelope(message):
    return json.dumps({"type": "result", "status": "success",
                       "stats": {"task_id": "t"}, "last_message": message})


CASES = []

# The real-world failure: a detail quoting ${ref}.
braces_in_detail = json.dumps({
    "verdict": "FAIL",
    "violations": [{
        "file": "server.js", "rule": "01-secure-coding.md",
        "detail": "builds SQL with a template literal (WHERE ref = '${ref}') "
                  "instead of a bound ? placeholder",
    }],
})
CASES.append(("braces quoted in a detail", envelope("Analysis...\n" + braces_in_detail), 2, "01-secure-coding"))

# Plain PASS, no envelope (pretty output or a paste).
CASES.append(("bare PASS json", json.dumps({"verdict": "PASS", "violations": []}), 0, None))

# Prose first, verdict last: the model reasons aloud before committing.
CASES.append((
    "prose then verdict",
    envelope("Let me check each rule.\n\n1. Secrets — none.\n\n" +
             json.dumps({"verdict": "FAIL", "violations": [
                 {"file": "a.js", "rule": "08-behavioral-equivalence.md",
                  "detail": "endpoint rewritten with no golden fixtures"}]})),
    2, "08-behavioral-equivalence"))

# An earlier draft verdict must lose to the final one.
CASES.append((
    "last verdict wins",
    envelope(json.dumps({"verdict": "PASS", "violations": []}) + "\nOn reflection:\n" +
             json.dumps({"verdict": "FAIL", "violations": [
                 {"file": "b.js", "rule": "05-destructive-operations.md",
                  "detail": "hard delete of payment records"}]})),
    2, "05-destructive-operations"))

# Nothing parseable at all still fails closed.
CASES.append(("no verdict at all", envelope("I could not complete the audit."), 3, None))

failed = 0
for label, payload, want_code, want_rule in CASES:
    code, stdout, summary = run(payload)
    ok = code == want_code and (want_rule is None or want_rule in summary)
    if not ok:
        failed += 1
    print(("PASS " if ok else "FAIL ") + label + " (exit %d, wanted %d)" % (code, want_code))

print("ALL PASS" if not failed else "%d FAILURE(S)" % failed)
sys.exit(1 if failed else 0)
