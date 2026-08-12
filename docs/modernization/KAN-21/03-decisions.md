# KAN-21 — Decision Record
## AP Payment Operations Console — Phase 1

**Created:** 2026-08-12  
**Author:** Bob (AI modernization agent)  

---

## Decision 001 — Scope: payment-status/risk API first, XML feed deferred

**Date:** 2026-08-12  
**Decider:** Engineering (Swayam Barik), with user-provided clarification

**Question:** Which endpoint surface should Phase 1 modernize?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| All API endpoints (JSON + XML) | Reduces total injection surface faster | ERP batch bridge has no change window; XML feed retirement requires joint release coordination; increases scope risk |
| JSON APIs only (`/api/payment-status`, `/api/risk-score`) | Directly serves the AI deflection use case; consumed by three downstream teams ready to migrate; bounded scope | Leaves XML feed untouched (still has SQL injection) |
| Full application rewrite | Eliminates all technical debt at once | Disproportionate to Phase 1 objective; no behavioral baseline; high risk to SOX-controlled production path |

**Decision:** JSON APIs only. XML feed deferred to a future phase.

**Rationale:** The clarifying answers confirmed scope priority is the Held
Payments screen and the payment-status/risk API. The XML feed is polled by the
ERP batch bridge on a fixed schedule and cannot change without a coordinated
release with the ERP team. The JSON APIs are the integration surface for the AI
agent channel, which is the primary business driver. Deferring the XML feed
eliminates cross-team coordination risk from Phase 1.

---

## Decision 002 — Modernize in place; no new framework

**Date:** 2026-08-12  
**Decider:** Engineering (Swayam Barik), with user-provided clarification

**Question:** Should Phase 1 replace the Express/EJS/SQLite stack, or
modernize in place?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Modernize in place (Express + better-sqlite3 + EJS) | No stack migration risk; all approved libraries already present; behavioral equivalence is straightforward to demonstrate; single deployment artifact | Retains EJS templating (not a component model); retains monolithic server.js structure |
| Introduce TypeScript + separate service | Stronger type safety for API | New dependency, build step, deployment config; out-of-scope for Phase 1 timeline |
| Replace SQLite with PostgreSQL | Production-grade persistence | Significant migration risk; data migration required; no approved Postgres driver in `04-approved-libraries.md` |

**Decision:** Modernize in place. Express + better-sqlite3 + EJS remain the
stack. Approved libraries (`helmet`, `express-validator`, `dotenv`, `pino`)
are added.

**Rationale:** The user explicitly confirmed "modernize in place in this
repository, no new stack." All four additions are on the approved library list
in `.bob/rules/04-approved-libraries.md`. The risk of stack migration outweighs
the benefits for a Phase 1 security-hardening and design-refresh scope.

---

## Decision 003 — Agent channel is in scope for Phase 1

**Date:** 2026-08-12  
**Decider:** Engineering (Swayam Barik), with user-provided clarification

**Question:** Should the AI/agent access channel be included in Phase 1, or
deferred?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Include agent channel (WS-4) | Directly addresses INC-0042 (340 calls/week); delivers business value alongside the API hardening | Adds WS-4 scope; requires IAM provisioning for scoped identity |
| Defer agent channel | Simpler Phase 1 | INC-0042 remains open; API hardening has less visible business impact |

**Decision:** Include agent channel (WS-4) in Phase 1, as subtask KAN-21-S5,
sequenced after WS-1 (API hardening, KAN-21-S2).

**Rationale:** The user explicitly confirmed the agent channel is in scope.
Governing rule 11 (`11-assistant-access-governance.md`) requires scoped
identity, minimum-privilege, and auditable denials — all of which are easier to
implement correctly when the underlying API is already hardened (WS-1). Write
scope (resolving exceptions) is explicitly not granted to the agent in Phase 1.

---

## Decision 004 — Equivalence strategy: golden capture before any code change

**Date:** 2026-08-12  
**Decider:** Engineering governance (rule 08-behavioral-equivalence.md)

**Question:** How do we prove the modernized API behaves identically to the
legacy implementation?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Golden capture + automated equivalence suite (field-by-field) | Satisfies rule 08 exactly; gives a CI-runnable regression baseline | Requires running legacy app before any modification |
| Manual comparison (spot checks) | Faster | Not auditable; does not satisfy rule 08; not repeatable in CI |
| Diff of SQL output logs | Machine-readable | Does not cover HTTP status codes, response shape, or error bodies |

**Decision:** Golden capture first (KAN-21-S1), then automated equivalence
suite in `tests/equivalence.test.js` comparing field-by-field against fixtures
in `tests/golden/`. Suite must fail against an empty implementation and must
report 0 diffs before KAN-21-S2 PR merges.

**Rationale:** Rule 08 requires this approach explicitly. Captures taken after
modification are worthless. The suite must run in CI.

---

## Decision 005 — Target branch for pull requests: demo-integration

**Date:** 2026-08-12  
**Decider:** Engineering (Swayam Barik), with user-provided clarification

**Question:** Which branch do Phase 1 PRs target?

**Decision:** `demo-integration` branch, as confirmed by the user.

**Rationale:** User explicitly stated "target the demo integration branch for
pull requests." All feature branches for KAN-21 will be created from
`demo-integration` and PRs will target `demo-integration`.

---

## Decision 006 — Legacy endpoints remain mounted through Phase 1

**Date:** 2026-08-12  
**Decider:** Engineering

**Question:** Should legacy endpoint handlers be removed once the modern
implementation ships?

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Remove legacy on shipping modern | Cleaner codebase | Breaks downstream teams before they confirm readiness; violates rule 08 exit criteria |
| Keep legacy mounted, add `X-Deprecated` response header | No downstream disruption; equivalence suite remains runnable against both | Slightly more code in server.js |

**Decision:** Legacy handlers remain mounted through Phase 1. Retirement is
a separate change, in a future phase, after downstream teams confirm readiness
and the equivalence suite has been green for ≥ 1 sprint.

**Rationale:** Rule 08 requires the equivalence suite to be green and the
result recorded in the change log before legacy retirement. Downstream consumers
of these APIs were not given a migration timeline as part of Phase 1 scope.
