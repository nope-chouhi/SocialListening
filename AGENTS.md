# AGENTS.md - Social Listening / Nope

## Project Overview

This repository contains the Social Listening Platform, also branded as Nope.

The system monitors keywords across RSS, web/news sources, and other external sources. It supports project-based monitoring, mentions, sentiment/risk analysis, alerts, reports, admin settings, RBAC, and scheduled/manual scanning.

## Tech Stack

- Frontend: Next.js / React / Tailwind CSS, hosted on Vercel.
- Backend: Python FastAPI, SQLAlchemy, Alembic, hosted on Render.
- Database: PostgreSQL.
- Cache/search/job support may include Redis, Meilisearch, and background workers depending on environment.
- Development target: Windows without Docker unless explicitly requested.

## Core Working Principles

1. Keep stable working features locked.
   - Do not refactor unrelated modules.
   - Do not change working pages, APIs, models, migrations, or UI flows unless directly required by the task.
   - Avoid broad rewrites.

2. No fake behavior.
   - Do not create fake UI, fake API responses, fake mentions, fake charts, fake scan results, fake AI results, or dummy data presented as real.
   - If a feature cannot be implemented with real data, report the limitation clearly.

3. Scope discipline.
   - Fix only the issue requested by the user.
   - Do not opportunistically clean up unrelated code.
   - Do not change branding, layout, RBAC, dashboard, mentions, scanner, reports, login/auth, or settings unless the task directly requires it.

4. Preserve production behavior.
   - Do not break Render/Vercel deployment assumptions.
   - Do not introduce Docker unless explicitly requested.
   - Do not hardcode local URLs, secrets, tokens, or environment-specific values.

5. Environment and secrets.
   - Never commit `.env`, secrets, API keys, local database files, generated logs, or temporary artifacts.
   - Never expose credentials in code, logs, PR bodies, or comments.

## Git and PR Workflow

Always use Pull Request workflow.

1. Start from latest main:
   - Check current branch.
   - Fetch latest main.
   - Create a dedicated branch from latest main.

2. Never push directly to main.

3. Commit only intended files.

4. Before commit, check:
   - `git status --short`
   - `git diff --stat`
   - Review exact files changed.

5. Never commit:
   - `frontend/tsconfig.tsbuildinfo`
   - `.env`
   - local DB files
   - generated caches
   - logs
   - `deploy_trigger.txt`
   - temporary scripts
   - implementation scratch files
   - unrelated markdown artifacts unless explicitly requested

6. Create a PR into main.

7. Do not merge automatically.

8. Before reporting done, provide:
   - Branch name
   - Commit hash
   - PR URL if available
   - `git status --short`
   - `git diff --stat main...<branch>`
   - Files changed
   - Commands/tests run
   - Risks/notes
   - Manual verification still required, if applicable

For Telegram/default reporting, also follow the **Concise Reporting Style** subsection in this file. That concise style is the default for short status updates and questions. Detailed logs are only sent on request or when the error truly needs debugging.

## Concise Reporting Style
Default output style for Telegram and for reports/questions back to the user.

Rules:
- Ngắn gọn, tổng quan, đi thẳng vấn đề.
- Ưu tiên format dễ đọc.
- Có thể dùng emoji nhẹ: ✅ ⚠️ ❌ 🔧 🚀, không lạm dụng.

Success format:
- ✅ Xong
- Branch / commit / PR nếu có
- Tests/checks
- Còn rủi ro gì không

Asking format:
- Chỉ hỏi đúng 1 câu quan trọng nhất.

Rules:
- Chỉ gửi log/chi tiết dài khi user yêu cầu hoặc khi lỗi thực sự cần debug.
- Nếu có lỗi, chỉ trích dòng lỗi chính + file/dòng liên quan.
- Không nói dài kiểu “mình sẽ tiếp tục…” nếu không cần.
- Với lỗi nhỏ Hermes tự xử lý được: không hỏi, chỉ báo kết quả cuối vòng fix.
- Với quyết định lớn (merge/deploy/restart/migration/env/secrets): hỏi ngắn gọn.

