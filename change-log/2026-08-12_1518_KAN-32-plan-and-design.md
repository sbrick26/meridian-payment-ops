# Change log — 2026-08-12_1518 — KAN-32 modernization plan and design spec

## Prompt

"check my tickets — scope is Held Payments screen and payment-status/risk API; modernize in place; AI agent access channel in scope; done means plan approved and first slice shipped with proof; PRs target demo-integration. Work PHASE 2 through to the approval gate."

## Files changed

| File | Change |
|---|---|
| `docs/modernization/KAN-32/PLAN.md` | New planning document for KAN-32 epic: Held Payments screen + payment-status/risk API modernization. One document containing current state (5 grounded findings), target state, 3 subtasks with acceptance criteria and due dates, out-of-scope list, equivalence strategy, and key decisions. |
| `docs/design/KAN-32-spec.md` | Design specification frozen from Meridian Design Language 3.0 Figma page (file saGgyANlhq6lW8zEJd1RWu, frame 120:431). Contains all color tokens, typography tokens, spacing scale, border radii, and exact component specs for the Held Payments table redesign. |
| `change-log/2026-08-12_1518_KAN-32-plan-and-design.md` | This file. |

## Controls applied

| Rule | Control |
|---|---|
| Rule 07 (plan-first delivery) | PLAN.md committed before any code change; approval gate established on KAN-32 |
| Rule 09 (design system fidelity) | All design tokens read from MDL 3.0 Figma source; no values invented |
| Rule 03 (audit trail) | This change-log entry |
| Rule 02 (compliance headers) | No new code in this commit; compliance headers will be applied in subtask implementation commits |
| NIST AU-2, AU-12 | Planning artifact committed to source control with full lineage |
| SOX 404 | Planning record provides change management evidence for the upcoming implementation PRs |

## Risk notes

- Desktop Bridge plugin was unavailable at plan publication time (WebSocket server running on fallback port 9226 with multiple orphan instances; plugin not attached to any). BEFORE/AFTER Figma frames are deferred per workflow rule: "the plan is the gate; the design is evidence attached to it." The `docs/design/KAN-32-spec.md` is complete and frozen from the REST-readable MDL 3.0 frame and is sufficient for implementation.
- The plan intentionally scopes only `/api/payment-status` and `/api/risk-score` for backend remediation. The remaining 11 injection-vulnerable routes are noted as out of scope and tracked separately.
- No code was written in this commit. This record documents the planning phase only.

## Approval

Plan approval is pending reviewer reply on KAN-32 in Jira. Implementation does not begin until approval is recorded.
