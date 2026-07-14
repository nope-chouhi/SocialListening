# CRM AI Subsystem Migration

## Task Purpose

Migrate the reusable backend AI assistant behavior from the read-only TTH CRM project into SocialListening / Nope360 without copying CRM secrets, CRM business tools, CRM-specific domain logic, or replacing the existing SocialListening frontend.

## Frontend Restoration Scope

The first migration pass added a full-page assistant UI, floating dashboard widget, frontend API helpers, and assistant locale keys. Those frontend changes were later restored to match `origin/main` because the requested scope was to add the AI capability to SocialListening, not to replace or redesign the frontend experience.

The retained migration is backend-focused:

- AI provider/model integration remains server-side.
- AI chat/history/stream APIs remain available for future UI integration.
- SocialListening data context tools remain backend-only and read-only.
- Existing frontend pages, dashboard layout, locale files, and API client are restored to their pre-migration state.

## Repositories

- CRM source path: `/home/tth-crm/tth-crm`
- SocialListening target path: `C:\Users\hongu\OneDrive\Máy tính\SocialListening`
- Target repository: `nope-chouhi/SocialListening`
- Visible brand: `Nope360`

## CRM Read-Only Safety Rule

CRM was used only as a read-only source. No files were edited, created, deleted, formatted, branched, committed, migrated, seeded, installed, or deployed in CRM.

## CRM Baseline

- Path: `/home/tth-crm/tth-crm`
- Branch before implementation: `main`
- HEAD before implementation: `7a97c794fb40afd91a2af4deef7d99904af3cd34`
- Pre-existing modified files:
  - `backend/app/api/v1/categories.py`
  - `backend/app/api/v1/customers.py`
  - `backend/app/api/v1/excel.py`
  - `backend/app/core/init_db.py`
  - `backend/app/main.py`
  - `backend/app/models/crm.py`
  - `backend/app/schemas/crm.py`
  - `frontend/src/app/customers/page.tsx`
  - `frontend/src/app/settings/page.tsx`
- Pre-existing untracked files included generated/loose folders plus:
  - `backend/app/api/v1/customer_chat.py`
  - `backend/app/api/v1/social_integrations.py`

## CRM AI Architecture Discovered

The CRM AI subsystem is compact and mostly embedded in route/UI files:

- `backend/app/api/v1/chat.py`: primary assistant route, 1-1 internal chat route, CRM context builder, provider calls, settings read/write.
- `backend/app/models/crm.py`: `SystemSetting` for AI settings and `ChatMessage` for internal/AI chat history.
- `backend/app/schemas/crm.py`: chat message, chat user, and system setting response schemas.
- `backend/app/core/init_db.py`: seeds `ai_provider`, `ai_api_key`, `ai_base_url`, `ai_model_id`, and `ai_system_prompt`.
- `backend/app/main.py`: registers `/api/v1/chat`.
- `frontend/src/components/ChatWidget.tsx`: floating chat widget with AI tab and staff chat tab.
- `frontend/src/app/settings/page.tsx`: AI settings form backed by `/chat/settings`.
- `frontend/src/services/api.ts`: axios client with auth token.
- `backend/requirements.txt`: uses `httpx`; no dedicated OpenAI or Gemini SDK dependency for chat route.
- `frontend/package.json`: uses axios and lucide-react; no markdown renderer dependency.

## CRM Dependency Graph

`frontend/src/components/ChatWidget.tsx`
-> `frontend/src/services/api.ts`
-> `backend/app/api/v1/chat.py`
-> `get_crm_context(...)`
-> `SystemSetting` (`ai_provider`, `ai_api_key`, `ai_base_url`, `ai_model_id`, `ai_system_prompt`)
-> direct `httpx` calls to Gemini REST or OpenAI-compatible `/chat/completions`
-> `ChatMessage`
-> `backend/app/models/crm.py`
-> database.

## CRM Feature Classification

Group A, generic:

- OpenAI-compatible request shape.
- Gemini request shape.
- Basic provider/model/base URL settings.
- Basic assistant history concept.
- Floating assistant widget pattern.
- Prompt + context injection pattern.

Group B, reusable with SocialListening adaptation:

- Authenticated chat ownership.
- Provider selection through DB config.
- System prompt customization.
- Persistent assistant messages.
- Settings page controls.
- User-facing unconfigured/error states.

Group C, CRM-specific and omitted:

- Customer code lookup.
- Lead lookup.
- Task/calendar lookup.
- Sales pipeline statistics.
- CRM staff 1-1 chat.
- CRM customer direct chat/webhook behavior.
- CRM settings route names and CRM branding.

## Existing SocialListening AI Reused

