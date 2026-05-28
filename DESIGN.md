# GrowwStacks OS — Design system

Short reference. The full source of truth is `src/app/globals.css`.

## Direction

**Editorial-craft.** Refined serif headings (Fraunces) over a disciplined
grotesque body (Geist Sans). Warm sienna accent against paper-warm surfaces.
Whitespace carries the rhythm; colour punctuates.

**Anti-goal:** default-shadcn / generic-AI-dashboard.

## Typography

| Role | Family | Weight | Size | Tracking | Where |
|------|--------|--------|------|----------|-------|
| Display / H1 | Fraunces | 500 | 28–32px | -0.012em | Page titles |
| H2 | Fraunces | 500 | 22–24px | -0.012em | Section titles |
| H3 | Fraunces | 600 | 17–18px | -0.012em | Card titles |
| Body | Geist Sans | 400/500 | 15px | 0 | Everything else |
| Small | Geist Sans | 400 | 13px | 0 | Captions, hints |
| Numeric | Geist Mono | 500 | varies | 0 | Tabular numbers, IDs |

- Fonts loaded via `next/font` in `src/app/layout.tsx`.
- Variables exposed: `--font-display`, `--font-sans`, `--font-mono` plus
  legacy `--font-heading` aliased to display for back-compat.
- Use `font-display` Tailwind utility for editorial headings; the `h1`/
  `h2`/`h3` selectors in `@layer base` apply the editorial styling
  automatically.
- Fraunces variable axes used: `opsz` (optical size, scaled with the
  heading), `SOFT` (softens the serifs at smaller sizes for warmth).
- Body font-feature-settings turn on Geist's stylistic alternates
  (`ss01`, `ss03`) and the rounded `cv11` for a friendlier "a".

## Palette

### Sienna ramp — the accent

Terracotta / burnt-orange. Hue 28–45, oklch space.

| Token | Use |
|-------|-----|
| `sienna-50` / `sienna-100` | Tints — active sidebar background, inline highlights |
| `sienna-200` / `sienna-300` | Subtle accents, badge tints |
| `sienna-500` | **Focus ring**, brand mark |
| `sienna-600` | **Primary button** background. ~5:1 against white label. |
| `sienna-700` | Sidebar active text, large-number emphasis on dashboard |
| `sienna-800` / `sienna-900` | Deep emphasis, rare |

### Surfaces — warm paper, not cold slate

- `--background` warm cream (oklch 0.983)
- `--card` pure white — cards "lift" off the page
- `--foreground` warm near-black (hue 55, not slate-blue)
- `--border` warm pale grey
- Subtle radial sienna sheen pinned top-right via `body::before` —
  reads as paper, not a flat tile. Pointer-events off.

### Status — semantic, untouched

Status badges (`src/lib/status-colors.ts`) use the Tailwind named palette:

- Neutral / idle → `stone` (warm grey — not `slate` / `zinc`)
- In progress / qualified / proposal → `blue` / `indigo`
- On hold / expected / negotiation / high-priority → `amber`
- Done / received / won → `green`
- Blocked / lost / refunded → `red`
- Review → `purple`

**Never re-tint these to match the brand**, they carry meaning.

## Spacing

Tailwind's 4-based scale, used consistently:

- Page outer padding: `px-8 py-8`
- Section gap (top-of-page rhythm): `gap-8`
- Card inner padding: `p-6` (header) / `p-6` (content)
- Form field gap: `gap-5` between fields, `gap-2.5` between label + input
- Cluster gap (badge row, button row): `gap-2`

## Radius / shadow

- Cards: `--radius-lg` (10px). One hairline border + a single near-flat
  shadow (`0 1px 0` in a warm tone) — reads as "lift", not "drop".
- Buttons: `--radius-md` (8px).
- Inputs: `--radius-md` (8px). Same height across `Input`, `Textarea`,
  `SelectTrigger`.
- Pills/badges: `--radius-2xl` (18px).

## Accent usage — RULES

The accent (sienna) appears in these places ONLY:

1. Primary action buttons (`Button` default variant).
2. Active sidebar link (sienna-50 background + sienna-700 text + sienna-600 icon).
3. Focus ring on inputs and interactive elements.
4. Brand mark in the sidebar header.
5. Large numbers on dashboard tiles.
6. The editorial 2px underline beneath section headings (`.accent-rule`).

**Nothing else gets sienna by default.** Color punctuates; if you find
yourself adding `bg-sienna-*` somewhere not on this list, push back.

## Shared primitives

Layout:
- `src/components/page-shell/page.tsx` — `<Page>` outer container, `<Section>` labelled chunk
- `src/components/page-shell/page-header.tsx` — `<PageHeader>` (title + description + meta + action + breadcrumbs)
- `src/components/page-shell/breadcrumbs.tsx` — persistent back-trail
- `src/components/page-shell/page-loader.tsx` — branded sienna spinner

Forms:
- `src/components/form/field.tsx` — `<Field>` label + input wrapper, consistent vertical rhythm
- `src/components/form/form-row.tsx` — `<FormRow>` two-column grid that collapses on narrow screens
- `src/components/form/form-section.tsx` — `<FormSection>` labelled group with optional description
- `src/components/form/form-actions.tsx` — `<FormActions>` button row pinned bottom-right

Every create form (companies, contacts, deals, projects, milestones,
tasks, payments) consumes the same primitives. If you add a new form,
use them — don't roll your own grid.

## Don'ts

- Don't use generic system fonts. The whole point of Fraunces + Geist is
  voice. If you set `font-family: sans-serif` you've broken the identity.
- Don't sprinkle sienna across status badges. They're semantic.
- Don't introduce a second card style. Refactor the existing one if you
  need a variant; talk to Manish first.
- Don't add custom button colors. The `Button` component covers it.
- Don't reintroduce cold greys (`slate`, `zinc`, `gray`). Use `stone` if
  you need a Tailwind named neutral.
