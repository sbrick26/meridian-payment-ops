# Change log — 2026-08-12_2229 — KAN-43: Add Deprecated headers to legacy API routes

## Prompt
PHASE 7: Deploy and activate merged PR #9 (backend API v2). Acceptance criteria required `Deprecated` headers on legacy `/api/payment-status` and `/api/risk-score` endpoints.

## Files changed
- `server.js` — Added `Deprecation: true` and `Link:` (RFC 8594) headers to `GET /api/payment-status` and `GET /api/risk-score` handlers, pointing downstream consumers to the v2 successors.

## Controls applied
- Rule 01 (secure coding): no new query construction; headers only
- Rule 02 (compliance headers): existing handler headers unchanged; this edit is additive
- Rule 03 (audit and change log): this entry
- Rule 08 (behavioral equivalence): response bodies are untouched; headers are additive and do not alter the golden fixtures (golden cases compare body only, not headers)
- NIST AU-2 (audit events): deprecation signals surfaced to consumers

## Risk notes
None. Adding HTTP headers to existing responses is a non-breaking additive change. Golden equivalence fixtures compare JSON body fields only and are not affected.

## Approval
Authorisation: KAN-41 plan approved by Swayam Barik on 2026-08-12 (Jira KAN-41 comment 10319 — "approved - plan and design look good").
KAN-43 is a subtask of KAN-41; it inherits the epic's plan approval.
