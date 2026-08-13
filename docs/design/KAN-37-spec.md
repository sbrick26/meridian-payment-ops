# KAN-37 — Design spec: Held Payments (MDL 3.0)

Frozen 2026-08-13. Sourced from Figma "Meridian Demo" file, page "KAN-37 - Held Payments Modernization", frame "KAN-37 AFTER" (node `135:655`). Implementation must use these values verbatim — do not re-derive from screenshots or eye-match.

---

## Colours

| Token | Hex | Usage |
|---|---|---|
| Canvas | `#F7F8FA` | Page background |
| Surface | `#FFFFFF` | Title band, card, table row background |
| Surface Subdued | `#EDEFF3` | Filter bar background, table header row |
| Navy 900 | `#101827` | Masthead background |
| Charcoal 800 | `#1E2532` | User chip background |
| Action | `#1F5FD6` | Primary button fill, active nav underline, reference links |
| Action Pressed | `#17489F` | Primary button hover/active |
| Text Primary | `#10151F` | Page title, table body text |
| Text Secondary | `#5A6577` | Breadcrumb, subtitle, column headers, captions |
| Text Inverse | `#FFFFFF` | Masthead text, primary button label |
| Border | `#D6DAE2` | Table row dividers, input borders |
| Border Strong | `#A7B0BF` | Section rules |
| Nav inactive | `rgb(199,205,216)` | Non-active nav links |

### Status chip colours (background / dot / label text)

| Status | Chip bg | Dot | Label text | Maps to PAYOPS status |
|---|---|---|---|---|
| PENDING | `#EDEFF3` (Surface Subdued) | `#A7B0BF` (Border Strong) | `#5A6577` (Text Secondary) | PENDING |
| REVIEW | `#E5EEF5` | `#2A6E9E` (Info) | `#2A6E9E` | REVIEW |
| HOLD | `#F6EEDF` | `#A66A0A` (Warning) | `#A66A0A` | HOLD |
| ESCALATED | `#F7E7E5` | `#B3261E` (Critical) | `#B3261E` | ESCALATED |

### Risk badge colours

| Risk | Chip bg | Dot / text | Maps to `risk_flag` |
|---|---|---|---|
| LOW | `#E6F1EB` | `#1E7A52` (Success) | LOW |
| MED | `#F6EEDF` | `#A66A0A` (Warning) | MED |
| HIGH | `#F7E7E5` | `#B3261E` (Critical) | HIGH |

---

## Typography

| Step | Family | Size | Weight | Usage |
|---|---|---|---|---|
| Display | Inter | 40px / SemiBold | 600 | — |
| Heading M | Inter | 26px / SemiBold | 600 | Page title "Held Payments" |
| Heading S | Inter | 16px / SemiBold | 600 | Card titles |
| Body | Inter | 14px / Regular | 400 | Table body, button labels |
| Caption | Inter | 12px / Regular | 400 | Footer note, status chip labels |
| Label / Kicker | Inter | 11–13px / Medium or Regular | 500 or 400 | Column headers, breadcrumbs, filter labels, subtitles |
| Mono | Roboto Mono | 13px / Regular | 400 | Payment refs, invoice nos, amounts, timestamps, masthead brand |
| Mono Small | Roboto Mono | 10–12px / Regular | 400 | User chip, metadata labels |

---

## Spacing (4px grid)

| Token | Value | Usage |
|---|---|---|
| space-1 | 4px | Chip internal padding (top/bottom) |
| space-2 | 8px | Icon gaps, chip horizontal padding |
| space-3 | 12px | Column header padding, caption gaps |
| space-4 | 16px | Title band vertical padding, filter input height complement |
| space-5 | 24px | Masthead side padding, content left margin |
| space-6 | 32px | Page content left/right margin |
| space-7 | 40px | Control heights (inputs, buttons, select) |

---

## Layout — Held Payments screen (1440 × 920)

