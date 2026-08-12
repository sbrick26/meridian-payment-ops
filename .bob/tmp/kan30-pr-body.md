## [KAN-30] Modernization plan: AP Payment Operations console Phase 1

**Jira epic:** KAN-30
**Plan document:** `docs/modernization/KAN-30/PLAN.md`

---

### Target state

The console modernizes in-place on the existing Node/Express/EJS stack. The Held Payments screen is restyled to Meridian Design Language 3.0. The `GET /api/payment-status` and `GET /api/risk-score` endpoints are replaced with a modern, parameterized, authenticated service. An AI agent channel (chat/voice) is wired to the modernized API under scoped read-only identity to deflect the ~340 vendor status calls per week currently handled by the AP hotline.

---

### Proposed subtasks

| # | Subtask | Due |
|---|---------|-----|
| 1 | Backend: modernize payment-status + risk APIs (parameterized queries, env config, equivalence suite) | 2026-08-18 |
| 2 | Frontend: Held Payments screen redesign to Meridian DL 3.0 | 2026-08-20 |
| 3 | Agent enablement: MCP/OpenAPI spec, watsonx Orchestrate agent, scoped identity | 2026-08-22 |

---

### Equivalence strategy (summary)

Both API endpoints (`/api/payment-status`, `/api/risk-score`) will have golden fixtures captured from the live legacy implementation before any code change. The equivalence suite compares status codes, every JSON field, monetary values to the cent, and date string formatting. Field names will be normalized to camelCase (authorized change, documented in PLAN.md). ≥20 input cases; 0 unexplained diffs required before the backend PR merges.

---

### Key decisions

- **Modernize in-place** — no stack migration; minimizes blast radius and simplifies behavioral equivalence.
- **Legacy endpoints kept mounted (deprecated)** — three downstream teams depend on current field names; parallel-run window required.
- **Agent access scoped read-only** — minimum-scope per rule 11; AP hotline use case requires only status inquiry.

---

### Analysis grounding

- Analyzed 11 routes, 2 JSON APIs, 1 XML endpoint in `server.js`
- Inventoried 5 EJS views + 2 partials in `views/`
- Audited 3 direct dependencies and 2 vendored assets in `public/vendor/`
- Data model: 4 tables (exceptions, vendors, ap_clerks, notes), 10 hold reason codes, 5 payment statuses, 3 risk bands
- Zero test files found in repository
