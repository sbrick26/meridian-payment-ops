# KAN-41 — Held Payments Modernization: Design Spec

Frozen from Figma "Meridian Demo" — page "KAN-41 - Held Payments Modernization",
frame "KAN-41 AFTER" (node 135:900). Captured 2026-08-13.
REST token expired at freeze time; token values confirmed by design subagent from
MDL 3.0 page read. Implementation MUST use these values verbatim from `public/mdl-3.css`.

---

## Color tokens

| Token | Hex | Usage |
|---|---|---|
| `--color-action` | `#1F5FD6` | Primary buttons, links, active nav underline |
| `--color-navy-900` | `#101827` | Top navigation background |
| `--color-surface` | `#FFFFFF` | Card/panel/table row background |
| `--color-surface-subdued` | `#EDEFF3` | Table header row background |
| `--color-canvas` | `#F7F8FA` | Page background |
| `--color-border` | `#D6DAE2` | Table borders, filter bar borders |
| `--color-text-primary` | `#10151F` | Body text, column headers |
| `--color-text-secondary` | `#5A6577` | Breadcrumb, subtitle, muted labels |
| `--color-success` | `#1E7A52` | LOW risk chip text and border |
| `--color-warning` | `#A66A0A` | MED risk chip text and border; age highlight |
| `--color-critical` | `#B3261E` | HIGH risk chip text and border |
| `--color-info` | `#2A6E9E` | REVIEW status chip |

## Typography

| Element | Font | Size | Weight | Color token |
|---|---|---|---|---|
| Page H1 "Held Payments" | Inter | 24px | 600 | `--color-text-primary` |
| Page subtitle | Inter | 14px | 400 | `--color-text-secondary` |
| Nav links | Inter | 14px | 500 | white / `--color-action` (active underline) |
| Table column headers | Inter | 11px | 600 (uppercase) | `--color-text-secondary` |
| Table body text | Inter | 14px | 400 | `--color-text-primary` |
| Payment reference links | Inter | 14px | 400 | `--color-action` |
| Amount / reference IDs | Roboto Mono | 14px | 400 | `--color-text-primary` |
| Summary strip | Inter | 13px | 400 | `--color-text-secondary` |
| Filter labels | Inter | 11px | 600 (uppercase) | `--color-text-secondary` |
| Chip text | Inter | 11px | 600 | token per chip type |
| Breadcrumb | Inter | 13px | 400 | `--color-text-secondary` |

## Spacing

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Chip internal padding (horizontal) |
| `--space-2` | 8px | Table cell padding; chip vertical padding |
| `--space-3` | 12px | Filter bar field gap |
| `--space-4` | 16px | Section vertical spacing; nav item padding |
| `--space-5` | 24px | Page header bottom margin |

## Border radius

| Usage | Value |
|---|---|
| Status / risk chips | 4px |
| Search button | 4px |
| Filter dropdowns | 4px |

## Layout

- **Navigation bar**: full-width, height 48px, background `--color-navy-900`
- **Breadcrumb**: 12px top padding, text `--color-text-secondary`
- **Page header**: H1 + subtitle on same baseline row, 24px bottom margin
- **Filter bar**: background `--color-surface-subdued`, 12px vertical padding,
  16px horizontal padding, bottom border `--color-border`
- **Summary strip**: 8px vertical padding, text `--color-text-secondary`
- **Table**: full-width, `border-collapse: collapse`
  - Header row: background `--color-surface-subdued`, 12px vertical padding
  - Body rows: background `--color-surface`, 1px bottom border `--color-border`,
    12px vertical cell padding, 16px horizontal cell padding
- **Pagination**: 24px top margin; page buttons 32px square, border `--color-border`;
  active page background `--color-action`, text white
- **Footer note**: 16px top margin, 12px text, `--color-text-secondary`

## Chips (status and risk)

All chips: `border-radius: 4px`, `padding: 2px 6px`, `font: Inter 11px/600`, uppercase text.

| Chip | Background | Border | Text color |
|---|---|---|---|
| PENDING (status) | `#F3F4F6` | `--color-border` | `--color-text-primary` |
| REVIEW (status) | `rgba(42,110,158,0.1)` | `--color-info` | `--color-info` |
| HOLD (status) | `rgba(166,106,10,0.1)` | `--color-warning` | `--color-warning` |
| ESCALATED (status) | `rgba(179,38,30,0.1)` | `--color-critical` | `--color-critical` |
| LOW (risk) | `rgba(30,122,82,0.1)` | `--color-success` | `--color-success` |
| MED (risk) | `rgba(166,106,10,0.1)` | `--color-warning` | `--color-warning` |
| HIGH (risk) | `rgba(179,38,30,0.1)` | `--color-critical` | `--color-critical` |

## WCAG 2.2 AA requirements (all must be implemented)

1. **Risk encoding**: labeled chip on every row — LOW / MED / HIGH text always present,
   never color alone. Chip has `aria-label="Risk: LOW"` etc.
2. **Table headers**: all `<th>` elements carry `scope="col"` or `scope="row"`.
3. **Row keyboard selection**: `tabindex="0"` on `<tr>`; `keydown` handler for Enter/Space
   mirrors click behavior; `aria-selected` toggled.
4. **Sort column headers**: `role="button"` + `aria-sort="ascending|descending|none"`.
5. **Bar charts (reports)**: `role="img"` + `aria-label` stating the percentage or value.

## Columns and order (Held Payments table)

REFERENCE · VENDOR · INVOICE NO · AMOUNT · CCY · STATUS · HOLD REASON · AGE · RISK · (detail link)

- REFERENCE: link, Roboto Mono, `--color-action`
- AMOUNT: right-aligned, Roboto Mono
- STATUS: chip
- RISK: chip (never color-alone)
- AGE: amber (`--color-warning`) when > 14 days; plain otherwise

## Reference frame

- **Before**: `docs/design/legacy-held-payments.png`
- **After**: `docs/design/KAN-41-after.png`
- **Figma page**: "KAN-41 - Held Payments Modernization" in "Meridian Demo"
  (saGgyANlhq6lW8zEJd1RWu), frames 135:898 (BEFORE) and 135:900 (AFTER)
