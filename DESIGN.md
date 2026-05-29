# GrowwStacks OS — Design System v3

Source of truth: `src/app/globals.css` + the CLAUDE_CODE_PROMPT spec.

## Tokens

### Brand BLUE
| Token | Hex | Use |
|-------|-----|-----|
| `--blue-900` | `#0a2540` | sidebar bg base, headings (ink-900), primary text |
| `--blue-800` | `#0f3a66` | sidebar gradient stop |
| `--blue-700` | `#10519b` | primary button base |
| `--blue-600` | `#1d6fd6` | links, primary hover, focus rings, KPI accent |
| `--blue-100` | `#e6f0fb` | tinted badge fill |
| `--blue-50`  | `#f1f7fe` | table header bg, row hover |

### Brand GREEN (success / positive)
| Token | Hex | Use |
|-------|-----|-----|
| `--green-700` | `#0b7a5b` | success badge text |
| `--green-600` | `#0ea371` | progress-bar mid, success hover |
| `--green-500` | `#16c088` | active-nav glow, brand-mark mid, KPI green accent |
| `--green-100` | `#dcf7ec` | success badge bg |
| `--green-50`  | `#edfbf4` | super-soft positive fill |

### Cool-white neutrals (NOT cream)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg`           | `#f4f8fc` | app canvas |
| `--surface`      | `#ffffff` | cards, tables, form fields |
| `--line`         | `#e3ecf5` | hairlines / borders |
| `--line-strong`  | `#d2e0ee` | form-field borders, ghost button border |

### Text
| Token | Hex | Use |
|-------|-----|-----|
| `--ink-900` | `#0a2540` | primary / headings |
| `--ink-700` | `#324a63` | body |
| `--ink-500` | `#5d748c` | muted, secondary |
| `--ink-400` | `#8aa0b6` | faint labels, breadcrumb trail (never body) |

### Semantic
| Token | Hex | Use |
|-------|-----|-----|
| `--amber-600` | `#c77700` | warning text (medium / on hold / expected) |
| `--amber-100` | `#fdf0d9` | warning fill |
| `--red-600` | `#d23b3b` | danger text (blocked / urgent / overdue) |
| `--red-100` | `#fbe3e3` | danger fill |
| `--violet-600` | `#6b4ed8` | review / proposal-sent |
| `--violet-100` | `#ece7fb` | review / proposal-sent fill |

### Shape & shadow
- `--radius` 14px (cards, tables)
- `--radius-sm` 10px (buttons, inputs, badges)
- `--shadow-sm` `0 1px 2px rgba(10,37,64,.05), 0 1px 3px rgba(10,37,64,.06)`
- `--shadow-md` `0 6px 20px -8px rgba(10,37,64,.18), 0 2px 6px rgba(10,37,64,.06)`
- `--shadow-primary` `0 4px 14px -4px rgba(29,111,214,.55)` (primary button)

## Typography

- **Display** (h1–h4, page titles, card titles, KPI values, brand): **Space Grotesk** 500–700, `letter-spacing: -0.02em`. Loaded via `next/font` as `--font-display`.
- **Body** (UI, table cells, buttons, labels): **Plus Jakarta Sans** 400–700, `letter-spacing: -0.01em`. Loaded as `--font-sans`.
- **Numerics** (amounts, IDs, references, KPI values): **JetBrains Mono** 400–600, `font-feature-settings: "tnum"`. Loaded as `--font-mono`. Use the `.font-numeric` utility.

### Scale
| Role | Family | Size | Weight |
|------|--------|------|--------|
| Page title (h1) | Space Grotesk | 34px | 700 |
| Card title (h2) | Space Grotesk | 18px | 600 |
| KPI value | Space Grotesk (numbers via mono) | 27px | 600 |
| Section heading (h3) | Space Grotesk | 16px | 600 |
| Body | Plus Jakarta Sans | 15px | 400/500 |
| Small | Plus Jakarta Sans | 13px | 400/500 |
| Eyebrow / column headers / KPI labels | Plus Jakarta Sans | 10.5px / 600–700 / `letter-spacing: 0.12em` / uppercase / `color: --ink-400` |
| Numerics | JetBrains Mono | varies | 500 |

