# Selective Premium UI Rollback

## Production-visible symptoms

The production frontend showed an unintended premium redesign across the public entry route, login/register, dashboard shell, and dashboard visual density:

- Public route displayed a sparse "signal cockpit" presentation.
- Login/register forms were visually sparse with excessive empty space.
- Dashboard shell used premium depth/backdrop styling and abnormal spacing.
- A floating AI assistant widget appeared even though the frontend assistant UI was not part of the approved backend AI migration scope.

## Baseline and broad rollback

- Stable visual reference: `021f6c5`.
- Broad local rollback branch: `fix/restore-frontend-pre-premium-ui`.
- Broad rollback commit: `c584afb76affa1314f7ca340ef50a7b7facc5431`.
- Broad rollback changed 43 frontend files and was rejected because it could remove valid functional fixes added after `021f6c5`.

## Frontend commit audit

| Commit | Title | Classification | Decision | Risk |
| --- | --- | --- | --- | --- |
| `05daa65` | `feat(ui): add premium public landing page` | Visual redesign | Roll back public premium landing behavior | Low; route returns to prior auth redirect behavior |
| `81e3bc4` | `fix(mentions): harden search and filter behavior` | Functional fix | Preserve | Mentions behavior should remain current |
| `3f0f310` | `fix(reports): polish analytics and report experience` | Mixed/report functional and visual | Preserve | Avoid removing report/export behavior |
| `9e0e468` | `fix(ui): polish dashboard app shell experience` | Mixed shell visual and labels | Mostly preserve; later premium shell classes removed manually | Avoid losing nav/i18n polish |
| `39edef6` | `feat(ui): introduce premium 3d-inspired frontend experience` | Visual redesign | Selectively roll back premium shell, dashboard cards, landing, login styling, global CSS, UI primitives | Medium; visual-only files reviewed |
| `8457cdb` | `fix(ui): repair dashboard layout regression` | Visual bug fix | Preserve except superseded visual primitives | Low |
| `3728a88` | `fix(ui): improve MVP route readiness` | Mixed route/auth layout | Preserve functional route/auth behavior | Medium if reverted broadly, so not broadly reverted |
| `c0476d3` | `fix(auth): restore reliable login session flow` | Functional auth fix | Preserve | High; not reverted |
| `14e7c31` | `fix(mentions): improve saved filter and empty state flow` | Functional fix | Preserve | High; not reverted |
| `0f89551` | `fix(mentions): clear legacy keyword on saved filter apply` | Functional fix | Preserve | High; not reverted |
| `69e87e1` | `fix(reports): make infographic layout responsive on mobile` | Functional/responsive fix | Preserve | Medium; not reverted |
| `59177c8` | `feat: ship Nope360 design foundation PR1` | Visual foundation redesign | Selectively roll back global CSS, theme/toggle, UI primitives, motion helper, login/register visual changes | Medium; no auth/API logic reverted |
| `b403f32` | `Feat/migrate crm ai subsystem clean (#169)` | Backend AI plus unapproved frontend assistant UI | Preserve backend via `origin/main`; remove frontend AI widget/page/API helper/locale additions from rollback branch | Medium; backend AI untouched |

## Visual changes reverted

- Removed premium public landing component and returned `/` to the previous auth-check redirect behavior.
- Removed premium motion helper used by the redesign.
- Restored global CSS and Tailwind visual foundation from the stable baseline.
- Restored normal login/register sizing and card proportions.
- Restored dashboard metric/card/page header visual primitives to pre-premium scale.
- Removed premium dashboard shell classes such as depth/backdrop/edge styling while keeping current auth/session logic.
- Removed the unapproved floating AI assistant widget.
- Removed frontend AI chat API helper and assistant locale additions introduced by the backend AI migration PR.

## Functional fixes preserved

The rollback intentionally did not restore the whole `frontend/` tree from `021f6c5`. It preserves current functional work in:

- Auth session and login redirect handling.
- Mentions saved filters and legacy keyword clearing.
- Reports/export behavior and responsive infographic fixes.
- Current backend API base URL behavior and rewrites.
- Current dashboard routes including services, sources, integrations, project settings, AI settings, and service request routes.
- Current settings and project-selection logic.
- Backend CRM AI migration files.

## Final changed files

The selective rollback changes 32 frontend files, compared with 43 files in the broad rollback. It avoids changing backend files.

## Verification

- `npm run build`: passed.
- Route output includes `/`, `/login`, `/register`, `/dashboard`, `/dashboard/mentions`, `/dashboard/reports`, `/dashboard/settings`, `/dashboard/settings/ai`, and other current app routes.
- `npm run type-check`: still fails on pre-existing `frontend/src/lib/utils/mentions.test.ts` Jest globals.
- `node scripts/check-i18n-keys.mjs`: still fails on pre-existing 105 non-assistant locale gaps in `th`, `ja`, `ko`, and `zh`.
- `npm run lint`: blocked by the repository's existing interactive Next.js ESLint setup prompt.

## Browser verification

Verified against the real local repository app with a local synthetic backend:

- `/` no longer shows the premium signal-cockpit page; it follows the previous auth-check redirect behavior.
- `/login` has normal form sizing and submits successfully.
- `/register` has normal form sizing.
- Successful login redirects to `/dashboard`.
- Dashboard loads with sidebar and current routes.
- Floating assistant widget is absent.
- Mentions, analysis, reports, settings, project settings, AI settings, sources, and integrations routes load.
- Mobile dashboard route loads and exposes navigation controls.

Observed but not caused by this rollback:

- Unauthenticated public routes trigger expected `401` checks from existing `auth.getCurrentUser()` behavior.
- Project settings currently emits a nested-button hydration warning; that file is not changed by this rollback.

## Deployment and rollback considerations

- No deployment was performed.
- No production migration was run.
- No backend AI migration files were changed.
- If the visual rollback causes an unexpected issue, revert this selective rollback commit rather than using the broad 43-file restore branch.
