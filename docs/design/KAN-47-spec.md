# KAN-47 — Design Specification: Held Payments MDL 3.0

Frozen at plan approval. Derived from the KAN-47 AFTER frame (node 138:1148) in
the Meridian Demo Figma file. Implementation must use these values verbatim.

## Frame

| | |
|---|---|
| **Frame** | KAN-47 AFTER (node `138:1148`) |
| **Figma file** | Meridian Demo (`saGgyANlhq6lW8zEJd1RWu`) |
| **Page** | KAN-47 - Held Payments Modernization |
| **Figma URL** | https://www.figma.com/design/saGgyANlhq6lW8zEJd1RWu/Meridian-Demo?node-id=138-1148 |
| **Size** | 1440 × 920 |
| **Stylesheet** | `public/mdl-3.css` (already committed — use this, do not author new styles) |

## Colour tokens (MDL 3.0)

| Token | Hex | Usage |
|---|---|---|
| `--mdl-navy` / `navy900` | `#101827` | Masthead background |
| `--mdl-action` | `#1f5fd6` | Nav active underline, links, Search button, page-1 chip |
| `--mdl-surface` | `#ffffff` | Page background, row 1/3/5 background, form fields |
| `--mdl-surfaceSubdued` | `#edeff3` | Filter bar background, table header background, row 2/4 background |
| `--mdl-canvas` | `#f7f8fa` | Alternating row fill |
| `--mdl-border` | `#d6dae2` | Row divider rules |
| `--mdl-textPrimary` | `#10151f` | Body text, vendor names, amounts |
| `--mdl-textSecondary` | `#5a6577` | Labels, breadcrumb, column headers, muted text |
| `--mdl-textInverse` | `#ffffff` | Masthead text, Search button label |
| `--mdl-success` | `#1e7a52` | LOW risk chip text + border |
| `--mdl-warning` | `#a66a0a` | MED risk chip text + border |
| `--mdl-critical` | `#b3261e` | HIGH risk chip text + border; age ≥ 14d text |
| `--mdl-textMuted` (nav inactive) | `#c7cdd8` | Nav items not active |
| `--mdl-surfaceDim` (user chip) | `#1e2532` | User chip background in masthead |

## Typography

| Role | Family | Style | Size |
|---|---|---|---|
| Masthead wordmark | Roboto Mono | Medium | 12 px |
| Nav items | Inter | Regular / Semi Bold (active) | 13 px |
| Page title | Inter | Semi Bold | 26 px |
| Breadcrumb / subtitle | Inter | Regular | 11–13 px |
| Filter bar labels | Inter | Semi Bold | 10 px |
| Filter field text | Inter | Regular | 13 px |
| Summary text | Inter | Regular | 12 px |
| Column headers | Inter | Semi Bold | 10 px |
| Body row text (vendor, reason) | Inter | Regular | 13 px |
| References / amounts (monospace) | Roboto Mono | Regular | 13 px |
| Chip labels (STATUS, RISK) | Inter | Semi Bold | 10 px |
| Age indicator | Inter | Regular | 13 px (critical color if ≥ 14 d) |

## Chip components

Status chips (`.chip-*` classes in `mdl-3.css`):

| Status | Text | Text color | Background |
|---|---|---|---|
| PENDING | `PENDING` | `#5a6577` | `rgba(90,101,119,0.12)` |
| REVIEW | `REVIEW` | `#1f5fd6` | `rgba(31,95,214,0.12)` |
| HOLD | `HOLD` | `#a66a0a` | `rgba(166,106,10,0.12)` |
| ESCALATED | `ESCALATED` | `#b3261e` | `rgba(179,38,30,0.12)` |

Risk chips (`.chip-*` classes in `mdl-3.css`):

| Band | Text | Text color |
|---|---|---|
| LOW | `LOW` | `#1e7a52` (`--mdl-success`) |
| MED | `MED` | `#a66a0a` (`--mdl-warning`) |
| HIGH | `HIGH` | `#b3261e` (`--mdl-critical`) |

## Column layout (Held Payments table)

| Column | x (px) | Header | Data font |
|---|---|---|---|
| Reference | 42 | REFERENCE | Roboto Mono Regular 13 px, `--mdl-action` |
| Vendor | 200 | VENDOR | Inter Regular 13 px |
| Invoice No | 420 | INVOICE NO | Roboto Mono Regular 13 px |
| Amount | 560 | AMOUNT | Roboto Mono Regular 13 px, right-align |
| Ccy | 702 | CCY | Inter Regular 13 px |
| Status | 758 | STATUS | Chip |
| Hold Reason | 870 | HOLD REASON | Inter Regular 13 px |
| Age | 1200 | AGE | Inter Regular 13 px; critical color if ≥ 14 d |
| Risk | 1274 | RISK | Chip |
| (detail link) | 1356 | — | Inter Regular 13 px |

## Spacing and layout

- Row height: 52 px (content area 46 px + 1 px rule)
- Table starts at y = 266 (header row)
- Filter bar: y = 150, height 86 px, background `--mdl-surfaceSubdued`
- Masthead: y = 0, height 56 px, background `--mdl-navy`
- Page title band: y = 56, height 94 px, background `--mdl-surface`
- Left margin: 32 px; inner cell padding-left: 10 px
- Border radius on chips: 4 px (`--mdl-radius`)

## Accessibility requirements (WCAG 2.2 AA)

- All status and risk indicators use labeled chips — color plus text, never color alone.
- Minimum body font size: 13 px (no 10 px table text from legacy).
- Age values ≥ 14 days are rendered in `--mdl-critical` (#b3261e on white = 5.1:1 contrast, passes AA).
- Focus states: `outline: 2px solid rgba(31,95,214,0.25)` on all interactive elements.
