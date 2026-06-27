# PR Workflow Rule - Social Listening / Nope

## Workflow contract (high priority)
- Pull latest `main` before starting work.
- Create a dedicated branch from `main` for the task.
- Code, add or update only relevant files, run minimal verification, then commit and push the branch.
- After push: stop. Do not create a PR yet.
- Do not merge any PR unless the user explicitly confirms and checks have passed.

## Confirmation gates
1. After push, report completion with the required fields and ask the user whether to create a PR.
2. Only create a PR after the user explicitly says yes.
3. Only merge a PR after the user explicitly says yes and required checks have passed.

## Pre-PR handoff (branch ready)
Report:
- Branch
- Commit hash
- Files changed
- Docs updated
- Tests run
- Pass/fail
- Risks/notes
- Ask: create PR?

## After user confirms PR creation
Create the PR, then report the PR URL and open any review/checks required.

## Mandatory branch rules
1. Never work directly on `main`.
2. Always create a feature/fix branch from latest `main`.
3. Keep each branch focused on one issue.
4. Commit only intended files.
5. Push branch before creating PR.

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
- Run frontend type-check/build.

Backend changes:
- Run `python -m compileall app` or relevant backend tests.

Full-stack changes:
- Run both frontend and backend checks when needed.

Browser/runtime changes:
- Do not claim runtime verification unless actually tested in browser.
- If not tested, state: "Code-level verification only; runtime browser verification required before merge."

## Documentation rule
Every code task must add or update at least one relevant `.md` file when changes affect behavior, API, workflow, or setup.
- No fake docs.
- No unrelated/extra docs beyond what the task requires.

## Deployment
Do not run `deploy.bat`, deploy scripts, production migrations, or production restarts unless explicitly requested by the user.

Do not tell the user to run `deploy.bat` automatically after every merge. Render/Vercel auto-deploy from `main` may be sufficient.
