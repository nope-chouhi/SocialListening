# Restore Frontend To PR 168

## Requested target

The frontend restoration target is the merged PR #168 state, not a rollback to the state before PR #168.

- PR #168 title: `feat: ship Nope360 design foundation PR1`
- PR #168 source/merged commit used as tree source: `59177c8`
- Branch base: latest `origin/main` at `9e3ef2699b6607b7f62d2f7ab9c883ab6af12cdc`
- Restore command: `git restore --source=59177c8 --staged --worktree -- frontend`

## Verification

- Tracked frontend file count at `59177c8`: 155
- Current tracked frontend file count after restore: 155
- `git diff --exit-code 59177c8 -- frontend`: passed, no output
- Frontend file list comparison between `59177c8` and the restored working tree: passed, no differences
- `git diff --exit-code origin/main -- backend`: passed, no output
- CRM repository: not modified
- Deployment: not run

## Build

Command:

```bash
cd frontend
npm run build
```

Result: passed.

Build warning:

- Next.js inferred `C:\Users\hongu\pnpm-lock.yaml` as workspace root because multiple lockfiles exist.

Routes emitted by the build included:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/mentions`
- `/dashboard/reports`
- `/dashboard/settings`
- `/dashboard/settings/ai`

## Additional checks

`npm run type-check`: failed on existing test globals in `frontend/src/lib/utils/mentions.test.ts`:

- `describe`
- `it`
- `expect`

`node scripts/check-i18n-keys.mjs`: failed because `th`, `ja`, `ko`, and `zh` are missing 105 keys relative to `vi`.

`npm run lint`: blocked by the interactive Next.js ESLint setup prompt. No ESLint config was created.

## Browser verification

Local frontend dev server:

- `http://127.0.0.1:3000`

Desktop browser checks:

- `/`: rendered the PR #168 premium public landing page.
- `/login`: rendered the Nope360 login form.
- `/register`: rendered the registration form.
- `/dashboard`: redirected to `/login` because no real authenticated local session was available.
- `/dashboard/mentions`: redirected to `/login`.
- `/dashboard/reports`: redirected to `/login`.
- `/dashboard/settings`: redirected to `/login`.
- `/dashboard/settings/ai`: redirected to `/login`.

Mobile browser checks at 390x844:

- `/`: rendered without horizontal overflow.
- `/login`: rendered without horizontal overflow.
- `/register`: rendered without horizontal overflow.
- `/dashboard`: redirected to `/login`.

No new fatal browser console errors were observed on the checked public/auth routes.

Dashboard sidebar/header, dark mode controls, and dashboard language switcher could not be runtime-verified after login because the configured local backend `http://127.0.0.1:8000` was unavailable and no real authenticated local session was available. No fake token, fake API response, or mock dashboard data was used.

## Intentional frontend rollbacks

Because the tracked `frontend/` tree is restored exactly to `59177c8`, later frontend-only changes from `origin/main` are intentionally removed from this branch. Affected areas include:

- Later dashboard layout and metric component changes.
- Later login/register/page styling changes.
- Later landing-page and motion component changes.
- Later theme provider, theme toggle, and language switcher changes.
- Later assistant page frontend changes.
- Later UI component styling changes in `AppButton`, `AppCard`, `MetricCard`, and `PageHeader`.
- Later Tailwind configuration changes.

These changes were not selectively preserved, by design, because the requested target is exact PR #168 frontend state.
