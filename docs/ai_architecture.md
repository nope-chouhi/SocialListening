# AI Architecture Overview

## Admin AI Configuration
- UI path: `/dashboard/settings/ai`
- Uses `GET /api/ai/config` (admin‑only) and `PUT /api/ai/config` (admin‑only).
- Stores settings in `AIModelConfig` table.
- API key is stored encrypted if encryption helper exists; otherwise plain‑text with clear warnings.
- Blank `api_key` on update preserves existing key.
- Response masks the key (`api_key_masked`) and reports `api_key_configured`.

## Public AI Chat
- UI path: `/dashboard/assistant` (available to all authenticated users).
- Calls `POST /api/ai/chat` which uses the central `AIService`.
- If AI is not configured, returns a user‑friendly message.
- No secrets are ever sent to the frontend.

## Mention Analysis
- Endpoint `POST /api/mentions/{id}/analyze` uses `AIService` for sentiment/risk analysis.
- Stores results in `AIAnalysis` table.

## Configuration Precedence
1. DB `AIModelConfig` (admin‑managed) overrides any environment variables.
2. If no DB config, falls back to env vars.
3. If still not configured, API returns a safe "AI Assistant is not configured yet" message.

## Security
- Raw API key never returned by any endpoint.
- Frontend never contains AI secrets.
- Blank key updates keep existing secret.
- No logging of raw keys.

## Deployment Notes
- After deployment, an admin must populate `AIModelConfig` with a real provider and API key via the admin UI.
- No production migrations were added (the table already existed).

## Testing
- Backend tests cover config read/write, key preservation, chat behavior, and mention analysis.
- Frontend type‑check and build pass.

## Next Steps
- Admin configure real AI provider on Render.
- Monitor usage logs for AI calls.
