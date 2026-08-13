# KAN-66 Design Spec — Held Payments (MDL 3.0 AFTER state)

Frozen from the tokens passed to `design/figma/render-screen.js` at plan approval.
Do not derive values by eye; use these numbers verbatim in implementation.

Figma reference: https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian%20Demo
Frame: **KAN-66 AFTER** — page: *KAN-66 - Held Payments Modernization*

---

## Colour tokens (MDL 3.0)

| Token | Hex | Usage |
|---|---|---|
| `--mdl-action` | `#1f5fd6` | Primary buttons, links, active nav underline |
| `--mdl-action-pressed` | `#17489f` | Button hover state |
| `--mdl-navy-900` | `#101827` | Masthead / navbar background |
| `--mdl-charcoal-800` | `#1e2532` | User chip background |
| `--mdl-surface` | `#ffffff` | Cards, table rows (odd), filter fields |
| `--mdl-surface-subdued` | `#edeff3` | Filter bar background, table header background |
| `--mdl-canvas` | `#f7f8fa` | Page background, table rows (even) |
| `--mdl-border` | `#d6dae2` | Table borders, input borders |
| `--mdl-border-strong` | `#a7b0bf` | Breadcrumb divider |
| `--mdl-text` | `#10151f` | Primary body text |
| `--mdl-text-secondary` | `#5a6577` | Muted text, labels, breadcrumbs |
| `--mdl-text-inverse` | `#ffffff` | Text on dark backgrounds |
| `--mdl-success` | `#1e7a52` | LOW-risk chip text and border tint |
| `--mdl-warning` | `#a66a0a` | HOLD status, MED-risk chip |
| `--mdl-critical` | `#b3261e` | HIGH-risk chip, ESCALATED chip, age highlight |
| Table hover | `#eef3fc` | `tr:hover` background |

---

## Typography

| Element | Family | Size | Weight | Notes |
|---|---|---|---|---|
| Masthead wordmark | Roboto Mono | 12px | 600 | Letter-spacing 1.1px, uppercase |
| Nav links | Inter | 13px | 400 (active: 600) | Active: `text-inverse`, others: `#c7cdd8` |
| Breadcrumb | Inter | 11px | 400 | Color `text-secondary` |
| Page title | Inter | 26px | 600 | Letter-spacing −0.2px |
| Page subtitle | Inter | 13px | 400 | Color `text-secondary`, left of title at 276px gap |
| Filter bar labels | Inter | 10px | 600 | Uppercase, letter-spacing 0.6px, color `text-secondary` |
| Filter inputs / buttons | Inter | 13px | 400/600 | Height 34px |
| Result summary | Inter | 12px | 400 | Color `text-secondary` |
| Table header | Inter | 10px | 600 | Uppercase, letter-spacing 0.6px, color `text-secondary` |
| Table body | Inter | 13px | 400 | Color `text` |
| Reference cells | Roboto Mono | 13px | 400 | Color `action` |
| Amount / invoice cells | Roboto Mono | 13px | 400 | Right-aligned |
| Chip labels | Inter | 10px | 600 | Uppercase, letter-spacing 0.4px |
| Age cell | Inter | 13px | 400 | Color `critical` |
| Pagination numbers | Inter | 12px | 400/600 | Active page: white on `action` bg |
| Footnote | Inter | 11px | 400 | Color `text-secondary` |

---

## Spacing scale

| Token | Value |
|---|---|
| `--mdl-space-1` | 4px |
| `--mdl-space-2` | 8px |
| `--mdl-space-3` | 16px |
| `--mdl-space-4` | 24px |
| `--mdl-space-5` | 32px |

Frame padding (left/right): `PAD = 32px`

---

## Layout (1440px frame)

| Zone | Y offset | Height | Background |
|---|---|---|---|
| Masthead | 0 | 56px | `navy-900` |
| Title band | 56 | 94px | `surface` |
| Filter bar | 150 | 76px | `surface-subdued` |
| Result summary | 226 | 30px | `canvas` |
| Table header row | 256 | 40px | `surface-subdued`, radius 4px |
| Table data rows | 296 | 52px/row | Alternating `surface` / `canvas` |
| Pagination | table-bottom + 20px | 32px | — |
| Footnote | pagination + 52px | — | — |

---

## Table columns (Held Payments)

| Column | Key | X | Width | Align | Mono |
|---|---|---|---|---|---|
| REFERENCE | `ref` | 32 | 140 | Left | Yes |
| VENDOR | `vendor` | 190 | 210 | Left | No |
| INVOICE NO | `invoice` | 410 | 140 | Left | Yes |
| AMOUNT | `amount` | 560 | 120 | Right | Yes |
| CCY | `ccy` | 692 | 44 | Left | No |
| STATUS | `status` | 748 | 100 | Chip | No |
| HOLD REASON | `reason` | 860 | 330 | Left | No |
| AGE | `age` | 1200 | 50 | Right | No |
| RISK | `risk` | 1264 | 80 | Chip | No |
| (detail link) | `detail` | 1356 | 52 | Right | No |

---

## Chip states

| Tone | Background | Text colour |
|---|---|---|
| `PENDING` | `rgba(90,101,119,0.12)` | `#5a6577` (text-secondary) |
| `REVIEW` | `rgba(31,95,214,0.12)` | `#1f5fd6` (action) |
| `HOLD` | `rgba(166,106,10,0.12)` | `#a66a0a` (warning) |
| `ESCALATED` | `rgba(179,38,30,0.12)` | `#b3261e` (critical) |
| `LOW` | `rgba(30,122,82,0.12)` | `#1e7a52` (success) |
| `MED` | `rgba(166,106,10,0.12)` | `#a66a0a` (warning) |
| `HIGH` | `rgba(179,38,30,0.12)` | `#b3261e` (critical) |

Chip height: 20px. Border-radius: 10px. Min-width: 52px.
`tr.risk-high` background override removed (chip carries the meaning).

---

## Border radius

All interactive elements and cards: `4px` (`--mdl-radius`).
Chips: `10px` (pill shape).

---

## Active nav indicator

Active tab: `font-weight: 600`, text `#ffffff`, underline `2px solid #1f5fd6` at bottom of navbar (`inset 0 -2px 0 var(--mdl-action)`).

---

## Accessibility requirements

- All text contrast ≥ 4.5:1 (WCAG AA) — verified against token pairs above.
- Risk and status conveyed by labelled chip, not colour alone (WCAG 1.4.1).
- Focus outline: `2px solid var(--mdl-action)`, `outline-offset: 2px` on all interactive elements.
- `prefers-reduced-motion`: button and table-row transitions disabled when set.
