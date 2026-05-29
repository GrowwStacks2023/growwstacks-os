# GrowwStacks OS — Design system (v2)

Short reference. Full source of truth is `src/app/globals.css`.

## Direction

**Confident product, modern professional.** Rich blue is the brand and
dominates the identity. Green is an accent used sparingly on positive
states. Warm-off-white page background, pure white card surfaces, calm
slate neutrals for text and borders.

Bricolage Grotesque headings over Geist Sans body, at a comfortably
readable scale. Generous whitespace. Color carries hierarchy.

**Hard rule:** blue dominates; green punctuates. They are NEVER visual
equals on the same surface.

## Typography

Loaded via `next/font/google` in `src/app/layout.tsx`. CSS variables
exposed: `--font-sans`, `--font-display`, `--font-mono`.

| Role | Family | Weight | Size | Line height | Tracking |
|------|--------|-------:|-----:|-----:|---------:|
| Display / H1 | Bricolage Grotesque | 600 | 28–32px | 1.1 | -0.012em |
| H2 | Bricolage Grotesque | 600 | 24px | 1.18 | -0.012em |
| H3 / card title | Bricolage Grotesque | 600 | 20px | 1.25 | -0.012em |
| H4 / section heading | Bricolage Grotesque | 600 | 17px | 1.3 | -0.012em |
| Body | Geist Sans | 400/500 | **16px** | 1.55 | 0 |
| Small | Geist Sans | 400/500 | 14px | 1.5 | 0 |
| Caption / eyebrow | Geist Sans | 600 | 12px | 1.4 | 0.06em |
| Numeric | Geist Mono | 500 | varies | – | – |

- Body bumped from 14 → **16px** (this directly addresses "fonts too
  small"). Use Tailwind `text-base` (= 16px) for body, `text-sm` (14px)
  for secondary copy, `text-xs` (12px) for captions/eyebrows.
- All headings auto-pick Bricolage via the `h1`/`h2`/`h3`/`h4` selectors
  in `@layer base`. For non-heading display text use the `font-display`
  utility.
- Bricolage variable axes used: `opsz` (optical size, scaled with the
  heading), `wdth` (kept at 100 — neutral width).

## Palette

### Brand BLUE — dominant

Deep cobalt / royal. oklch hue 248–260.

| Token | Use |
|-------|-----|
| `brand-50` / `brand-100` | Tints — section backgrounds, sparingly |
| `brand-200` / `brand-300` | Sidebar borders, subtle accents |
| `brand-500` | **Focus ring**, link color, key emphasis |
| `brand-600` | **Primary button** background. ~5.5:1 against white |
| `brand-700` | Primary hover, big-number display, brand wordmark |
| `brand-800` / `brand-900` | **Sidebar surface** (full blue chrome), deep emphasis |

### Accent GREEN — positives only

| Token | Use |
|-------|-----|
| `success-50` / `success-100` | Success badge backgrounds |
| `success-500` / `success-600` | Won-deal / received-payment / done badges, positive-delta dot |
| `success-700` | Dark mode success text |

**Don't:** primary button background, headline color, large surface
fill. Green stays small and meaningful.

### Surfaces

- `--background` warm off-white (oklch 0.985 hue 80) — paper, not clinical
- `--card` pure white — cards lift off the page
- `--foreground` deep ink with a hint of brand blue
- `--border` cool pale slate

### Status — semantic, intentional

Status badges (`src/lib/status-colors.ts`) use Tailwind named colors so
the meaning carries:

- Neutral / idle → `slate`
- In progress / qualified / proposal → `blue` / `indigo`
- On hold / expected / negotiation / high priority → `amber`
- Done / received / won → `green` (the success accent — only here, not
  on plain "saved" toasts)
- Blocked / lost / refunded → `red`
- Review → `purple`

## Spacing

Tailwind's 4-based scale, used consistently.

- Page outer padding: `px-8 py-10`
- Page max-width: `max-w-6xl`
- Section gap (between page-header + sections): `gap-10`
- Card inner padding: `p-6`
- Form field gap: `gap-5` between fields, `gap-2` between label and input
- Cluster gap (badge row, button row): `gap-2`

## Radius / shadow

- Cards: `--radius-lg` (10px). Hairline border + a soft 0–1px shadow
  that reads as "lift" not "drop".
- Buttons: `--radius-md` (8px). Primary button gets the `.btn-primary-shadow` inset highlight + outer drop.
- Inputs / selects / textareas: `--radius-md` (8px). Same h-10 across
  all of them.
- Pills/badges: `--radius-2xl` (18px).

## Where each color appears

| Surface | Color |
|---------|-------|
| Page background | warm off-white |
| Card | pure white |
| Sidebar (the whole chrome) | brand-900 (deep navy) |
| Sidebar active link | brand-700 background + white text + white left mark |
| Primary button | brand-600 → hover brand-700 |
| Secondary button | white card with hairline + foreground text |
| Page title | foreground deep ink |
| Link / focus ring | brand-500 |
| Big numbers on dashboard tiles | brand-700 |
| "Won" deal badge / "Received" payment / "Done" task | success-* via status-colors |
| Positive-delta dot | success-500 |

## Shared primitives

Layout (`src/components/page-shell/`):
- `<Page>` outer container, `<Section>` labelled chunk
- `<PageHeader>` title + description + meta + action + breadcrumbs
- `<Breadcrumbs>` persistent trail
- `<PageLoader>` branded loader

Forms (`src/components/form/`):
- `<Field>` label + input wrapper
- `<FormRow>` two/three column grid (collapses on narrow)
- `<FormSection>` labelled group
- `<FormActions>` button row

Lists (`src/components/responsive-list/`):
- `<ResponsiveList>` table on wide, card stack on narrow. One mechanism
  used by EVERY list page (companies, contacts, projects, tasks, payments).

## Don'ts

- **Don't** put blue and green at equal weight on a page. Blue is the
  brand; green is the accent.
- **Don't** use green for "saved" toasts, "primary button", or large
  surface fills. It's the won/received/done indicator only.
- **Don't** introduce a second card style. Refactor the shared one.
- **Don't** sprinkle brand-* across status badges. Status is semantic.
- **Don't** make body smaller than 16px. The previous round was rejected
  for being too small; we hold the line.
