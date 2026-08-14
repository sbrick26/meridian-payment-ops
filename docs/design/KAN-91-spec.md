# KAN-91: Design Specification — Payment Status Agent

**Figma Link:** https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu?node-id=158:266

**Design Frame:** "KAN-91 AFTER" (node ID 158:266 on page "KAN-91 - Service Modernization")

---

## Agent Concept

A read-only watsonx Orchestrate agent that answers vendor payment inquiries over phone (+1 (415) 338-9157). The agent calls two modernized v2 endpoints (`/api/v2/payment-status` and `/api/v2/risk-score`) with a Vault-scoped identity that permits reads but refuses writes.

### Identity and Authorization

- **Agent Name:** Payment Status Assistant
- **Channel:** Phone (+1 (415) 338-9157)
- **Vault Scope:** Read-only, constrained to GET operations
- **Credentials:** Issued by Vault, short-lived, revocable independently
- **Boundary Enforcement:** Refused writes return exact scope denial; agent relays refusal as issued (rule 11c)

---

## User Interactions (Concept Mock)

### Exchange 1: Status Lookup by Reference
```
User: "What's the status of my payment? Reference is MT-2026-08847."

Agent: "I found your payment. Invoice INV-008847 for €15,200 to Acme Supplies. 
Status: In Transit. Expected payment: 2026-08-28. Your payment is scheduled and on track."
```
- **Endpoint called:** `GET /api/v2/payment-status?ref=MT-2026-08847`
- **Data returned:** Status, amount, vendor, due date, currency

### Exchange 2: Risk and Priority
```
User: "Is there any risk or reason for delay?"

Agent: "No risk flag on this payment. It's processing normally. Risk score: Green (low priority). No exceptions noted."
```
- **Endpoint called:** `GET /api/v2/risk-score?ref=MT-2026-08847`
- **Data returned:** Risk flag, priority color, no exceptions

### Exchange 3: Write Refusal (Boundary Proof)
```
User: "Can you release this payment early?"

Agent: "I don't have permission to modify payments. Only read-only access to status and history. 
Contact the AP desk at ap-desk@meridiancorp.example for holds, changes, or escalations."
```
- **Operation attempted:** Implied `POST /exceptions/hold` (not in v2 scope)
- **Result:** Authorization layer refuses; agent relays exact denial per rule 11c

---

## Integration Points

### Endpoints Called by Agent

| Endpoint | Method | Parameters | Response | Scope |
|----------|--------|-----------|----------|-------|
| `/api/v2/payment-status` | GET | `ref` or `invoice` | Status, amount, vendor, dates, currency, risk_flag | Authorized (read) |
| `/api/v2/risk-score` | GET | `ref` | Risk flag, priority, exceptions | Authorized (read) |
| (Any POST/PUT/DELETE) | Any | Any | N/A | Refused (write) |

### Downstream Systems (Unchanged in This Epic)

- **ERP Batch Bridge (ERPBATCH01):** Continues polling `/api/exceptions.xml` (legacy v1, out of scope)
- **AP Hotline Desk:** Gains self-serve alternative via phone; legacy `/api/payment-status` remains active for 90 days
- **Vendor Enquiry Desk:** Risk-score lookup now available in agent; legacy `/api/risk-score` remains active for 90 days

---

## Design System Compliance

- **Tokens:** Meridian Design Language 3.0 applied
- **Accessibility:** WCAG 2.2 AA (voice UI assumes platform compliance; text output tested for clarity)
- **Tone:** Professional, clear escalation path, no jargon

---

## Notes

- **Concept mock only.** Not in the build scope for this epic; serves as approval evidence for what the agent will do.
- **Figma rendering:** Generated 2026-08-13, rendered on page "KAN-91 - Service Modernization" as frame "KAN-91 AFTER".
- **Proof of boundary:** Exchange 3 demonstrates that write operations are refused with exact scope denial — the control is the authorization layer, not agent reasoning (rule 11b).