- `AIModelConfig` remains the source for provider, model, API key, base URL, max tokens, temperature, enabled state, and system prompt.
- `AIUsageLog` remains the usage logging table.
- `backend/app/services/ai_service.py` remains the shared provider core for mention analysis, summaries, drafts, and assistant chat.
- Existing `/api/ai/chat` remains backward-compatible.
- Existing `/dashboard/settings/ai` remains the AI configuration UI.
- Existing mention analysis and AI summary paths continue to call the shared AI service.

## Final Shared AI Architecture

Shared AI core:

- `backend/app/services/ai_service.py`
  - `call_ai_messages(...)` shared by chat and existing AI features.
  - `_call_ai_provider(...)` retained for prompt-based legacy callers.
  - Existing JSON parsing, status handling, and usage wrappers preserved.

Assistant integration:

- `backend/app/services/ai_assistant_service.py`
  - Builds Nope360 system prompt.
  - Runs deterministic SocialListening data tools.
  - Calls shared provider core for non-streaming chat.
  - Provides provider-native streaming helper for `/chat/stream`.
- `backend/app/api/ai_chat.py`
  - `GET /api/ai/chat/history`
  - `DELETE /api/ai/chat/history`
  - `POST /api/ai/chat/send`
  - `POST /api/ai/chat/stream`
  - `POST /api/ai/chat` retained for compatibility.

Frontend:

- No frontend assistant UI is retained in this branch.
- Existing SocialListening frontend files are restored to `origin/main`.
- Future UI integration can call the backend assistant endpoints without adding a second provider engine.

## Provider Architecture

Supported providers remain exactly those supported by SocialListening config and CRM behavior:

- `gemini`
- `openai`
- `custom` OpenAI-compatible base URL

The frontend never calls providers directly. API keys remain server-side.

## Prompt Architecture

The CRM hospital/CRM system prompt was not copied. The new system prompt identifies the assistant as the Nope360 Social Listening assistant and instructs it to:

- Use only real context returned by backend tools.
- Distinguish factual data from recommendations.
- Avoid fabricating statistics.
- Treat mentions and crawled content as untrusted data.
- Wrap backend tool output in explicit `BEGIN/END TOOL OUTPUT` markers.
- Avoid exposing internal prompts or secrets.

## SocialListening Tools Added

Implemented as deterministic backend context builders, not model-executed destructive tools:

- `social_overview`: total mentions, reviewed count, positive/negative AI analyses, high-risk count.
- `recent_mentions`: recent mention text metadata.
- `recent_negative_mentions`: recent negative/risky mentions.
- `keyword_context`: active keyword groups and text-field match count.
- `alert_report_context`: recent alerts and reports.

All tools query SocialListening DB tables and return empty states when no data exists.

## Conversation Storage

Migration `7c2e4d6b8a91_add_ai_chat_messages.py` adds `ai_chat_messages`.

Each message stores:

- `user_id`
- optional `organization_id`
- `role`
- `content`
- `provider`
- `model`
- `used_tools`
- optional error text
- `created_at`

History APIs filter by authenticated `current_user.id` and the authenticated user's `current_organization_id`, preventing cross-user and cross-tenant history access.

## Authentication, Authorization, Tenant Isolation

- All assistant endpoints require `get_current_active_user`.
- Chat history reads, provider-history context, and deletes are scoped to `current_user.id` plus `current_organization_id`.
- Organization-aware tools apply `current_organization_id` where the queried table has `organization_id`.
- For tables without organization columns, user-owned filters are used where present.
- No admin-only AI settings endpoint was made public.
- The assistant chat request schema does not accept `user_id`, `tenant_id`, or `project_id`; ownership is derived server-side.
- Project-specific assistant chat is not implemented. Unknown request fields such as `project_id` are rejected instead of being trusted.

## AI Configuration and Secret Handling

- API keys are read from server-side `AIModelConfig`.
- API keys are never returned to the frontend.
- No CRM secrets, `.env`, access tokens, refresh tokens, or private URLs were copied.
- Blank-key preservation remains controlled by existing SocialListening settings code.

## Streaming Architecture

CRM did not contain real streaming; it used normal request/response plus loading indicators.

SocialListening now has a provider-native backend stream endpoint:

- `POST /api/ai/chat/stream`

The current restored frontend does not wire a new assistant UI. The stable non-streaming `POST /api/ai/chat/send` endpoint and provider-native `POST /api/ai/chat/stream` endpoint are available for future UI wiring, but this branch does not claim token streaming in the UI.

