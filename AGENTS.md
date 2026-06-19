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

## Pull Request Handoff Requirement

Before asking the user to create a Pull Request, the agent must output a complete, ready-to-copy Pull Request description in markdown. This description must include:
- PR title
- PR summary
- Files changed
- Technical changes made
- Verification commands/results
- Risks or notes
- Checklist status
- Recommended PR body in markdown
- Confirmation that no deploy.bat was run
- Confirmation that no direct push to main was performed
