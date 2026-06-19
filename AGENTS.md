# Core Project Rules for Coding Agents (Antigravity)

- Main branch is protected.
- Never push directly to main.
- Always create a branch from latest main.
- All changes must go through Pull Request.
- Do not commit, push, merge, deploy, or run deploy.bat without explicit user approval.
- Do not include frontend/tsconfig.tsbuildinfo.
- Do not include temporary scripts or fix_*.py.
- Preserve working modules.
- Do not create fake UI/data/API/AI.
- Do not create fake neutral sentiment.
- If AI fails, mark failed clearly; do not create successful neutral records.
- Always run backend compile, backend import smoke test, frontend type-check, and frontend build before reporting complete.
- Restore frontend/tsconfig.tsbuildinfo before commit.