`--ink-400` is reserved for eyebrows and faint labels. **Never** body text (contrast rule).

## Components

### Sidebar (264px)
- Background: `linear-gradient(180deg, #0a2540, #0c2f52)` (use `.sidebar-bg`).
- Text: `#a9c2da`.
- Active nav: `.sidebar-active-pill` gradient + 3px green left-inset glow + soft green inner shadow + white text + `--green-500` icon.
- Hover: `rgba(255,255,255,.05)`, white text.
- Brand mark: rounded square with `linear-gradient(135deg, --blue-600, --green-500)`, white **G**.
- Right edge: thin green-glow vertical line.

### Buttons
- **Primary**: `.btn-primary-gradient` → `linear-gradient(135deg, --blue-700, --blue-600)`, white text, radius 10px, brand-glow shadow. Hover brightens.
- **Secondary / ghost**: white bg, `--line-strong` border, `--ink-700` text. Hover → border + text `--blue-600/700`.
- All ex-terracotta buttons replaced with the primary gradient.

### Cards
- White bg, `1px solid --line`, radius 14px, `--shadow-sm`.
- **KPI cards**: add a 3px left accent bar via `.kpi-card[data-accent=blue|green|amber|violet]`.

### Tables
- Header row: `--blue-50` bg, eyebrow style labels (10.5px uppercase `--ink-400` 600).
- Rows: 13px vertical padding, hairline separators (`--line`), hover bg `--blue-50`.
- Primary cell text `--ink-900` weight 600; secondary 12px `--ink-400`.
- Money values use `.font-numeric`.

### Badges (status / priority / stage)
Pill, 12px / 600 / radius 10px, **with a 6px leading dot** (`.badge-dot`).
| Meaning | Style |
|---------|-------|
| Active / Received / Done / positive | `bg-green-100 text-green-700` |
| New / Qualified / In progress / info | `bg-blue-100 text-blue-700` |
| Review / Proposal sent | `bg-violet-100 text-violet-600` |
| Medium / High / On hold / Expected | `bg-amber-100 text-amber-600` |
| Blocked / Urgent / Overdue | `bg-red-100 text-red-600` |
| Todo / neutral | `bg-[#eef3f8] text-ink-500` |

Overdue due-dates: text `--red-600` weight 600 (not a badge — just the cell).

### Forms
Every form uses the centered-card layout (`FormCard` primitive). Title + subtitle sit **inside** the card as its heading; only the breadcrumb stays at the page top. Max-width 680px, `--shadow-md`, hairline separator before the field stack.
- Inputs / selects / textareas: white bg, `--line-strong` border, radius 10px, 15px text.
- Focus: 2px `--blue-600` ring at 40% opacity.
- Custom select chevron (replacing the native).
- Field labels: 14px / 600.
- Required → small `--blue-600` asterisk.
- Footer actions right-aligned: ghost "Cancel" + primary "Confirm".

### Breadcrumbs
`--ink-400` trail, current page `--blue-700`, `›` separators.

### Progress (milestones)
Use `.progress-track` + `.progress-fill` — 6px track in `--line`, fill `linear-gradient(90deg, --blue-600, --green-500)`.

### Focus rings
2px `--blue-600` at 40% opacity, applied via `outline-ring/50` on the `*` selector. Hairlines/dividers always `--line`.

## Don'ts

- **Don't** use cream (`#fdf8f0`) or terracotta (`#b3441f`) anywhere.
- **Don't** use `--ink-400` for body text. Eyebrows only.
- **Don't** sprinkle `--green-500` across the UI — accent only (success badges, active-nav glow, brand-mark mid, KPI green accent).
- **Don't** add a second card style. Refactor the shared one.
