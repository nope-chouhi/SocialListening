# Dashboard Theme Contrast Fix

## Original Issue
The user identified severe UI contrast issues across the dashboard layout in both Light and Dark modes:
1. **Light Mode Sidebar:** The left sidebar brand/project area had poor contrast. The "Nope" brand text, project icon, project name, and section labels were visually buried.
2. **Dark Mode Dropdown:** The top-right appearance dropdown (Light/Dark/System) was hard to read and partially hidden because the menu items did not have clear contrast against the dropdown background.

## Files Changed
- \rontend/src/app/dashboard/layout.tsx\
- \rontend/src/components/ThemeToggle.tsx\

## What Contrast Classes Were Fixed
### Sidebar (\layout.tsx\)
The sidebar is intentionally permanently dark (\g-[#0D1117]\). However, text elements inside were using responsive dark mode classes (e.g., \	ext-slate-900 dark:text-white\). In Light mode, \	ext-slate-900\ was applied, rendering almost black text on an almost black background.
- Fixed by removing \dark:text-white\ overrides.
- Enforced absolute \	ext-white\ for the brand N logo, project names, and chevron hovers.
- Improved the dim \	ext-zinc-600\ section headers (Projects, Workspace, Reports, System) to a more readable \	ext-slate-400\.

### Theme Dropdown (\ThemeToggle.tsx\)
The dropdown menu items had conflicting dark mode text classes (\dark:text-slate-700 dark:text-gray-300\). The darker slate class took precedence, making the text unreadable on the dark background.
- Fixed by removing the conflicting \dark:text-slate-700\.
- Removed a conflicting \dark:border-slate-300\ that made the dropdown border too bright.

## Manual Verification Checklist
- [x] **Light Mode:** Sidebar brand "Nope", project label/section, project icon, and project name are readable. Sidebar section headers are readable. Theme dropdown items are readable.
- [x] **Dark Mode:** Sidebar brand/project area is readable. Theme dropdown background, text, icons, border, hover states are readable. Light/Dark/System options are clearly visible.
- [x] **System Mode:** Dropdown remains readable. Sidebar remains readable.
- [x] **Hover states:** Sidebar project rows and theme dropdown items have clear hover states.
- [x] **Selected state:** Active theme item is visually clear.

## Limitations
- System mode verification behavior depends entirely on the host OS/browser settings. If the host environment cannot be toggled during manual testing, System mode acts strictly as whatever the host prefers. The component itself uses standard \
ext-themes\ behavior which correctly queries \(prefers-color-scheme: dark)\.
