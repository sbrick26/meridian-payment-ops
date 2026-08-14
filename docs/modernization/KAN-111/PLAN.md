# KAN-111 — Modernization plan: Payment-Status Service and Governed Agent

| | |
|---|---|
| **Epic** | KAN-111 |
| **Author** | payments-platform-team |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- **No tests anywhere** — the service ships with zero test files; behavioral equivalence has never been machine-checked (`server.js`, `seed.js`).
- **SQL injection on both public API endpoints** — `/api/payment-status` and `/api/risk-score` build WHERE clauses by string concatenation on user-supplied query params (`server.js` lines 535–537, 597); PCI-DSS Req. 6.5.1 violation.
- **Hardcoded secrets in two variables** — `SMTP_PASS` and `ERP_FEED_KEY` are literal strings (`server.js` lines 44, 49); variables consumed by the new v2 routes (`APPROVAL_LIMIT_CENTS`, `AS_OF_DATE`) are also static constants with no environment override.
- **Inconsistent response contracts** — `/api/payment-status` returns camelCase/snake_case mixed keys; `/api/risk-score` returns ALLCAPS keys with a bare `retcode` field; no schema documentation exists (`server.js` lines 550–570, 600–615).
- **340 vendor calls per week** absorbed by the AP hotline because there is no safe, self-serve channel — the service is localhost-only with no auth layer.

**Why this is worth doing now:** SQL injection on a production payment-lookup endpoint is an open PCI Req. 6.5.1 finding; the parameterized-query fix is the fastest path to closing it, and the governed agent eliminates the hotline volume that justifies the risk exposure.

## Target state

Two new routes — `GET /api/v2/payment-status` and `GET /api/v2/risk-score` — replace the injection-vulnerable handlers with parameterized queries and environment-driven config, while legacy routes remain as deprecated aliases to preserve the ERP feed, detail-view UI links, and any undocumented consumer. A governed watsonx Orchestrate agent, scoped to a read-only Vault identity, exposes the v2 routes via MCP over web chat and voice at +1 (415) 338-9157; it surfaces payment status in full and vendor risk band only (no raw score or TYPE label).

**Workstreams**

1. **Modernize service** — parameterized v2 routes, environment config for route vars, parity suite, legacy aliases.
2. **Build governed agent** — MCP endpoint, Vault-scoped identity, watsonx Orchestrate agent, phone binding, boundary proof.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize payment-status service | Add `GET /api/v2/payment-status` and `GET /api/v2/risk-score` to `server.js` with parameterized queries; move `APPROVAL_LIMIT_CENTS` and `AS_OF_DATE` to `process.env`; mount legacy routes as deprecated aliases; write parity suite | Parity suite green (nominal + missing-param + not-found paths for both endpoints, zero unexplained diffs); legacy `/api/payment-status?ref=INV-001` returns HTTP 200 with same body as before | 2026-08-19 |
| 2 | Build governed agent | Add `vault/middleware/vault-scope.js`, `routes/mcp-endpoint.js`, `agent.yaml`, phone binding; deploy via `ops_deploy_agent`; demonstrate read allowed, write refused | `ops_deploy_agent` reports DONE; authorized GET returns 200; unauthorized POST/PUT returns 403 with identity and scope in the refusal body; agent reachable at +1 (415) 338-9157 | 2026-08-21 |

## Out of scope

- SMTP/ERP hardcoded secrets (`SMTP_PASS`, `ERP_FEED_KEY`) — follow-on ticket; only route-consumed vars are migrated here.
- Legacy UI routes (dashboard, exceptions, reports) — documented follow-on per epic description.
- `/api/exceptions.xml` ERP feed — no change; it is not one of the two replaced endpoints.
- Any user-interface build — explicitly excluded by the epic; concept mock in Figma is the only design artifact.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status` and `GET /api/risk-score` |
| **Input matrix** | Nominal (valid ref), nominal (valid invoice), missing-param (400), not-found (404) |
| **Comparison** | HTTP status code, JSON body field-for-field (v2 canonical names mapped to legacy names) |
| **Intended differences** | v2 uses consistent camelCase keys and `process.env` config vars; these differences are excluded from comparison by key alias mapping in the suite |
| **Exit criteria** | All input classes pass for both endpoints; zero unexplained diffs; suite runs in CI on every PR |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Mount v2 alongside legacy; keep legacy as deprecated aliases | Replace legacy routes in-place | Zero disruption to ERP feed, detail-view UI links, and undocumented consumers; approved by requester |
| Migrate only route-consumed env vars in this epic | Migrate all hardcoded secrets in one pass | Narrower change reduces blast radius; SMTP/ERP secrets require separate change-management approval |
| Expose risk band only to vendor-facing callers; suppress raw score and TYPE | Surface full risk data | Raw score and TYPE are internal classification data not safe to relay to vendors; approved by requester |

## Open items

_(none — all questions resolved before plan was written)_

## Approval

| | |
|---|---|
| **Approver** | (pending) |
| **Date** | (pending) |
| **Recorded on** | KAN-111 |
| **Approving comment** | (pending) |

## Design review

| | |
|---|---|
| **Reviewing designer** | (pending) |
| **Date** | (pending) |
| **Reviewed** | KAN-111 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
