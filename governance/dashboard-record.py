#!/usr/bin/env python3
"""Meridian - Engineering Governance: build the evidence record for one gate run.

Two outputs, from one verdict:

1. Dashboard record - an enriched, append-only record (verdict + violations +
   severity + who/what/when) appended to the JSON array at argv[1]. This is the
   feed the gh-pages control-evidence dashboard reads.

2. Governance event - a single JSON object matching the shared event schema used
   by hooks/emit-event.sh and the local governance dashboard:
     {ts, source, actor, event_type, rule, severity, detail, tool, session_id}
   Written to $EVENT_JSON when that variable is set, so the workflow can upload
   it as a build artifact and optionally POST it to MTGOV_CI_WEBHOOK.

Reads the normalized verdict written by parse-verdict.py at $VERDICT_JSON. If
that file is missing (the audit job errored before producing one), the record is
kept as verdict ERROR so nothing is silently dropped. Pull-request / commit /
user metadata comes from DB_* environment variables set by the workflow.

Usage:  dashboard-record.py <violations.json>   # appends one record in place
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

SEVERITY_ORDER = {"info": 0, "low": 0, "medium": 1, "high": 2, "critical": 3}

# Severity policy for the Meridian Engineering Constitution, keyed on the rule
# file the audit cited. This is the authoritative mapping; the keyword pass
# below only runs when the rule field is missing or unrecognised.
RULE_SEVERITY = {
    "00": "critical",   # constitution / canary
    "01": "critical",   # secure coding - secrets, SQL injection, input validation
    "02": "medium",     # compliance headers
    "03": "medium",     # audit and change log
    "04": "medium",     # approved libraries
    "05": "high",       # destructive operations
    "06": "critical",   # governance protection (tampering)
    "07": "high",       # plan-first delivery
    "08": "high",       # behavioral equivalence
    "09": "medium",     # design system fidelity
    "10": "medium",     # current date
}

RULE_NUM_RE = re.compile(r"\b(0\d|10)\b")


def severity_for(v):
    """Map a violation to a severity: rule number first, keywords as fallback."""
    rule = str(v.get("rule", ""))
    m = RULE_NUM_RE.match(rule.strip()) or RULE_NUM_RE.search(rule)
    if m and m.group(1) in RULE_SEVERITY:
        return RULE_SEVERITY[m.group(1)]

    text = " ".join(str(v.get(k, "")) for k in ("rule", "detail", "file")).lower()
    if any(k in text for k in ("tamper", "governance-protection", "canary", ".bob/", ".bobignore")):
        return "critical"
    if any(k in text for k in ("secret", "api key", "apikey", "credential", "hardcoded",
                               "sql", "injection", "template literal", "secure-coding")):
        return "critical"
    if any(k in text for k in ("delete", "destructive", "drop table", "truncate", "bulk",
                               "unauthenticated", "destructive-operations")):
        return "high"
    if any(k in text for k in ("plan", "blocker", "assessment", "plan-first")):
        return "high"
    if any(k in text for k in ("equivalence", "golden", "legacy", "parity")):
        return "high"
    if any(k in text for k in ("design", "token", "figma", "wcag", "design-system")):
        return "medium"
    if any(k in text for k in ("library", "package.json", "dependency", "unapproved")):
        return "medium"
    if any(k in text for k in ("header", "compliance", "change-log", "changelog", "validation")):
        return "medium"
    return "medium"


def load_verdict():
    path = os.environ.get("VERDICT_JSON")
    if path and os.path.exists(path):
        try:
            with open(path) as f:
                data = json.load(f)
            return data.get("verdict", "UNPARSEABLE"), (data.get("violations") or [])
        except (json.JSONDecodeError, OSError):
            pass
    # Job errored before a verdict existed - record it, do not drop it.
    return "ERROR", []


def sanitize(text, limit=200):
    """Match the event-schema contract: single line, truncated."""
    s = " ".join(str(text or "").split())
    return s[: limit - 3] + "..." if len(s) > limit else s


def build_event(verdict, violations, max_sev, record):
    """One governance event matching hooks/mtgov-lib.sh log_event()."""
    passed = verdict == "PASS"
    if passed:
        severity = "info"
        rule = None
        detail = "Guardrail gate passed for PR #%s (%s) - no Engineering Constitution violations." % (
            record["pr_number"] or "?", record["sha"] or "?")
    else:
        severity = max_sev if violations else "high"
        # Cite the highest-severity rule; strip the .md so it matches the
        # rule naming used by emit-event.sh (e.g. 08-behavioral-equivalence).
        worst = max(violations, key=lambda v: SEVERITY_ORDER.get(v.get("severity", "medium"), 1),
                    default=None)
        rule = (worst or {}).get("rule") or None
        if rule and rule.endswith(".md"):
            rule = rule[:-3]
        detail = "Guardrail gate %s for PR #%s (%s): %d violation(s)%s" % (
            verdict.lower(),
            record["pr_number"] or "?",
            record["sha"] or "?",
            len(violations),
            "; worst: " + str((worst or {}).get("detail", "")) if worst else "",
        )
    return {
        "ts": record["timestamp"],
        "source": "ci",
        "actor": record["actor"] or "ci",
        "event_type": "gate_pass" if passed else "gate_fail",
        "rule": rule,
        "severity": severity,
        "detail": sanitize(detail),
        "tool": None,
        "session_id": sanitize(record["id"] or "ci", 80) or "ci",
    }


def main():
    if len(sys.argv) < 2:
        print("usage: dashboard-record.py <violations.json>", file=sys.stderr)
        sys.exit(1)
    log_path = sys.argv[1]

    verdict, violations = load_verdict()
    for v in violations:
        v["severity"] = severity_for(v)
    max_sev = "medium" if violations else "info"
    for v in violations:
        if SEVERITY_ORDER[v["severity"]] > SEVERITY_ORDER[max_sev]:
            max_sev = v["severity"]

    e = os.environ.get
    record = {
        "id": "%s-%s" % (e("DB_RUN_ID", ""), e("DB_SHA", "")[:7]),
        "timestamp": e("DB_TIMESTAMP") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verdict": verdict,
        "severity": max_sev if violations else ("none" if verdict == "PASS" else "high"),
        "violation_count": len(violations),
        "violations": violations,
        "actor": e("DB_ACTOR", "unknown"),
        "triggered_by": e("DB_TRIGGERED_BY", ""),
        "pr_number": e("DB_PR_NUMBER", ""),
        "pr_title": e("DB_PR_TITLE", ""),
        "pr_url": e("DB_PR_URL", ""),
        "branch": e("DB_BRANCH", ""),
        "base_ref": e("DB_BASE", ""),
        "sha": e("DB_SHA", "")[:7],
        "commit_message": e("DB_COMMIT_MSG", ""),
        "repo": e("DB_REPO", ""),
        "project": e("DB_PROJECT", "MERIDIAN-PAYMENT-OPS"),
        "run_url": e("DB_RUN_URL", ""),
    }

    try:
        with open(log_path) as f:
            log = json.load(f)
        if not isinstance(log, list):
            log = []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        log = []

    # Newest first; de-dup by id so a re-run of the same job replaces its record.
    log = [r for r in log if r.get("id") != record["id"]]
    log.insert(0, record)

    with open(log_path, "w") as f:
        json.dump(log, f, indent=2)

    event_path = e("EVENT_JSON")
    if event_path:
        event = build_event(verdict, violations, max_sev, record)
        with open(event_path, "w") as f:
            json.dump(event, f, ensure_ascii=False, separators=(",", ":"))
        print("event: %s/%s -> %s" % (event["event_type"], event["severity"], event_path))

    print("recorded: %s for PR #%s by %s (%d violation(s))"
          % (record["verdict"], record["pr_number"], record["actor"], record["violation_count"]))


if __name__ == "__main__":
    main()