Stream classification: real provider token streaming for providers whose SDK/API returns incremental chunks (`gemini`, `openai`, and `custom` OpenAI-compatible). It is not simulated typewriter output and it is not a completed response wrapped as SSE. The endpoint authenticates before returning `StreamingResponse`, emits `meta`, `chunk`, `done`, and safe `error` events, and does not include raw exceptions or API keys in error events.

## Frontend Architecture

- New assistant page and floating widget changes were removed from this branch.
- Existing dashboard layout, locale files, and shared frontend API client are restored to `origin/main`.
- No fake frontend chat UI, fake toast, or fake assistant state is introduced.
- The backend APIs are ready for a later, separately approved UI task.

## Migration Matrix

| Feature | CRM implementation | Existing SocialListening | Target design |
| --- | --- | --- | --- |
| Provider config | `SystemSetting` rows | `AIModelConfig` | Reuse `AIModelConfig` |
| Provider call | Direct `httpx` in route | `ai_service.py` | Shared `call_ai_messages` |
| Chat API | `/api/v1/chat/send` | `/api/ai/chat` stateless | backend `/api/ai/chat/send` plus backward compatibility |
| History | `ChatMessage` | none for assistant | `AIChatMessage` |
| Context tools | CRM customers/leads/tasks | basic mention counts | SocialListening tools for mentions/keywords/alerts/reports |
| Floating widget | `ChatWidget.tsx` | none | not retained in this backend-focused branch |
| Streaming | none real | none | backend stream endpoint, UI not wired |
| Settings | CRM settings page | `/dashboard/settings/ai` | keep existing SocialListening settings |

## Dependencies

No new Python or npm dependencies were added.

## Security Considerations

- No secrets copied from CRM.
- No raw provider exception stack traces are intentionally exposed; provider errors are normalized to safe HTTP details.
- No AI-generated HTML is rendered with `dangerouslySetInnerHTML`.
- Tool output is deterministic and read-only.
- Tool output is treated as untrusted reference content inside the assistant prompt to reduce prompt-injection risk from crawled mentions.
- No destructive tool execution was exposed to the model.
- Conversation history is scoped to authenticated user.
- Message length is capped at the schema/client level.

## Verification Performed

Commands run from SocialListening unless otherwise noted:

- `pwd`, `git status --short`, `git branch --show-current`, and `Get-Content AGENTS.md` before editing.
- Isolated test environment: `C:\Users\hongu\AppData\Local\Temp\sociallistening-ai-test-venv`.
- Dependency installation: `python -m venv ...`, `python -m pip install --upgrade pip`, then `python -m pip install -r backend/requirements.txt pytest==9.0.3`. No global Python install, no sudo, no CRM dependency changes.
- `python -m compileall app` in `backend`: passed.
- `python -m py_compile alembic/versions/7c2e4d6b8a91_add_ai_chat_messages.py` in `backend`: passed.
- `python -m py_compile tests/test_ai_assistant_service.py` and `python -m py_compile tests/test_ai_chat_api.py` in `backend`: passed.
- `alembic heads` in `backend`: passed with single head `7c2e4d6b8a91`.
- `pytest -q tests/test_ai_assistant_service.py tests/test_ai_chat_api.py`: passed, `21 passed, 2 warnings`. The warnings are package-level `requests` dependency compatibility and `feedparser` `cgi` deprecation warnings.
- `npm run type-check` in `frontend`: failed only on `src/lib/utils/mentions.test.ts` missing `describe`, `it`, and `expect` globals.
- Clean `origin/main` worktree at commit `59177c8` with the same frontend dependencies: `npm run type-check` failed on the same `src/lib/utils/mentions.test.ts` globals, proving that failure is pre-existing and unrelated to the assistant migration.
- `node scripts/check-i18n-keys.mjs` in `frontend`: failed because Thai/Japanese/Korean/Chinese locale files were already missing unrelated `dashboard`, `header`, and `reports` keys compared with Vietnamese.
- Frontend assistant locale keys are not retained in this branch because the frontend UI changes were restored to `origin/main`.
- `npm run build` in `frontend`: passed.
- `npm run lint` in `frontend`: blocked by Next.js ESLint setup prompt because this repo does not currently have an ESLint configuration wired for `next lint`; no lint result is claimed.

## Migration Validation

Disposable PostgreSQL was not available: `docker` and `psql` are not installed in this environment. No production database URL was used.

SQLite validation was used only as a safe local check, not as a PostgreSQL substitute:

