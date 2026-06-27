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

Before PR/merge, report the required fields. For Telegram/default updates, also follow the **Concise Reporting Style** section below; use detailed logs only when needed for debugging or when explicitly requested.

Required fields:
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

## Deployment

Do not run `deploy.bat` unless explicitly requested.

Do not tell the user to run `deploy.bat` automatically after every merge. Render/Vercel auto-deploy from main may be sufficient.

## Autonomous Fix Loop & Short Command Aliases

Recognized short phrases act as direct commands and must not require long user prompts.

Recognized phrases:
- `tự fix đi` — inspect logs, fix build/type/runtime errors, verify, commit, push, recheck preview/health automatically
- `làm tiếp đi` — continue current branch safely, validate git status first, do not discard work
- `check deploy đi` — read-only status checks for Vercel preview and Render health/log
- `tạo PR đi` — create/update PR into main with URL, summary, files changed, tests/checks, risks
- `merge đi` — merge only when checks pass or user confirms; prefer squash merge
- `dừng lại` — stop current task; report branch/status/files/commits without deleting anything

Autonomous loop requirements:
- Continue fix/push/check until:
  - checks pass, or
  - failure is not a small/locally fixable error, or
  - retry becomes non-trivial
- Fix small clear errors only: TypeScript errors, import/name mismatch, missing types/fields, build/lint/runtime errors with clear cause from logs
- Do not perform non-reversible or architectural/product-level changes without confirmation

Ask the user only when:
- merge/main or production deploy is needed
- env/secrets/config changes are required
- data loss risk exists
- large dependency/architecture changes are implied
- the request remains ambiguous after source/log inspection
