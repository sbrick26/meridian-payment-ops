#!/usr/bin/env python3
"""Meridian - Engineering Governance: parse the verdict out of a Bob audit run.

Reads the raw audit output on stdin, finds the LAST JSON object containing a
"verdict" key, validates it, and writes a markdown summary to the path given as
argv[1] (used as the pull-request comment body).

Bob Shell 2.0 note: `bob run --format json` prints ONE JSON envelope line of the
shape {"type":"result","status":"success","stats":{...},"last_message":"..."}.
The model's verdict object lives inside "last_message" as an escaped string, so
a naive regex over the raw text finds \\"verdict\\" and fails to parse. This
parser therefore unwraps the envelope first, then scans. It still falls back to
scanning the raw text, so `--format pretty` output (or a plain paste) also works.

Fail-closed contract:
  exit 0  -> verdict PASS
  exit 2  -> verdict FAIL (violations listed)
  exit 3  -> no parseable verdict (treated as a failure by the workflow)

Side output: if the VERDICT_JSON environment variable is set, the normalized
verdict object ({"verdict": ..., "violations": [...]}) is written there too, so
the dashboard/event-recording step has a clean machine-readable payload.
"""

import json
import os
import re
import sys

# Where a verdict object might start. Brace matching is done by the JSON
# decoder rather than by a pattern: a regex cannot count nesting, and the audit
# legitimately quotes offending source in its details — a finding about a
# template literal contains ${...}, whose braces silently defeat any
# fixed-depth expression. That produced an UNPARSEABLE gate on a run whose
# verdict was perfectly well-formed.
VERDICT_START_RE = re.compile(r"\{\s*\"verdict\"")


def unwrap_bob_envelope(raw):
    """Return a list of texts to scan: the envelope's last_message (if the
    output is a Bob Shell 2.0 --format json envelope) plus the raw text."""
    texts = []
    for line in reversed(raw.strip().splitlines()):
        line = line.strip()
        if not (line.startswith("{") and line.endswith("}")):
            continue
        try:
            env = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(env, dict) and "last_message" in env:
            msg = env.get("last_message")
            if isinstance(msg, str):
                texts.append(msg)
            break
    texts.append(raw)
    return texts


def find_verdict(raw):
    """Last well-formed verdict object in the audit output, or None.

    Scans every position where a verdict object could begin and lets
    json.JSONDecoder.raw_decode consume exactly one value from there. The
    decoder tracks nesting and string escaping properly, so quoted code in a
    detail field cannot break extraction. The last valid object wins: the model
    may reason aloud before committing to its answer.
    """
    decoder = json.JSONDecoder()
    for text in unwrap_bob_envelope(raw):
        verdict = None
        for m in VERDICT_START_RE.finditer(text):
            try:
                candidate, _ = decoder.raw_decode(text[m.start():])
            except ValueError:
                continue
            if isinstance(candidate, dict) and candidate.get("verdict") in ("PASS", "FAIL"):
                verdict = candidate
        if verdict is not None:
            return verdict
    return None


def main():
    raw = sys.stdin.read()
    summary_path = sys.argv[1] if len(sys.argv) > 1 else None

    verdict = find_verdict(raw)

    if verdict is None:
        write_summary(summary_path, "UNPARSEABLE", [], raw)
        write_verdict_json("UNPARSEABLE", [], raw)
        print("FAIL-CLOSED: no parseable verdict in audit output.")
        sys.exit(3)

    violations = verdict.get("violations") or []
    if not isinstance(violations, list):
        violations = []
    write_summary(summary_path, verdict["verdict"], violations, raw)
    write_verdict_json(verdict["verdict"], violations, raw)

    if verdict["verdict"] == "PASS":
        print("Guardrail audit verdict: PASS")
        sys.exit(0)
    print("Guardrail audit verdict: FAIL (%d violation(s))" % len(violations))
    for v in violations:
        print("  - %s: %s [%s]" % (v.get("file", "?"), v.get("detail", "?"), v.get("rule", "?")))
    sys.exit(2)


def write_summary(path, verdict, violations, raw):
    if not path:
        return
    lines = [
        "## Meridian - Engineering Governance: guardrail audit",
        "",
        "**Verdict: %s**" % verdict,
        "",
    ]
    if verdict == "UNPARSEABLE":
        lines += [
            "The audit produced no machine-readable verdict, so the gate fails",
            "closed. Raw output tail:",
            "```",
            raw[-1500:],
            "```",
        ]
    elif violations:
        lines.append("| File | Rule | Detail |")
        lines.append("|---|---|---|")
        for v in violations:
            lines.append(
                "| `%s` | %s | %s |"
                % (v.get("file", "?"), v.get("rule", "?"), str(v.get("detail", "?")).replace("|", "\\|"))
            )
        lines += ["", "Audited against the Engineering Constitution pinned from the "
                      "immutable `governance` branch."]
    else:
        lines.append("No Engineering Constitution violations found in this diff.")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def write_verdict_json(verdict, violations, raw):
    path = os.environ.get("VERDICT_JSON")
    if not path:
        return
    payload = {"verdict": verdict, "violations": violations}
    if verdict == "UNPARSEABLE":
        payload["raw_tail"] = raw[-1500:]
    with open(path, "w") as f:
        json.dump(payload, f)


if __name__ == "__main__":
    main()
