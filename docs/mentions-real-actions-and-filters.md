# Mentions Real Actions and Filters Implementation Plan

The goal is to replace the mock functionality on the Mentions page with real, functional API endpoints. 

## Completed Changes

### Database/Models
We reused the existing models and fields in `Mention` (`is_reviewed`, `is_muted`, `influence_score`, `tags_json`, `add_to_report`). No Alembic schema migrations were strictly necessary. Missing fields were properly exposed in schemas.

### Backend Endpoints (`backend/app/api/mentions.py`)
1. **Filtering API (`GET /`)**:
   - Ensured `is_reviewed` is supported if passed.
   - Ensured `influence_score` filters logically.
2. **Review Action**:
   - Changed `POST /{id}/mark-reviewed` to `PUT /{id}/review` accepting `{"is_reviewed": boolean}`.
3. **Bulk Actions**:
   - `PUT /bulk/delete`
   - `PUT /bulk/review`
   - `PUT /bulk/sentiment`
4. **Chart API (`GET /charts`)**:
   - New endpoint that mirrors `GET /` filters but groups by `granularity` (`daily`, `weekly`, `monthly`) returning total mentions, reach estimate, and sentiment breakdown.

### Frontend Mentions Page
1. **API Client**: Updated `api.ts` with new bulk endpoints and `/charts`.
2. **State Management**:
   - Hooked up `fetchChartData` using the new `GET /charts` endpoint, passing all active filters.
   - Hooked up `influence_score` slider.
3. **Item Actions**:
   - Wired Sentiment dropdown, Review button, Add PDF toggle (Report), Tags modal, Mute author/site, and Delete button to actual APIs.
   - Wired Analyze AI button to call real AI sentiment analysis.
4. **Bulk Actions**: Added floating bulk action bar when items are selected. It now correctly supports Bulk Delete, Bulk Review, and Bulk Sentiment.

## Currently Unsupported / Pending
- **"Save Filter" modal**: This UI element is visible (Save filters status), but the backend implementation for user-saved mention filters (`savedFilters.create`) is not fully built yet. It relies on future user preference schemas.
- **Mentions Export status**: The frontend uses `mentionsApi.exportCsv`, but advanced PDF/Excel exports belong to the separate Phase 6 implementation. Phase 6 will handle all complex report generation (PDF, Excel, historical exports).
- **Topics/trends chart status**: The backend currently supports `Mentions & Reach` and `Sentiment` charts. A dedicated backend topic-clustering or trending keywords aggregation endpoint is pending for a future iteration, so the Topics/Trends chart tab may show placeholder or limited data.
