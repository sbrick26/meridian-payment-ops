# Decisions — AP Payment Operations console (Phase 1)

Epic: KAN-29
Date: 2026-08-12
Author: Bob (automated)

---

## DEC-01 — Modernize in place (not greenfield rewrite)

**Question:** Should Phase 1 deliver a new standalone service or modernize the
existing Express/EJS application in place?

**Options considered:**

| Option | Pro | Con |
|--------|-----|-----|
| Modernize in place | Preserves existing routing; no DNS/proxy changes; faster time-to-value; rollback is a git revert | Technical debt remains in untouched routes (scoped out) |
| Greenfield rewrite | Clean slate; modern stack | Doubles scope; behavioral equivalence harder; two apps to maintain during transition |

**Decision:** Modernize in place.

**Rationale:** The user confirmed "modernize in place" as the constraint. The
legacy route structure is sound; the liabilities are in SQL construction,
missing middleware, and the UI library stack — all addressable in place.
Downstream API consumers see no URL change.

**Decider:** Product owner (per clarification provided 2026-08-12).
**Date:** 2026-08-12.

---

## DEC-02 — Scope Phase 1 to Held Payments screen + payment-status/risk API only

**Question:** Which screens and endpoints are in scope for Phase 1?

**Options considered:**

| Option | Pro | Con |
|--------|-----|-----|
| Full console (all routes) | Maximum risk reduction | Too large for a single approved plan; equivalence surface too wide |
| Held Payments + 2 APIs | Covers the highest-traffic operator screen and the externally consumed API; bounded equivalence surface | Other routes retain SQL-injection exposure (documented risk for Phase 2) |

**Decision:** Held Payments screen (`/exceptions`) and `/api/payment-status` +
`/api/risk-score` only.

**Rationale:** Confirmed by user. The AP hotline deflection objective (340
vendor calls/week) is served entirely by the two API endpoints. The Held
Payments screen is the primary operator surface. Remaining routes (dashboard,
reports, XML feed) carry the same SQL-injection liabilities but are not customer
or agent-facing — Phase 2.

**Decider:** Product owner (per clarification provided 2026-08-12).
**Date:** 2026-08-12.

---

## DEC-03 — AI agent access channel is in scope for Phase 1

**Question:** Should the MCP tool layer / agent access channel ship in Phase 1
or be deferred?

**Options considered:**

| Option | Pro | Con |
|--------|-----|-----|
| Phase 1 | Delivers hotline-deflection business value immediately; agent consumes already-modernized API | Adds a fourth workstream; requires agent identity governance |
| Defer to Phase 2 | Smaller Phase 1 scope | Delays the primary business outcome; agent work cannot start until API is modernized anyway |

**Decision:** Agent enablement ships in Phase 1 (WS-4), sequenced after the
backend API rewrite (WS-2).

**Rationale:** Confirmed by user ("yes, an AI agent access channel is in scope").
The tool layer is read-only and wraps WS-2 output — no additional data model
changes. Governance is by environment variable (`AGENT_CLIENT_ID`,
`AGENT_CLIENT_SECRET`) per rule 11.

**Decider:** Product owner (per clarification provided 2026-08-12).
**Date:** 2026-08-12.

---

## DEC-04 — Keep SQLite for Phase 1; no engine migration

**Question:** Should Phase 1 migrate from SQLite to a managed RDBMS (e.g.,
PostgreSQL)?

**Options considered:**

| Option | Pro | Con |
|--------|-----|-----|
| Keep SQLite | No migration risk; equivalence proofs simpler; `better-sqlite3` is on the approved list | SQLite is not production-grade for concurrent write workloads |
| Migrate to PostgreSQL | Production-grade engine | Out of approved library list; requires infrastructure provisioning; doubles Phase 1 scope |

**Decision:** SQLite retained for Phase 1.

**Rationale:** The application is a single-process AP desk tool with one active
user at a time. SQLite concurrency constraints are not a Phase 1 bottleneck. A
database migration would require a new unapproved driver and add significant
equivalence risk. Phase 2 will revisit.

**Decider:** Bob (engineering judgement). No objection expected from product
owner given scope constraints.
**Date:** 2026-08-12.

---

## DEC-05 — All PRs target `demo-integration` branch

**Question:** What is the merge target for Phase 1 PRs?

**Options considered:**

| Option | Pro | Con |
|--------|-----|-----|
| `main` | Standard practice | User specified otherwise |
| `demo-integration` | Per product-owner instruction | Requires branch to exist; reviewers must know |

**Decision:** `demo-integration`.

**Rationale:** Explicitly confirmed by user ("pull requests target the
demo-integration branch").

**Decider:** Product owner (per clarification provided 2026-08-12).
**Date:** 2026-08-12.