| Zone | y origin | Height | Background |
|---|---|---|---|
| Masthead | 0 | 56px | Navy 900 `#101827` |
| Title band | 56 | 94px | Surface `#FFFFFF` |
| Filter bar | 150 | 76px | Surface Subdued `#EDEFF3` |
| Summary strip | 226 | 32px | Surface `#FFFFFF` |
| Table header | 258 | 36px | Surface Subdued `#EDEFF3` |
| Table rows | 294 | 48px each | Surface `#FFFFFF`, border-bottom `#D6DAE2` |
| Pagination | ~590 | 48px | Surface `#FFFFFF` |
| Footnote | ~650 | 32px | Canvas `#F7F8FA` |

### Masthead (y=0, h=56)
- Brand: `"MERIDIAN PAYMENT OPS"` — Roboto Mono 12px/500 — Text Inverse — x=32, y=18
- Nav links: Inter 13px — inactive `rgb(199,205,216)` — active `#FFFFFF` weight 600
- Active nav underline: 2px rect, Action `#1F5FD6`, below nav link
- User chip: Charcoal 800 `#1E2532` rect, Roboto Mono 10px Text Secondary

### Title band (y=56, h=94)
- Breadcrumb: `"Dashboard  /  Held Payments"` — Inter 11px — Text Secondary — x=32, y=70
- Page title: `"Held Payments"` — Inter 26px/600 — Text Primary — x=32, y=92
- Subtitle: Inter 13px — Text Secondary — x=308, y=100

### Filter bar (y=150, h=76)
- Background: Surface Subdued `#EDEFF3`
- Labels: Inter 10px/600 — Text Secondary — uppercase
- Inputs: 40px height, Surface fill, Border `#D6DAE2` stroke 1px, Inter 13px/Roboto Mono 13px
- Primary button "Search": Action `#1F5FD6` fill, Text Inverse label, Inter 14px/500, 40px height, 8px border-radius
- Secondary link "Clear": Action `#1F5FD6` text, no fill
- "Export CSV": Action `#1F5FD6` text — right-aligned

### Table
- Header row: Surface Subdued `#EDEFF3`, Inter 11px/500, Text Secondary `#5A6577`, uppercase
- Column order: REFERENCE · VENDOR · INVOICE NO · AMOUNT · CCY · STATUS · HOLD REASON · AGE · RISK · (action)
- AMOUNT: Roboto Mono 13px, right-aligned
- REFERENCE: Roboto Mono 13px, Action `#1F5FD6` (clickable link)
- INVOICE NO: Roboto Mono 13px, Text Primary
- CCY: Roboto Mono 13px, Text Secondary
- AGE: Roboto Mono 13px, Text Secondary; values ≥7d use Critical `#B3261E`
- STATUS: chip (bg/dot/label per table above), Inter 12px/500, 8px border-radius
- RISK: chip (bg/dot/label per table above), Inter 12px/500, 8px border-radius
- Row height: 48px; border-bottom: 1px `#D6DAE2`
- "detail" action: Inter 13px, Text Secondary `#5A6577`

### Pagination
- Page buttons: 32px square, Border `#D6DAE2` stroke; active page: Action `#1F5FD6` fill, Text Inverse
- Caption: Inter 13px, Text Secondary

### Footnote
- Inter 12px, Text Secondary `#5A6577`
- Text: `"Invoices over $50,000 require a second sign-off per AP-114"`

---

## Components

### Primary button
- Fill: Action `#1F5FD6`; hover/active: Action Pressed `#17489F`
- Height: 40px; border-radius: 8px; padding: 0 16px
- Label: Inter 14px/500, Text Inverse `#FFFFFF`

### Secondary / ghost button
- No fill; Action `#1F5FD6` text label
- Same height and padding as primary

### Text input / select
- Height: 40px; fill: Surface `#FFFFFF`; border: 1px `#D6DAE2`; border-radius: 4px
- Placeholder: Roboto Mono 13px or Inter 13px, Text Secondary

### Status / risk chip
- Height: 24px; border-radius: 8px; padding: 0 8px
- Dot: 6px circle, left of label, 4px gap
- Label: Inter 12px/500

---

*Source of truth: Figma "Meridian Demo" — page "KAN-37 - Held Payments Modernization" — frame "KAN-37 AFTER" (node 135:655). Do not modify this spec without updating the Figma frame and re-exporting.*
