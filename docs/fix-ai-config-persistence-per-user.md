# Fix: AI Config Persistence and Per-User Configuration

## Bug Report
1. The AI configuration failed to save persistently because the backend returned a 200 OK with `{"success": false}` when the database table was missing or the database was not initialized. The frontend incorrectly interpreted this 200 OK as a success, and displayed "Đã lưu cấu hình AI thành công!". However, because it was never saved to the database, switching tabs or refreshing cleared the settings.
2. The AI Assistant page reported that AI was not configured because it hit the `/api/ai/chat/config` endpoint which returned `false` since the config was never actually saved to the backend.

## New Requirements Implemented
The user requested that the AI Configuration support **per-user/per-customer** configurations instead of a single global configuration (`id = 1`).

## Implementation Details

### Database Schema Changes
- Updated `AIModelConfig` model in `backend/app/models/ai_config.py` to remove the hardcoded `id = 1` limitation.
- Added `user_id` as a `ForeignKey` to the `users.id` table, with an index and a unique constraint.
- Generated an Alembic migration (`05c3b568d49b_add_user_id_to_ai_model_config.py`) to apply these changes to PostgreSQL.

### Backend API Changes
- **Admin Settings API** (`backend/app/api/settings.py`):
  - Changed `get_current_superuser` to `get_current_user` for the `/api/admin/settings/ai-model` endpoint.
  - The endpoint now queries `select(AIModelConfig).where(AIModelConfig.user_id == current_user.id)`.
  - Replaced the silent 200 OK fallback with a proper `HTTPException(status_code=400, detail="Database is not initialized...")` so the frontend Axios client can properly catch it.
- **AI Chat API** (`backend/app/api/ai_chat.py`):
  - Updated `_get_ai_config` to accept `user_id` instead of assuming `id = 1`.
  - Updated `/api/ai/chat/config` and the chat endpoint to pass `current_user.id`.
- **AI Service Background Jobs** (`backend/app/services/ai_service.py`):
  - Updated `_get_active_config` to accept an optional `user_id`.
  - If `user_id` is provided, it returns the user's config. If not (e.g. background jobs like `analyze_sentiment`), it falls back to the first available enabled config (`is_enabled == True`).

### Frontend Changes
- The frontend logic in `AIModelSettings.tsx` automatically benefits from the 400 error code, meaning `toast.error` will trigger when a save fails, preventing the false positive "Saved successfully" message.
- `AIModelSettings.tsx` correctly omits the API key in the `PUT` request if it hasn't changed (or is masked), and the backend preserves the existing key.

## Verification
- Configs are now isolated per user.
- AI Assistant detects the user-specific configuration correctly and stops showing the "Go to settings" warning once it is configured.
- The system correctly masks the API key on the frontend.
