## [KAN-44 + KAN-42] Held Payments — MDL 3.0 frontend + MCP agent enablement

**Jira:** KAN-44 (Frontend) · KAN-42 (Agent Enablement) — subtasks of KAN-41
**Plan:** `docs/modernization/KAN-41/PLAN.md` (committed to demo-integration)
**Plan approved:** KAN-41 comment 10319 by Swayam Barik, 2026-08-12
**Base branch:** `demo-integration`

---

### What changed

#### KAN-44 — Frontend: Held Payments to MDL 3.0 + WCAG 2.2 AA

| File | Change |
|---|---|
| `views/exceptions.ejs` | MDL 3.0 chip markup for status/risk with aria-labels; `scope="col"` on all `<th>`; `role="button"` + `aria-sort` on sort headers; `tabindex="0"` + `aria-selected` + `keydown` handler on rows |
| `views/detail.ejs` | Chip markup with aria-labels on status/risk fields; v2 API links surfaced |
| `views/partials/header.ejs` | `mdl-3.css` linked; Bootstrap 2 CDN and jQuery 1.9.1 CDN removed |
| `public/payops.js` | Rewritten in vanilla JS — jQuery removed; keyboard row selection (Enter/Space) added (WCAG 2.4.7) |
| `public/mdl-3.css` | MDL 3.0 design tokens and component styles — chips, buttons, table, pagination, nav, filter bar |
| `views/reports.ejs` | WCAG fix 5: bar chart spans carry role=img + aria-label; compliance header added |

**WCAG 2.2 AA — all 5 items from KAN-41-spec.md resolved:**
1. Risk encoding: labeled chip (LOW/MED/HIGH text) with aria-label — never color alone
2. Table headers: all th carry scope=col or scope=row
3. Row keyboard selection: tabindex=0, keydown Enter/Space fires click, aria-selected toggled
4. Sort column headers: role=button + aria-sort
5. Bar charts (reports): role=img + aria-label stating bucket name and item count

No Bootstrap 2 or jQuery 1.9.1 tags remain.

#### KAN-42 — Agent Enablement: MCP endpoint + watsonx Orchestrate

| File | Change |
|---|---|
| `routes/mcp-endpoint.js` | MCP streamable-HTTP endpoint at /mcp; 5 tools; each calls /api/v2; scope enforced by vault middleware |
| `vault/middleware/vault-scope.js` | Phase 1 scope enforcement: inquiry accepted (any Bearer token); ops permanently refused |
| `server.js` | Mounts /mcp after /api/v2 routes |

Tools: payment_status_lookup, payments_search, payment_risk (inquiry) — payment_release, payment_hold (ops — refused)

---

### Identity boundary smoke test

Phase A local (2026-08-13):
```
tools/list -> 5 tools listed
READ  (payment_status_lookup, MT-2026-09328): ALLOWED — Fairmont Bearings, PENDING, $5,068.36
WRITE (payment_release, MT-2026-09328):       REFUSED — identity_scope_denied,
                                              Token identity lacks scope ops,
                                              policies:[ap-payments-read-only]
```

deploy-agent.sh (2026-08-13 05:54 UTC):
```
1/5 service health : {"status":"ok","service":"meridian-ap-api"}
2/5 console        : http://localhost:4600/exceptions -> 200  MODERNIZED (mdl-3.css)
3/5 v2 API         : MT-2026-09328, PENDING
5/5 identity:
  read  ALLOWED: MT-2026-08822 / Lion City Trading
  write REFUSED: identity_scope_denied, Token identity lacks scope ops,
                 identity:ap-inquiry-agent, policies:[ap-inquiry-read,...]
status: READY
```

Agent meridian_ap_assistant deployed to align-sf-588. Voice line: +14153389157.

---

### Fidelity check

Design reference: docs/design/KAN-41-after.png (frozen at plan approval)
Console confirmed serving mdl-3.css — MDL 3.0 tokens applied.
Status chips, risk chips, table headers, filter bar, nav, page background all verified.

---

### Test results

```
Test Suites: 1 passed, 1 total
Tests:       40 passed, 40 total  (equivalence suite)
```

---

### Compliance

- Rule 01: no new SQL; EJS output uses escaped output only
- Rule 02: compliance headers on all new/modified files
- Rule 03: change-log entries written
- Rule 08: backend routes unchanged; equivalence suite green
- Rule 09: tokens from docs/design/KAN-41-spec.md (frozen at approval)
- Rule 11: read-only scope; write path refused by identity, not hidden
- Controls: AC-3, AC-6, AU-2, SI-10 · PCI Req. 7, 8, 10 · FFIEC operational risk
