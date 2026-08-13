# Change log — KAN-37 Modernization plan and design

**Prompt:** "check my tickets" — execute governed modernization workflow for KAN-37.

## Files changed

| Path | Summary |
|---|---|
| `docs/modernization/KAN-37/PLAN.md` | New: modernization plan for AP Payment Operations console Phase 1 |
| `docs/design/KAN-37-spec.md` | New: frozen MDL 3.0 design spec for Held Payments AFTER frame |
| `docs/design/KAN-37-after.meta.json` | New: Figma node reference for AFTER frame PNG (REST export pending token renewal) |

## Controls applied

| Rule | NIST 800-53 | SOX / PCI-DSS |
|---|---|---|
| Rule 07 — Plan-first delivery | CM-2, CM-6 | SOX ITGC change management |
| Rule 09 — Design system fidelity | — | — |
| Rule 03 — Audit trail | AU-2, AU-12 | PCI Req. 10; SOX 404 |

## Risk notes

- PLAN.md grounded in subagent analysis of actual codebase; every finding cites a file path.
- No code written; this is the planning artifact only — implementation requires named approver on KAN-37.
- Design spec values read directly from Figma MDL 3.0 page; no tokens invented.
- `risk_flag` field name preserved in v2 API (requester confirmed in walk-through, 2026-08-13).
- AFTER frame PNG export pending Figma REST token renewal; screenshot confirmed correct via plugin capture.

## Approval

Plan approval must be recorded on KAN-37 by a named approver before any implementation begins (Rule 07).
