# KAN-32 — Design specification (frozen 2026-08-12)

> **Frozen from:** Meridian Design Language 3.0 — Figma file `saGgyANlhq6lW8zEJd1RWu`, page "Meridian Design Language 3.0", frame "MDL 3.0 — Foundations & Components".
> **Implementation must use these exact values.** Do not re-derive from Figma or by eye.

---

## Color tokens

| Token name | Hex | Usage |
|---|---|---|
| `--color-action` | `#1f5fd6` | Primary button fill, links, focus ring |
| `--color-action-pressed` | `#17489f` | Primary button pressed/hover |
| `--color-navy-900` | `#101827` | Nav bar background |
| `--color-charcoal-800` | `#1e2532` | Secondary dark surface |
| `--color-surface` | `#ffffff` | Card and table row background |
| `--color-surface-subdued` | `#edeff3` | Table header row background |
| `--color-canvas` | `#f7f8fa` | Page canvas background |
| `--color-border` | `#d6dae2` | Table row dividers, card borders |
| `--color-border-strong` | `#a7b0bf` | Emphasis borders |
| `--color-text-primary` | `#10151f` | All primary body text, table cell values |
| `--color-text-secondary` | `#5a6577` | Labels, meta text, table column headers |
| `--color-text-inverse` | `#ffffff` | Text on dark/action backgrounds |
| `--color-success` | `#1e7a52` | PENDING / REVIEW chip text + dot; success states |
| `--color-success-bg` | `#e6f1eb` | PENDING / REVIEW chip background |
| `--color-warning` | `#a66a0a` | HOLD chip text + dot; warning states |
| `--color-warning-bg` | `#f6eedf` | HOLD chip background |
| `--color-critical` | `#b3261e` | ESCALATED chip text + dot; error states; HIGH risk |
| `--color-critical-bg` | `#f7e7e5` | ESCALATED chip background; HIGH-risk row tint |
| `--color-info` | `#2a6e9e` | REVIEW chip text + dot; informational states |
| `--color-info-bg` | `#e5eef5` | REVIEW chip background |

---

## Typography

All body text and labels: **Inter**. All identifiers, amounts, references, timestamps: **Roboto Mono**.
(Both are Figma-bundled fonts. Do not use IBM Plex or system fonts.)

| Token | Font | Weight | Size | Line height | Usage |
|---|---|---|---|---|---|
| `type-display` | Inter | Semi Bold (600) | 40 px | 54 px | Page-level display headings |
| `type-heading-l` | Inter | Semi Bold (600) | 28 px | 38 px | Section headings |
| `type-heading-m` | Inter | Semi Bold (600) | 20 px | 27 px | Card titles, screen title |
| `type-heading-s` | Inter | Semi Bold (600) | 16 px | 26 px | Sub-section headings, card titles |
| `type-body` | Inter | Regular (400) | 14 px | 26 px | Body text, form help text |
| `type-caption` | Inter | Regular (400) | 12 px | 26 px | Secondary labels, chip labels, filter labels |
| `type-mono` | Roboto Mono | Regular (400) | 13 px | 26 px | Payment refs, amounts, IDs, timestamps |
| `type-mono-medium` | Roboto Mono | Medium (500) | 13 px | 26 px | Primary ref cell, metric values |
| `type-table-header` | Roboto Mono | Medium (500) | 11 px | auto | Table column headers (ALL CAPS) |

---

## Spacing scale (4 px grid)

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4 px | Icon gap, inline tight spacing |
| `space-2` | 8 px | Chip internal padding (h), tight component gaps |
| `space-3` | 12 px | Chip internal padding (v), row cell padding |
| `space-4` | 16 px | Card internal padding, button padding |
| `space-5` | 24 px | Section gap, card-to-card gap |
| `space-6` | 32 px | Page horizontal padding |
| `space-7` | 48 px | Major section separation |

---

## Border radius

| Context | Radius |
|---|---|
| Button, Input, Card, Table | 4 px |
| Chip (status badge) | 12 px (fully rounded) |

---

## Component specifications

### Status chips

Apply to the `status` column in the Held Payments table. Each chip has a 6 px dot + label.

| Status value | Chip background | Dot + text color | Label text |
|---|---|---|---|
| `PENDING` | `#e6f1eb` | `#1e7a52` (success) | Pending |
| `REVIEW` | `#e5eef5` | `#2a6e9e` (info) | In review |
| `HOLD` | `#f6eedf` | `#a66a0a` (warning) | Hold |
| `ESCALATED` | `#f7e7e5` | `#b3261e` (critical) | Escalated |
| `RESOLVED` | `#edeff3` | `#5a6577` (secondary) | Resolved |

Chip padding: 4 px top/bottom, 8 px left/right. Font: Inter Medium 12 px. Corner radius: 12 px.

### Risk indication

Risk must be indicated by **both color and text label** (WCAG AA requirement):

| Risk band | Row tint | Text badge | Badge color |
|---|---|---|---|
| `HIGH` | `#fff3f2` (critical-bg tinted) | ⚠ HIGH | `#b3261e` bold |
| `MED` | none | MED | `#a66a0a` |
| `LOW` | none | LOW | `#1e7a52` |

### Data table

- Header row background: `#edeff3` (`--color-surface-subdued`)
- Header text: Roboto Mono Medium 11 px, `#5a6577`, ALL CAPS
- Row background (even/odd): `#ffffff` (no stripe — dividers define rows)
- Row divider: 1 px solid `#d6dae2`
- Cell text (identifier/amount): Roboto Mono Regular 13 px, `#10151f`
- Cell text (prose/vendor): Inter Regular 13 px, `#10151f`
- Cell text (secondary/date): Roboto Mono Regular 13 px, `#5a6577`

**Column order for Held Payments table:**
1. REF — Roboto Mono Medium 13 px
2. VENDOR — Inter Regular 13 px
3. INVOICE — Roboto Mono Regular 13 px
4. PO — Roboto Mono Regular 13 px
5. AMOUNT — Roboto Mono Medium 13 px, right-aligned
6. CCY — Roboto Mono Regular 13 px
7. STATUS — chip component
8. RISK — text badge (color + label)
9. HOLD REASON — Inter Regular 13 px
10. AGE — Roboto Mono Regular 13 px, right-aligned
11. CLERK — Inter Regular 13 px
12. (action) — detail link, no-print

### Buttons

- **Primary button**: fill `#1f5fd6`, text `#ffffff`, Inter Medium 14 px, border-radius 4 px, padding 8 px 16 px
- **Secondary button**: fill `#ffffff`, border 1 px solid `#d6dae2`, text `#10151f`, same font/size/radius/padding

### Input field

- Background `#ffffff`, border 1 px solid `#d6dae2`, border-radius 4 px
- Placeholder text: Roboto Mono Regular 13 px, `#5a6577`
- Focus ring: 2 px solid `#1f5fd6`, offset 2 px

---

## Figma source

- **File:** Meridian Demo (`saGgyANlhq6lW8zEJd1RWu`)
- **Page:** Meridian Design Language 3.0
- **Frame:** MDL 3.0 — Foundations & Components (`120:431`)
- **AFTER frame:** KAN-32 AFTER — to be created on page "KAN-32 - Held Payments Modernization" once Desktop Bridge plugin reconnects
- **BEFORE frame:** KAN-32 BEFORE — same page; screenshot of current `/exceptions` at capture time

> Note: Desktop Bridge plugin was unavailable at plan publication time (multiple server instances; plugin attached to none). BEFORE/AFTER frames will be built and PNGs exported when the plugin is next opened. The design spec above is complete and frozen from the REST-readable design language page. Implementation must not wait for the frames.
