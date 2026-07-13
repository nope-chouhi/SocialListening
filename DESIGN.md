---
version: "alpha"
name: Cinematic Intelligence
colors:
  primary: "hsl(217.2 91.2% 59.8%)"
  primary-hover: "hsl(213 94% 68%)"
  primary-foreground: "hsl(222.2 47.4% 11.2%)"
  light-background: "hsl(40 33% 97%)"
  light-surface: "hsl(0 0% 100%)"
  light-foreground: "hsl(222 47% 9%)"
  light-muted: "hsl(215 16% 45%)"
  light-border: "hsl(215 22% 86%)"
  light-editorial: "hsl(30 12% 28%)"
  dark-background: "hsl(224 46% 7%)"
  dark-surface: "hsl(222 39% 11%)"
  dark-elevated: "hsl(219 31% 15%)"
  dark-foreground: "hsl(42 38% 94%)"
  dark-muted: "hsl(215 16% 60%)"
  dark-border: "hsla(0 0% 100% / 0.12)"
  dark-editorial: "hsl(42 46% 88%)"
  success: "hsl(158 64% 35%)"
  warning: "hsl(35 92% 42%)"
  danger: "hsl(0 72% 48%)"
  chart-1: "hsl(217.2 91.2% 59.8%)"
  chart-2: "hsl(188 70% 36%)"
  chart-3: "hsl(158 64% 35%)"
  chart-4: "hsl(35 92% 42%)"
  chart-5: "hsl(0 72% 48%)"
  chart-6: "hsl(272 55% 52%)"
  chart-7: "hsl(203 72% 42%)"
  chart-8: "hsl(326 58% 48%)"
typography:
  marketing-hero:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "5.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  marketing-body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
  dashboard-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  dashboard-body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  dashboard-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  marketing: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  card-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  editorial-dark:
    backgroundColor: "{colors.dark-background}"
    textColor: "{colors.dark-editorial}"
    typography: "{typography.marketing-hero}"
  dashboard-light:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-foreground}"
    typography: "{typography.dashboard-body}"
  dashboard-dark:
    backgroundColor: "{colors.dark-background}"
    textColor: "{colors.dark-foreground}"
    typography: "{typography.dashboard-body}"
---

## Overview

**CINEMATIC INTELLIGENCE** is the unified Nope360 language: premium editorial storytelling for public pages and calm, information-dense analytical UI for authenticated work. Both share one action blue, Inter typography with Vietnamese coverage, semantic states, and accessible interaction behavior.

## Colors

The production Nope360 blue (`#3B82F6`) is the action identity in both themes. Dark public surfaces use warm cream editorial emphasis; light surfaces use deep warm charcoal. Graphite/ivory neutrals provide hierarchy without generic AI-purple branding. Chart colors are theme-adjusted in implementation while retaining semantic series identity.

## Typography

Inter is used for all body copy, forms, controls, tables, and dashboard text. Marketing may create editorial contrast through size, weight, tracking, and italic treatment. A serif is allowed only when already available and verified for Vietnamese glyph coverage, CSP, and performance.

## Layout

Marketing uses narrative sections, generous responsive spacing, short hero lines, and larger radii. Dashboard layouts use stable navigation, compact controls, opaque dense surfaces, clear borders, and predictable geometry. Structured flows use primary/secondary zones and progressive disclosure.

## Elevation & Depth

Glass is restrained to floating navigation, storytelling surfaces, controls, dialogs, and sheets. Dense tables, sidebars, and routine dashboard cards remain opaque. Light mode uses subtle neutral shadows; dark mode relies on surface separation and controlled shadows.

## Shapes

Controls use 6–8px radii, dashboard cards use 12px, elevated surfaces use 16px, and expressive marketing surfaces may use 24px. Pills are reserved for compact status and floating controls.

## Components

Shared primitives define both themes and complete keyboard/focus/disabled/loading/error states. Existing good components are adapted rather than duplicated. Motion primitives are short, non-blocking, and disabled or simplified by `prefers-reduced-motion`.

## Do's and Don'ts

- Do keep public and dashboard surfaces recognizably one product.
- Do use semantic variables and chart tokens.
- Do verify dark/light, mobile/desktop, keyboard, contrast, and reduced motion.
- Do keep copy truthful and repository-grounded.
- Don't use glass everywhere or behind dense data.
- Don't use hero-scale typography in dashboard routes.
- Don't invert light mode, scatter raw colors, or invent capabilities/data.