## Deployment Rule

Do not run `deploy.bat` unless the user explicitly asks for manual deployment, auto-deploy is disabled/failing, or the task specifically requires manual deployment verification.

Do not add blanket instructions telling the user to run `deploy.bat` after every merge. Render/Vercel auto-deploy from main may be sufficient.

## Verification Rules

Use the smallest relevant verification set.

Frontend:
- Prefer:
  - `npm run type-check`
  - `npm run build`
  - or the project's existing frontend check command
- Do not commit `frontend/tsconfig.tsbuildinfo`.

Backend:
- Prefer:
  - `python -m compileall app`
  - existing backend tests if present and relevant
- If backend code is not touched, do not run unnecessary backend checks.

Full-stack:
- If API contract changes, verify both backend and frontend compile/type checks.

Runtime:
- If browser behavior is involved, clearly distinguish:
  - code-level verification
  - actual runtime/browser verification
- Do not claim runtime verification if no browser was opened.

## PR Summary Requirement

Whenever the work reaches PR-ready state, provide a copy-ready PR summary including:

- PR title
- Summary
- Files changed
- Technical changes made
- Verification commands/results
- Risks or notes
- Checklist
- Manual verification steps, if needed

Do not leave the PR body empty.

## Coding Constraints

1. Prefer minimal, targeted changes.
2. Keep existing architecture and naming conventions.
3. Do not add new dependencies unless strictly necessary.
4. If adding a dependency is unavoidable, explain why.
5. Avoid changing public API contracts unless required.
6. If an API contract changes, update all callers consistently.
7. Keep error handling explicit and user-facing messages accurate.
8. Do not suppress errors silently.
9. Do not hide backend failures behind fake frontend states.

## Social Listening Specific Rules

1. Search and mentions:
   - Do not match user search terms against URL fields, raw payload, metadata JSON, encoded redirect IDs, or unrelated cache data.
   - Match search terms only against title, description/snippet, normalized content, and intentionally supported text fields.
   - "Matched in" labels must reflect actual matched fields.

2. Ad-hoc search:
   - A new keyword typed by the user must be treated as the active search context.
   - Do not require a keyword to already exist in DB before scanning/searching.
   - Do not silently attach ad-hoc results to the wrong project keyword.
   - Reset stale mention/job state when a new search starts.

3. Google News/RSS:
   - Google News RSS links are discovery links, not final article URLs.
   - Visit links should open original publisher URLs.
   - If the original URL cannot be resolved, hide/disable Visit or mark the link invalid.
   - Do not show broken `news.google.com/rss/articles/...` links as final Visit URLs.

4. Auth/login:
   - Login submission must not be blocked by `/health`.
   - Health checks may show warnings but must not prevent `POST /auth/login`.
   - Clear stale auth/session state safely when needed.
   - Avoid infinite 401/redirect loops.

5. API routing:
   - Production frontend should call the intended backend API base URL.
   - Avoid unnecessary Vercel proxying for backend scan/job/status APIs unless explicitly required.
   - Preserve local development behavior.

6. RBAC:
   - Admin and normal-user permissions must remain separated.
   - Normal users must not see admin-only controls.

## Documentation Rule

Do not create new documentation, guide, walkthrough, or markdown files unless explicitly requested by the user or required for agent governance.

This setup task is explicitly allowed to create/update:
- AGENTS.md
- .agents/rules/pr-workflow.md

Do not create extra docs beyond those files.

# Hermes Operating Rules for SocialListening

## Project Identity
This repository is the Nope Social Listening Platform.
Goal: build a real AI Social Listening / Brand Monitoring platform, not a fake demo.

Frontend:
- Next.js / React / Tailwind CSS

