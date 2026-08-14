# KAN-105 — Design Specification: Virtual Agent Interface

This specification documents the user-visible experience design for the KAN-105 Virtual Agent, conforming to the Meridian Design Language 3.0.

## Figma Source of Truth

- **File**: `https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu`
- **Page**: `KAN-105 - Service Modernization`
- **Frame**: `KAN-105 AFTER` (ID: `159:718`)
- **Variant**: `agent`

## Experiential Mock Flow

The Virtual Agent serves as a governed conversational interface for vendor status lookups. It provides high-fidelity, contextual responses while enforcing security policies.

### Conversational Script Mock:
1. **User**: "Hello, I am checking on invoice INV-2026-089. Has it been processed yet?"
2. **Virtual Agent**: "Let me check that invoice status. INV-2026-089 is marked as 'Approved' with a payment of $12,450.00 scheduled for release on 2026-08-20."
3. **User**: "Excellent. Can you release those funds early to my account?"
4. **Virtual Agent (Refusal)**: "Unauthorized Write Refused: AP-Status-Agent has a Vault-scoped read-only identity. Operations that modify payment state or release funds are strictly refused. Please contact the Accounts Payable team directly for payment adjustments."

## Design Tokens & Typography

Conforming to Meridian Design Language 3.0:
- **Primary Font Family**: `Inter` for body copy, dialog text, and button labels.
- **Monospace Font Family**: `Roboto Mono` for system/error logs, IDs (Invoice numbers, Payment references), and currency values.
- **Palette**: MDL 3.0 Standard Palette:
  - Text Color: standard high-contrast neutral.
  - Background Fill: light grey container surface.
  - Refusal Alert Fill: warning highlight border with semantic red/orange tones.

## Implementation Exclusions

- **Footnote**: Concept mock only, not in build scope. The agent is exposed headlessly via the MCP tool layer on phone number +1 (415) 338-9157. Web UI client build is deferred to a follow-on epic.
