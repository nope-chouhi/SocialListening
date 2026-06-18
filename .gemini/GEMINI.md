# Social Listening Platform / Nope - Agent Rules

## 1. Project Identity
- Project name: Social Listening Platform / Nope.
- Backend: FastAPI, Python, PostgreSQL, Alembic.
- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui.
- Hosting: Render backend/database, Vercel frontend.
- TH workflow uses Antigravity only.

## 2. Safety and Preservation
- Preserve all completed and working features.
- Do not rewrite or refactor stable modules unless explicitly requested.
- Do not break existing Auth, RBAC, Dashboard, Mentions, Alerts, Incidents, Keyword/Source CRUD, Admin Settings, Personal Settings, or deployment flows.
- Any change must be minimal, targeted, reversible, and compatible with the current architecture.
- New updates must not change, break, or negatively affect stable completed parts.

## 3. No Fake Implementation
- Do not create fake UI.
- Do not create fake data.
- Do not create dummy API responses.
- Do not create placeholder backend logic.
- Do not simulate production success.
- Do not hide real errors behind fake success messages.
- Development-only temporary logic must be clearly marked and must not be presented as production-ready.

## 4. Production Blockers
- The dummy AI analysis function is obsolete and must not be expanded.
- Future AI analysis must use a real provider such as OpenAI, Gemini, or Anthropic.
- Automated scanning must use a real observable background job system such as APScheduler or Celery.
- Notifications must send real emails and real webhooks using real dispatch logic.
- Reports should eventually support real PDF/Excel export.
- Crawling must clearly distinguish simple static scraping from dynamic JavaScript-heavy crawling.

## 5. Database and API Safety
- Do not drop tables or columns without explicit approval.
- Do not rewrite Alembic migration history.
- Do not change API response contracts without updating all dependent frontend code.
- Preserve backward compatibility whenever possible.

## 6. Frontend Safety
- Do not replace working pages with placeholder screens.
- Do not hide errors by showing fake success states.
- Do not break dark mode.
- Do not break layout.
- Do not break pagination, filters, mention cards, dashboard cards, or existing RBAC UI checks.

## 7. Git and Deployment
- Never commit automatically unless explicitly instructed.
- Never push automatically unless explicitly instructed.
- Never force push.
- Never bypass branch protection.
- Never bypass deploy.bat safety checks.
- If deploy.bat blocks deployment because the branch is main or master, stop and report it clearly.
- Do not run deploy.bat for governance/rule-only tasks unless explicitly requested.

## 8. Documentation and Files
- Do not create new documentation or guide files unless explicitly requested.
- Rule/config files are allowed only when the task is specifically about agent governance.
- Do not delete project specs, agent configs, or historical task files without explicit approval.
- Do not blindly ignore the entire `.kiro/`, `.cursor/`, or `.gemini/` folder.

## 9. Verification
Before reporting completion, run applicable checks:
- `python -m compileall backend/app`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run build`
- `git status`

For governance/rule-only changes, runtime checks are optional if no source code changed, but `git status` is mandatory.
