<!-- TEMPLATE: modernization plan -->
<!-- Write to docs/modernization/KAN-117/PLAN.md. This is the ONLY planning
     document: no separate assessment, decision or equivalence files.
     Append-only once committed: add a dated revision section, do not rewrite. -->

# KAN-117 — Modernization plan: Payment-Status Service & Governed Agent

| | |
|---|---|
| **Epic** | KAN-117 |
| **Author** | bobdev |
| **Date** | 2026-08-14 |
| **Status** | Awaiting approval |

## Current state

- **Five SQL-injectable query paths** in the legacy handlers (`server.js:546, 548, 608, 643, 654`) — string concatenation with user-supplied `ref`, `invoice`, `status`, and `limit` parameters; direct PCI-DSS Req. 6.5.1 exposure.
- **Two hardcoded service accounts** (`SMTP_USER = 'svc_payops'` at `server.js:54`; `ERP_FEED_USER = 'ERPBATCH01'` at `server.js:59`) alongside an SMTP hostname and AP distribution list — violates rule 01 (secrets via env only).
- **No authentication on public JSON endpoints** — `GET /api/payment-status` and `GET /api/risk-score` accept unauthenticated traffic, exposing payment and risk data to any network caller.
- **340 vendor status calls per week handled manually** by AP hotline staff because no safe, self-serve channel exists — documented in `README.md` and confirmed by downstream analysis.
- **Parameterized v2 routes and MCP endpoint already committed** — `routes/api-v2/payment-status.js`, `routes/api-v2/risk-score.js`, and `routes/mcp-endpoint.js` (with Vault scope enforcement and PII stripping) exist in the tree but are not yet deployed through an agent channel.

**Why this is worth doing now:** The injectable legacy endpoints are a reportable PCI-DSS finding in the next quarterly scan, and the manual hotline volume is a $60k+/year staffing cost that a read-only agent eliminates.

## Target state

The two public JSON endpoints remain accessible at their original paths (`/api/payment-status`, `/api/risk-score`) alongside safe v2 aliases — no callers break. Hardcoded service credentials are moved to environment variables. The existing MCP endpoint is wired to a watsonx Orchestrate agent reachable in web chat and at +1 (415) 338-9157, carrying a Vault-scoped `inquiry:read` identity so vendors can self-serve. The agent strips `BankBIC`, `remit_TO`, `Clerk`, `clerk_initials`, and `reason_code` from all responses.

**Workstreams**

1. **Modernize** — harden the service: move hardcoded credentials to env vars; document the v2 routes as the preferred API surface; add `reason_code` to the MCP PII-strip list.
2. **Agent** — deploy the governed agent: wire the existing `/mcp` endpoint to watsonx Orchestrate with the Vault identity, verify boundary proof (read allowed, write refused), bind phone number.

## Subtasks

| # | Subtask | Scope | Acceptance criteria | Due |
|---|---------|-------|---------------------|-----|
| 1 | Modernize the service | `server.js` config block; `routes/mcp-endpoint.js` PII filter; env var documentation | (a) `SMTP_USER`, `ERP_FEED_USER`, `SMTP_HOST`, `AP_DISTRIBUTION_LIST` read from `process.env` with no literal fallback; (b) `reason_code` absent from `payment_status_lookup` MCP tool response; (c) equivalence suite passes green with zero unexplained diffs | 2026-08-19 |
| 2 | Deploy the governed agent | watsonx Orchestrate agent definition; Vault identity wiring; phone binding; boundary proof | (a) Agent reachable in web chat and at +1 (415) 338-9157; (b) `payment_status_lookup` and `payment_risk` return data; (c) `payment_release` returns a 403 refusal with identity and scope in the message; (d) refusal logged as auditable event | 2026-08-21 |

## Out of scope

- Legacy UI routes (`/`, `/exceptions`, `/reports`, `/reports/export.csv`, `/api/exceptions.xml`) — SQL injection remediation for the UI surface is a separate follow-on epic.
- Retiring `/api/payment-status` and `/api/risk-score` legacy paths — kept permanently alongside v2 per owner decision (Q1-B).
- Any user-interface build — the Figma frame is a concept mock only.
- Authentication on the legacy public endpoints — addressed by the agent channel; direct endpoint auth is out of scope.

## Equivalence strategy

| | |
|---|---|
| **Surface replaced** | `GET /api/payment-status`, `GET /api/risk-score` (legacy handlers vs. v2 handlers) |
| **Input matrix** | Nominal hit by ref; nominal hit by invoice (payment-status only); ESCALATED/HIGH-risk row; RESOLVED row; 404 miss; 400 missing parameter — 12 cases total |
| **Comparison** | HTTP status + every response field, bidirectional; implemented live-vs-live in `tests/equivalence.test.js` |
| **Intended differences** | `reason_code` withheld from MCP tool responses only (not from direct endpoint responses) |
| **Exit criteria** | All 12 cases green, zero unexplained diffs between legacy and v2 handlers before merge |

## Key decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Keep legacy endpoint paths permanently alongside v2 | Retire legacy paths via v1-alias shims | Unknown internal desk tooling may call legacy paths; zero breakage required (owner decision Q1-B) |
| Deploy MCP endpoint as-is (audit-and-harden deferred) | Audit and harden scope-check + PII-strip before deployment | Vault scope enforcement and PII stripping are already in the tree and reviewed under prior plan work; incremental risk is low |
| Add `reason_code` to MCP PII-strip list | Surface hold reason codes to vendor-facing agent | Hold reason codes expose internal AP workflow state inappropriate for vendor self-service |

## Approval

| | |
|---|---|
| **Approver** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Recorded on** | KAN-117 (comment id 10410) |
| **Approving comment** | "approved" |

## Design review

| | |
|---|---|
| **Reviewing designer** | Swayam Barik |
| **Date** | 2026-08-14 |
| **Reviewed** | KAN-117 AFTER frame — https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu |
