# Security Hardening and Data Integrity Fixes

**PR branch:** `fix/security-hardening-and-data-integrity`  
**Date:** 2026-06-30  
**Status:** Ready for review

---

## What was fixed

### 1. `/api/debug/migrate` now requires super-admin authentication

**File:** `backend/app/main.py`

The `GET /api/debug/migrate` endpoint previously ran Alembic schema migrations with **no authentication check** and was registered unconditionally — including in production. Any unauthenticated HTTP caller could trigger `alembic upgrade head` on the production database.

**Fix:** Added `Depends(get_current_superuser)` to the endpoint signature. Unauthenticated callers receive `401 Unauthorized`. Authenticated non-admin users receive `403 Forbidden`. Only super-admin users can call it.

No other behaviour changed. The endpoint is still useful for emergency manual migrations after a deploy without going through the Render shell.

---

### 2. Hardcoded admin Gmail removed from startup

**Files:** `backend/app/main.py`, `backend/app/core/config.py`

A literal Gmail address (`honguyenhung2010@gmail.com`) was hard-coded in the server startup lifespan and ran an unconditional `UPDATE users SET is_superuser = true ...` on every cold start and every Render deploy restart. This:

- Embedded a personal email address in public source code.
- Prevented clean account deactivation (the role would be restored on next restart).
- Made it impossible to hand the project to a new team without touching source code.

**Fix:**

- The hardcoded email and the SQL `UPDATE` that referenced it are removed entirely from source.
- A new optional setting `ADMIN_SEED_EMAIL` (type `Optional[str]`, default `None`) is added to `backend/app/core/config.py`.
- The startup block now only runs when `ADMIN_SEED_EMAIL` is non-empty in the environment.
- The `UPDATE` is idempotent: if the user is already `super_admin`, it is a no-op.
- If `ADMIN_SEED_EMAIL` is set but no matching user exists, the server logs a warning and continues — it does **not** crash or create a new user.
- No real email addresses appear anywhere in source code.

**To restore admin access on a deployment:** Set `ADMIN_SEED_EMAIL=your@email.com` in the Render environment variables panel and restart the service. Remove the env var once done.

---

### 3. `GET /api/reports/summary` `top_sources` uses real data

**File:** `backend/app/api/reports.py`

The `top_sources` field previously returned hardcoded fabricated counts:
```python
# Before — fabricated percentages, not real data
{"name": "Facebook", "count": int(total_mentions * 0.5)},
{"name": "News",     "count": int(total_mentions * 0.3)},
{"name": "TikTok",   "count": int(total_mentions * 0.2)},
```

This violated the project rule of no fake data and would mislead users reading the Reports page.

**Fix:** Replaced with a real `GROUP BY source_type` query on the `mentions` table, filtered by tenant (same `apply_tenant_filter` call used throughout the rest of the endpoint). Raw `source_type` values are normalised to human-readable display names using the same mapping convention as `mentions.py`. The result is sorted by count descending. If there are no mentions, `top_sources` returns an empty list.

---

### 4. HTTP 403 Forbidden no longer logs users out

**File:** `frontend/src/lib/api.ts`

The Axios response interceptor previously treated `401 Unauthorized` and `403 Forbidden` identically: both cleared `access_token` from `localStorage` and redirected to `/login?expired=1`. This meant a fully authenticated user who accessed an admin-only page would be silently signed out — confusing behaviour that made it look like their session had expired.

**Semantics:**
- `401 Unauthorized` = the user is **not authenticated** (token missing or expired). Redirecting to login is correct.
- `403 Forbidden` = the user **is authenticated** but lacks permission. The token is valid and should not be cleared.

**Fix:**
- `401` handling is unchanged: clears token, redirects to login, swallows rejection.
- `403` handling is now separate: logs a warning to the console and **rejects the promise normally**. The caller (page component or toast handler) receives the error and can show a "permission denied" message without disturbing the auth session.
- `isAuthError()` helper updated to return `true` only for `401` (semantically correct).
- New `isPermissionError()` helper added for `403` (callers who want to distinguish the two cases).

---

### 5. Runtime-generated files removed from git tracking

**File:** `.gitignore`

Three categories of runtime-generated files that were committed to the repository are now ignored:

| Category | Paths added to `.gitignore` |
|---|---|
| Backend export files | `backend/data/exports/` |
| Backend uploaded logos | `backend/data/uploads/` |
| Playwright session data | `.playwright_github_session/` |
| Frontend Playwright results | `frontend/test-results/` |
| Root-level PR scripts | `create_pr*.mjs` |

The 31 already-tracked binary files (3 `.excel` exports + 28 logo `.png` files) were removed from git tracking with `git rm --cached` — the actual files remain on disk.

---

## What was intentionally deferred

The following items were identified in the project review but are **not** included in this PR due to larger scope or infrastructure dependencies:

| Item | Reason deferred |
|---|---|
| **AI API key encryption at rest** | Requires wiring `TOKEN_ENCRYPTION_KEY` to the `ai_model_config` write/read path; non-trivial and needs careful key rotation strategy |
| **Persistent export storage (S3/R2)** | Requires a new cloud storage dependency and credential management; separate infrastructure PR |
| **Pydantic v2 migration** | Broad codebase change; schema validation behaviour differences need careful testing |
| **Full scratch-file cleanup (history rewrite)** | `git filter-repo` rewrites history and forces all forks/clones to re-clone; needs team coordination and explicit approval |
| **Separate AI provider call deduplication** | `ai_service.py` and `ai_chat.py` both have `_call_ai_provider()` — refactor is low-risk but out of scope for this security PR |
