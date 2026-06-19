# PR Workflow Rule - Social Listening / Nope

## Mandatory Branch Workflow

1. Never work directly on main.
2. Always create a feature/fix branch from latest main.
3. Keep each branch focused on one issue.
4. Commit only intended files.
5. Push branch.
6. Create PR into main.
7. Do not merge automatically.

## Pre-Commit Checklist

Before commit:

- Run `git status --short`.
- Review `git diff --stat`.
- Inspect changed files.
- Restore accidental files.

Never commit:

- `frontend/tsconfig.tsbuildinfo`
- `.env`
- local DB files
- temporary scripts
- logs
- caches
- deploy trigger files
- unrelated docs/artifacts

## Verification

Run only relevant checks.

Frontend changes:
- Run frontend type-check/build command.

Backend changes:
- Run `python -m compileall app` or relevant backend tests.

Full-stack changes:
- Run both frontend and backend checks when needed.

Browser/runtime changes:
- Do not claim runtime verification unless actually tested in browser.
- If not tested, state: "Code-level verification only; runtime browser verification required before merge."

## PR Handoff

Before PR/merge, report:

- Branch
- Commit hash
- PR URL
- Files changed
- `git status --short`
- `git diff --stat main...<branch>`
- Verification commands
- Risks/notes
- Manual verification steps
- Confirmation that no direct push to main was performed
- Confirmation that `deploy.bat` was not run

## Deployment

Do not run `deploy.bat` unless explicitly requested.

Do not tell the user to run `deploy.bat` automatically after every merge. Render/Vercel auto-deploy from main may be sufficient.