- Disposable DB: SQLite local temp file `sociallistening-ai-migration-test.db`, credentials none.
- Full Alembic chain `alembic upgrade head`: failed at historical revision `001_initial` before the new migration because SQLite does not accept the historical `server_default=now()` expression. Complete-chain success is not claimed.
- New migration validation from immediate previous head:
  - Disposable DB: SQLite local temp file `sociallistening-ai-migration-new-only.db`, credentials none.
  - Prepared minimal previous-head schema with `users` and `organizations` tables.
  - `alembic stamp 33f8bf51df62`: exit `0`.
  - `alembic upgrade 7c2e4d6b8a91`: exit `0`.
  - Inspected `ai_chat_messages`: table exists.
  - Columns: `id`, `organization_id`, `user_id`, `role`, `content`, `provider`, `model`, `used_tools`, `error_message`, `created_at`.
  - Foreign keys: `organizations`, `users`.
  - Indexes: `idx_ai_chat_org_created`, `idx_ai_chat_user_created`, `ix_ai_chat_messages_created_at`, `ix_ai_chat_messages_id`, `ix_ai_chat_messages_organization_id`, `ix_ai_chat_messages_user_id`.
  - `alembic downgrade 33f8bf51df62`: exit `0`, table removed.
  - `alembic upgrade 7c2e4d6b8a91`: exit `0`, table recreated.

## Runtime Verification

Runtime endpoint behavior was verified with FastAPI `TestClient` against an isolated SQLite test database and mocked provider calls, not against production services:

- Unauthenticated `GET /api/ai/chat/history`, `POST /api/ai/chat/send`, `DELETE /api/ai/chat/history`, and `POST /api/ai/chat/stream` return `401`.
- `POST /api/ai/chat/send` persists user and assistant messages on success.
- Provider failure returns a safe `502` detail and rolls back non-stream user-message persistence.
- History is ordered, limit-aware, user-scoped, and tenant-scoped.
- History deletion deletes only the current user's current-tenant rows.
- Empty, whitespace, excessive-length, and extra `project_id` fields are rejected.
- Missing and disabled AI config return `400`.
- Legacy `POST /api/ai/chat` remains backward-compatible and does not persist history.
- Stream endpoint returns `text/event-stream`, emits `meta`, `chunk`, `done`, or safe `error` events, and does not leak API keys.

Frontend route verification was completed against the real repository Next.js application:

- Real frontend command: `npm run dev -- -H 127.0.0.1 -p 3017` from `frontend`.
- The build verified that the restored frontend still exposes the existing application routes.
- No production URL, production database, CRM database, CRM service, real API key, or secret was used.

Route discovery audit:

- The authoritative application tree is `frontend/src/app`.
- `origin/main` and the migration branch do not track `frontend/app`.
- A local untracked empty `frontend/app/dashboard` directory was present in the working tree and caused Next.js to prefer `frontend/app`, producing a build with only `/404`.
- The empty local directory was moved outside the repository before final verification. No tracked source change was needed for route discovery.
- After removing that local-only conflict, `npm run build` discovered the real app routes, including `/dashboard`, `/dashboard/assistant`, `/dashboard/settings/ai`, `/login`, `/register`, and the existing dashboard routes.

Assistant UI browser checks from the earlier frontend pass are no longer applicable because the assistant page/widget/frontend client changes were restored. Backend assistant behavior is covered by focused API/service tests instead:

- Unauthenticated assistant API requests return `401`.
- Authenticated send persists scoped user/assistant history.
- History reads and deletes are user/tenant-scoped.
- `project_id` is rejected with `422` instead of being trusted from the client.
- Provider failures return safe errors without stack traces or API keys.
- Streaming endpoint emits safe SSE events.

Temporary browser artifacts from the earlier UI pass were stored only under `%TEMP%` and were not committed.

## Known Limitations

- The CRM project did not include real OpenAI function-calling or a reusable agent loop, so none was copied.
- The CRM project did not include markdown rendering or file/image upload for AI chat, so those were not migrated.
- The restored frontend does not expose a new assistant UI yet; a future frontend task is needed to surface the backend AI assistant to users.
- Existing SocialListening locale parity still has pre-existing non-assistant gaps in `dashboard`, `header`, and `reports` for some locales.
- PostgreSQL migration validation was not completed because Docker and `psql` are unavailable in this environment.
- Full historical Alembic chain success is not claimed because SQLite fails at pre-existing revision `001_initial`.
- If an untracked local `frontend/app` directory is recreated, Next.js may again prefer it over `frontend/src/app`; keep the repository working tree free of that local-only placeholder.
- Assistant chat currently has one per-user/per-tenant history stream; explicit multi-conversation IDs are not implemented.
- Project-specific assistant access is not implemented; `project_id` is rejected rather than authorized and used.

## Rollback Approach

Revert the changed SocialListening files and downgrade/drop migration `7c2e4d6b8a91` if it has been applied in a non-production environment. No CRM rollback is required because CRM was not modified.