Backend:
- FastAPI / SQLAlchemy / PostgreSQL / Alembic

Deployment:
- Frontend: Vercel
- Backend: Render
- Database: Render Managed PostgreSQL

## Core Product Rules
- Data Quality > Data Quantity.
- Trust > Fancy AI.
- Source Coherence > UI Beauty.
- Correctness > Demo Speed.
- Never fake data, fake APIs, fake exports, fake reports, or dummy UI behavior.

## Git Workflow
- Never commit directly to main.
- Always pull latest main before starting work.
- Create a separate branch for every task.
- Commit only relevant files.
- Push the branch.
- Do not create PR or merge automatically after coding.
- After implementation and tests, stop and ask the user for confirmation.
- Only create PR and merge if the user explicitly agrees and tests pass.

## Task Mode: Plain-language task mode & autonomous short commands

This project supports two operative modes for `SocialListening`.

### A. Plain-language task mode
- Treat short user messages as direct repo tasks.
- Inspect source first to find related files instead of asking.
- Use the project's existing workflow automatically: latest main, focused branch, minimal fix, docs when required, relevant tests, commit and push.
- Default after push: do **not** create PR/merge unless explicitly confirmed.

### B. Short Command Aliases
Use these recognized phrases as direct commands.

| Phrase | Behavior |
|---|---|
| "tự fix đi" | On the current task/branch/PR: read Vercel/Render/GitHub logs, identify build/type/runtime errors from logs, fix small clear errors, run verification, commit, push, and recheck preview/health. Do not stop at each small error. Repeat until the branch preview/check passes or hits a hard blocker. Do not ask for per-error confirmation. |
| "làm tiếp đi" | Continue the current unfinished task on the current branch. Always run `git status` first, do not discard uncommitted work, and continue under the project rules. |
| "check deploy đi" | Read-only status check of Vercel frontend preview and Render backend health/log. Do not manually deploy, restart, or run migrations. Report status clearly. |
| "tạo PR đi" | Create or update PR from current branch into main and report PR URL, summary, files changed, tests/checks, and risks. Do not merge. |
| "merge đi" | Merge only if PR checks pass or user explicitly accepts risk. Prefer squash merge. Do not force manual deploy unless requested. |
| "dừng lại" | Stop the current task. Report branch, current status, changed files, current commits/pushes. Do not delete anything. |

**Allowed autonomous actions** (no confirmation required):
- Pull latest main and create/update task branch
- Read Vercel preview logs (read-only)
- Read Render health/log/status (read-only)
- Read GitHub PR/checks status
- Fix clearly identified small errors: TypeScript/imports/missing types/build/lint/runtime errors with obvious cause
- Run relevant verification
- Commit and push fixes
- Create or update PR description/body; add/update docs when required

**Still require explicit user confirmation before acting on**:
- Merging to main
- Manual deploy/restart/migration on production
- Changing env/secrets/config with production impact
- Any action with data loss risk
- Adding large new dependencies or changing major architecture
- Any step that cannot be justified from source/log inspection

**Stopping rules for autonomous loops**:
- Stop if verification still fails after non-trivial retry and the failure requires architectural/product decision
- Stop if the error is not clearly identified from logs/source after reasonable inspection
- Ask the user only when a decision is genuinely ambiguous or risky

## Deployment Rules
- Do not run deploy.bat, deploy scripts, production migrations, or production restarts unless explicitly requested.
- Assume Render/Vercel auto-deploy after merge unless the user asks for manual deployment verification.

## Safety Rules
- Preserve stable completed modules.
- Do not delete untracked setup/tooling files without asking.
- If root-level package.json/package-lock.json or Playwright/tooling files appear, inspect and explain first.
- Keep files maintainable; prefer splitting very large files when practical.

## Required Completion Report
For every coding task, report:
- Summary of changes
- Files changed
- Tests run
- Risks or notes
- Whether it is ready for PR
- Ask for user confirmation before PR/merge
