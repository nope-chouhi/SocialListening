# Mentions Phase 2: Saved Filters, Topics/Trends, and Filtered Export

## Overview
Phase 2 enhances the Mentions Dashboard with real backend implementations for:
1. **Saved Filters**: Users can save their current search queries and filters (source type, sentiment, risk, etc.) for quick access.
2. **Topics/Trends**: A new backend API aggregates topics/trends from the filtered mention set and visualizes them on the frontend.
3. **Filtered CSV Export**: The export functionality has been wired to pass all active filters to the backend to ensure the downloaded dataset accurately reflects the user's current view.

## Backend Implementation
*   **Saved Filters CRUD API**: Standard endpoints for managing saved filters.
*   **Topics/Trends API (`GET /api/mentions/topics`)**:
    *   Route placed above `/{mention_id}` to prevent route shadowing.
    *   Aggregates data based on `tags_json`, `keyword`, and AI topics, applying the same global filters used in `list_mentions`.
*   **Filtered Export API (`GET /api/mentions/export`)**:
    *   Receives filter query params (sentiment, source type, date ranges, etc.).
    *   Uses a unified `apply_mention_filters` method to guarantee export results match the UI view.
*   **Database Constraints**: 
    *   Fixed `ModuleNotFoundError` for `AIAnalysis` import.

## Frontend Refactoring
*   **UI Integration**: Wired the existing `handleSaveFilter` modal to real backend API endpoints for saving, applying, and deleting filters.
*   **Topics Tab**: Created a new tab in the `Mentions` dashboard UI to display the `topicsData` via `BarChart`.
*   **Centralized Query Params**: Unified the parameter construction logic (`buildMentionsParams`) across fetching lists, chart data, source counts, and exporting.
*   **Mojibake Fixes**: Addressed UTF-8 / BOM encoding issues that temporarily corrupted Vietnamese UI strings by restoring files from `main` and performing clean localized edits.

## Testing
*   Backend tests added: `tests/test_mentions_phase2.py`.
*   Includes mocked FastAPI router tests for:
    *   `test_create_saved_filter`
    *   `test_topics_endpoint`
    *   `test_export_endpoint`
*   Fully verified via `pytest` and `npm run type-check`.
*   Passed full `python -m compileall app` and `npm run build` checks.

## Future Phases
*   Explore more advanced AI topic clustering for the Trends view.
*   Implement automated reporting schedules based on Saved Filters.
