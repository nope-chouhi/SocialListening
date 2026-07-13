# Nope360 Design System

Nope360 uses one visual language: **CINEMATIC INTELLIGENCE**. Public pages are expressive and editorial; authenticated product pages are compact and analytical. Both use the same semantic tokens, Inter typography, Nope360 blue, component states, and accessibility rules.

The authoritative internal specification is `D:/desktop_file/agent-company/state/NOPE360_DESIGN_CONSTITUTION.md`. Root `DESIGN.md` provides machine-readable tokens for coding agents.

## Principles

- Signal before decoration.
- Preserve the production action blue `#3B82F6` in light and dark modes; pair filled blue controls with near-black ink text for WCAG AA contrast.
- Use warm cream/ink editorial contrast, not generic AI-purple branding.
- Use glass only for storytelling, floating controls, and overlays.
- Keep dense cards, tables, forms, and sidebars opaque and readable.
- Never invent data, customers, claims, product states, or backend completion.
- Build keyboard, contrast, reduced-motion, responsive, and Vietnamese support into primitives.

## Themes

Theme preferences are `system`, `light`, and `dark`. The selected preference persists across public and authenticated routes. When preference is `system`, OS changes update the resolved theme. The resolved class must be applied before paint to avoid hydration mismatch or incorrect-theme flash.

### Required semantic tokens

```css
/* Common token names; values differ intentionally by theme. */
--background;
--foreground;
--surface;
--surface-elevated;
--surface-muted;
--surface-glass;
--text-primary;
--text-secondary;
--text-muted;
--border;
--border-strong;
--primary;
--primary-hover;
--primary-foreground;
--editorial-accent;
--success;
--warning;
--danger;
--focus-ring;
--overlay;
--shadow-color;
--chart-1; --chart-2; --chart-3; --chart-4;
--chart-5; --chart-6; --chart-7; --chart-8;
```

### Core values

| Semantic role | Light | Dark |
|---|---|---|
| canvas | warm ivory `hsl(40 33% 97%)` | near-black blue `hsl(224 46% 7%)` |
| surface | white | graphite `hsl(222 39% 11%)` |
| elevated | warm neutral | lighter graphite |
| primary | `hsl(217.2 91.2% 59.8%)` | same Nope360 blue |
| editorial accent | deep warm charcoal | warm cream |
| focus | visible Nope360 blue | lighter blue |

See the constitution for the complete light/dark token tables and chart palette.

## Typography

Inter is loaded with `latin` and `vietnamese` subsets. It is required for body copy, controls, forms, tables, and dashboard content. A serif accent may appear only on short marketing phrases when already available, CSP-safe, performant, and verified for required glyphs; otherwise use Inter with weight/tracking/italic contrast.

- Marketing hero: responsive `clamp`, short editorial lines.
- Marketing body: 16–18px, maximum 68 characters per line.
- Dashboard controls/body: 14px baseline.
- Dashboard labels/metadata: 12px with readable line-height.
- Dashboard page titles: 20–24px, never landing-page scale.

## Layout and density

### Marketing

Use larger radii, generous whitespace, narrative sections, expressive hierarchy, and richer one-time motion. Product visuals must be actual UI compositions or clearly marked samples.

### Dashboard

Use stable navigation, opaque information surfaces, clear borders, compact spacing, minimal motion, responsive chart bounds, and table scanability. Do not apply glass to dense sidebars or tables.

### Structured workflows

Authentication, onboarding, Manual Scan, report creation, and settings use a clear primary/secondary two-zone hierarchy and progressive disclosure. Mobile puts the task first and compresses decorative context.

## Components

Adapt the existing component library; do not create parallel equivalents.

- Actions: Button, IconButton, ThemeToggle
- Inputs: Input, Select, Textarea, Checkbox, Radio, Switch
- Surfaces: Card, MetricCard, Dialog, Sheet, Tooltip, Dropdown
- Navigation: Tabs, Stepper, PageHeader, SectionHeader
- Feedback: Badge, StatusIndicator, EmptyState, ErrorState, Skeleton

Every interactive primitive defines default, hover, active, selected, focus-visible, disabled, loading, error, and theme states where applicable.

## Glass

Reusable forms: `glass-panel`, `glass-pill`, `glass-dialog`, `glass-floating-control`.

- Blur stays controlled (typically 12–20px).
- Text contrast is measured against the final composited surface.
- Provide an opaque fallback.
- Never use glass where moving/backdrop content reduces legibility.

## Motion

Existing `framer-motion` may power reusable primitives: FadeUp, StaggerGroup, WordReveal, SectionReveal, PresenceTransition, NumberReveal, ModalTransition, StepTransition.

Interaction motion is 120–180ms; UI presence is 180–260ms; expressive public motion is 320–600ms. Avoid `transition-all`, repeated dashboard entrances, blocked interaction, and layout shift. `prefers-reduced-motion: reduce` removes transforms, stagger, parallax, number interpolation, and smooth scrolling.

## Charts

Use `--chart-1` through `--chart-8` for series and semantic state tokens for success/warning/danger. Axes, grids, legends, tooltips, selections, and disabled states must work in both themes. Provide a text summary or accessible image label, and never rely on color alone.

## Responsive and accessibility

Acceptance targets include 1440×900 desktop and 390×844 mobile in both themes, plus tablet inspection.

- No horizontal page overflow.
- Bounded table scroll/disclosure on mobile.
- Touch targets at least 44×44px where practical.
- Consistent 2px focus-visible ring.
- WCAG AA contrast.
- Semantic headings and skip navigation.
- Keyboard operation for menus, tabs, dialogs, sheets, steppers, and theme selection.
- Dialog focus trap/restoration and safe Escape behavior.
- Visible labels and non-color validation.
- Intentional loading, empty, error, disabled, hover, selected, and toast states.

## Governance

PR 1 establishes semantic theme tokens, persistence/no-flash behavior, typography, glass/motion utilities, shared primitives, chart variables, and documentation only. PR 2 implements public routes after PR 1 merges. PR 3 unifies dashboard/auth/Manual Scan after PR 2 merges and the real backend contract is available. No package/lock/backend changes are permitted in this epic stream.
