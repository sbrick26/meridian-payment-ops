# KAN-47 — Modernization plan: AP Payment Operations Console (Phase 1)

| | |
|---|---|
| **Epic** | KAN-47 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-13 |
| **Status** | Approved |

## Current state

- **All 13 user-input query parameters build SQL by string concatenation** across every route — `/exceptions`, `/:id`, `/reports/export.csv`, `/api/payment-status`, `/api/risk-score`, `/api/exceptions.xml` — creating critical injection exposure throughout (`server.js` lines 155–643).
- **Frontend runs Bootstrap 2 and jQuery 1.9.1** (both EOL since ~2016); risk is encoded as red row shading with no text label, which fails WCAG 1.4.1 color-only criterion (`views/exceptions.ejs` line 86; `public/vendor/`).
- **Service accounts and API keys are hardcoded** in application source: `SMTP_PASS = 'meridian2013!'` and `ERP_FEED_KEY = 'ERP-POLL-KEY-8842'` (`server.js` lines 43–49); the ERP key is declared but never validated in the XML feed route.
- **Zero test coverage** — no tests/ directory, no test scripts in `package.json`; the risk-scoring algorithm (`scoreRow`, `server.js` lines 407–516) runs in production without any automated verification.
- **MCP agent template exists but is not wired** — `design/figma/render-screen.js` was already delivered; `.bob/skills/agent-enablement/templates/mcp-endpoint.js` defines 5 tools but references `/api/v2/*` routes that do not yet exist in `server.js`.

**Why this is worth doing now:** 340 vendor status calls per week reach the AP hotline because the tooling cannot deflect them; a governed agent channel on a modern, tested API would eliminate most of that volume. The SQL injection exposure and hardcoded credentials are a PCI-DSS Req. 6.5 / SOX ITGC finding that cannot ship unaddressed.

## Target state

The Held Payments screen is rebuilt to Meridian Design Language 3.0 (chip-based status and risk labels replacing color-only row shading, 14 px minimum type, WCAG 2.2 AA). The legacy `/api/payment-status` and `/api/risk-score` endpoints are replaced by parameterized `/api/v2/` equivalents proven behaviorally equivalent by a golden-capture suite. An MCP agent endpoint mounts on the modernized service and exposes read-only payment inquiry tools behind scoped identity (vault/inquiry scope); write operations are governed by the boundary the MCP template already specifies.

**Workstreams**

1. **Backend API v2** — replace `/api/payment-status` and `/api/risk-score` with parameterized `/api/v2/payment-status` and `/api/v2/risk-score`; golden capture suite; equivalence verified (0 diffs).
2. **Frontend MDL 3.0** — activate `public/mdl-3.css` in the Held Payments view, update markup to chip-based status/risk labels, remove Bootstrap 2 / jQuery 1.9.1 from that view.
3. **Agent enablement** — mount the MCP endpoint, wire vault identity, verify read-authorized / write-refused boundary, surface the agent on the console.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Backend API v2: payment-status and risk-score | `server.js` new `/api/v2/` routes; golden fixtures in `tests/golden/`; equivalence suite in `tests/` | All existing golden cases pass; 0 unexplained diffs; `npm test` green | 2026-08-15 |
| 2 | Frontend: Held Payments MDL 3.0 | `views/exceptions.ejs`; `views/partials/header.ejs` (link `mdl-3.css`, remove Bootstrap 2 / jQuery 1.9.1 tags from this view) | Status and risk rendered as labeled chips; no color-only indicator; `npm test` green; fidelity screenshot matches `docs/design/KAN-47-after.png` | 2026-08-19 |
| 3 | Agent enablement: MCP endpoint + vault identity | `routes/mcp-endpoint.js` (from template); `vault/` identity config; `server.js` mount; voice line unchanged | Read tool returns payment data; write attempt returns governed refusal; smoke-test output (both lines) in PR body | 2026-08-21 |

## Out of scope

- `/exceptions`, `/exceptions/:id`, `POST /exceptions/:id/resolve`, `/reports`, and `/api/exceptions.xml` SQL hardening — risk is real but addressed in a follow-on epic; this epic replaces the two API endpoints and the Held Payments view only.
- Authentication and CSRF across all routes — no auth layer exists and adding one changes operator workflow; scope for a separate initiative.
- Dashboard, Reports, Help screens — no design or behavior changes in this epic.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` → `/api/v2/payment-status`; `GET /api/risk-score` → `/api/v2/risk-score` |
| **Input matrix** | Nominal (by ref; by invoice); boundary (not found, missing param, empty DB result); error paths (400, 404); known data quirks (MED risk_flag spelled "MED" in DB but "MEDIUM" in band label); all seeded statuses (PENDING, REVIEW, HOLD, ESCALATED, RESOLVED) |
| **Golden capture** | Captured from legacy endpoints before any modification; fixtures committed to `tests/golden/payment-status/` and `tests/golden/risk-score/` |
| **Comparison** | HTTP status code; all response fields by name; `amt_cents` numeric precision; date strings verbatim; `retcode`; `BAND` / `SCORE` values |
| **Intended differences** | Field name normalization: legacy mixes camelCase and SCREAMING_SNAKE (e.g., `vend_ctry`, `PO_NUM`); v2 response uses consistent camelCase with a documented mapping. Excluded from diff comparison. |
| **Exit criteria** | ≥ 20 cases executed; 0 unexplained diffs; legacy routes kept mounted as deprecated until epic closes |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Activate `public/mdl-3.css` (already committed) rather than authoring new styles | Generate CSS from design tokens per-run | `mdl-3.css` is reviewable and renders identically every run; generated CSS drifts on each attempt (empirically observed in prior runs) |
| Mount MCP template (`mcp-endpoint.js`) directly; wire vault identity | Build a REST-only v2 API without an agent layer | Agent channel is in scope per epic description; template is already authored and approved by the agent-enablement skill |
| Keep legacy endpoints mounted as deprecated during the epic | Remove them at v2 go-live | ERP batch and downstream teams consume the legacy API; no joint release planned; side-by-side avoids a hard dependency |
| Field-name normalization documented as intended difference, excluded from equivalence comparison | Preserve legacy mixed-case field names in v2 | Mixed-case names are a known tech debt; normalizing now avoids it compounding into the agent layer |

## Open items

*(none)*

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Recorded on** | KAN-47 |
| **Approving comment** | "approved - plan and design look good. Proceed with the subtasks." |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-13 |
| **Reviewed** | KAN-47 BEFORE / KAN-47 AFTER frames, https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian-Demo?node-id=138-1146 |
