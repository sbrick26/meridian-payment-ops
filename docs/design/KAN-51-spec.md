# KAN-51 Design Spec — Held Payments Modernization

**Source:** Meridian Design Language 3.0 (Figma: saGgyANlhq6lW8zEJd1RWu, page "Meridian Design Language 3.0")  
**Frozen:** 2026-08-13  
**Frame:** KAN-51 AFTER (node 138:1504)

## Colour tokens

| Token | Hex | Usage |
|---|---|---|
| Action | `#1f5fd6` | Primary button background, link text, payment reference links |
| Action Pressed | `#17489f` | Primary button hover/active state |
| Navy 900 | `#101827` | Top navigation bar background |
| Charcoal 800 | `#1e2532` | Nav item hover background |
| Surface | `#ffffff` | Page body, card/table background |
| Surface Subdued | `#edeff3` | Table header row background, filter bar background |
| Canvas | `#f7f8fa` | Page canvas background |
| Border | `#d6dae2` | Table row dividers, input borders |
| Border Strong | `#a7b0bf` | Chip borders, section dividers |
| Text Primary | `#10151f` | Body text, table cell text |
| Text Secondary | `#5a6577` | Subheadings, column labels, metadata |
| Text Inverse | `#ffffff` | Text on dark backgrounds (nav) |
| Success | `#1e7a52` | LOW risk chip background/border; RESOLVED status |
| Warning | `#a66a0a` | MED risk chip background/border; HOLD/REVIEW status |
| Critical | `#b3261e` | HIGH risk chip; ESCALATED status |
| Info | `#2a6e9e` | PENDING/informational status chip |

## Type scale (Inter + Roboto Mono)

| Role | Family | Size | Weight | Usage |
|---|---|---|---|---|
| Display | Inter | 40px | Semi Bold | Page-level hero text (not used in table view) |
| Heading L | Inter | 28px | Semi Bold | Page title "Held Payments" |
| Heading M | Inter | 20px | Semi Bold | Section headings |
| Heading S | Inter | 16px | Semi Bold | Sub-section headings |
| Body | Inter | 14px | Regular | Table cell text, filter labels |
| Caption | Inter | 12px | Regular | Metadata, footnotes, summary line |
| Mono | Roboto Mono | 13px | Regular | Payment references (MT-YYYY-NNNNN), amounts |

## Spacing

- Navbar height: 48px
- Page horizontal padding: 24px
- Filter bar vertical padding: 12px top + bottom
- Table row height: 48px
- Table cell horizontal padding: 16px
- Status/risk chip: 6px vertical, 10px horizontal padding; 4px border-radius

## Component specs

### Navigation bar
- Background: Navy 900 (`#101827`)
- Active link: underlined, Text Inverse; inactive: Text Secondary
- Height: 48px
- Logo: "MERIDIAN PAYMENT OPS" in Inter 14px Semi Bold, Text Inverse

### Filter bar
- Background: Surface Subdued (`#edeff3`)
- Labels: Caption, Text Secondary, uppercase, letter-spacing 0.05em
- Inputs: Surface background, Border border, 4px border-radius, Body text
- Primary button (Search): Action background, Text Inverse, 4px border-radius
- Secondary button (Clear): transparent, Action text

### Table (Held Payments queue)
- Header row: Surface Subdued background, Caption text, Text Secondary, uppercase
- Body rows: Surface background, Body text, Border bottom divider
- Alternating: none (divider lines only)
- Hover: Surface Subdued background

### Status chips
Each status is a labelled chip (text + border, no fill) — never colour alone.

| Status | Text | Border colour | Text colour |
|---|---|---|---|
| PENDING | PENDING | Info (`#2a6e9e`) | Info |
| REVIEW | REVIEW | Warning (`#a66a0a`) | Warning |
| HOLD | HOLD | Warning (`#a66a0a`) | Warning |
| ESCALATED | ESCALATED | Critical (`#b3261e`) | Critical |
| RESOLVED | RESOLVED | Success (`#1e7a52`) | Success |

### Risk chips
Same chip pattern as status.

| Risk | Text | Border colour | Text colour |
|---|---|---|---|
| LOW | LOW | Success (`#1e7a52`) | Success |
| MED | MED | Warning (`#a66a0a`) | Warning |
| HIGH | HIGH | Critical (`#b3261e`) | Critical |

### Table columns (Held Payments queue)
Order: Reference · Vendor · Invoice No · Amount · Ccy · Status · Hold Reason · Age · Risk

### Age column
- Text: Mono font, e.g. "21d"
- Colour: Critical (`#b3261e`) when age ≥ 7 days; Text Secondary otherwise
- No background — colour + text (not colour-only)

## Accessibility requirements
- All status and risk indicators must use labelled chips (text + colour) — not colour alone (WCAG 1.4.1)
- All `<th>` must have `scope="col"` (WCAG 1.3.1)
- All form fields must have associated `<label>` elements (WCAG 1.3.1)
- Chip text must meet 4.5:1 contrast on white background (WCAG 1.4.3)
