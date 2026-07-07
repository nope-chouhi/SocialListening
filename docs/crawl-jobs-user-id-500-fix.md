# Fix: Manual Scan 500 Error (Missing user_id)

## Production Symptom
When making a `POST` request to `/api/crawl/manual-scan` via the "Scan Now" button on the UI, the API returns a 500 Internal Server Error (AxiosError). Additionally, i18n keys like `mentions.sidebar.sources`, `common.results`, and `common.for` were leaking on the frontend.

## Root Cause
1. **Frontend i18n:** The translation strings for `sidebar.sources` inside mentions, and `results`/`for` inside common were genuinely missing from the frontend locale files.
2. **Backend 500 Error:** After fixing the `scan_schedule_id` missing column, local testing revealed `sqlite3.OperationalError: no such column: crawl_jobs.user_id`. The previous `add_all_missing_user_ids` migration used SQLAlchemy's `Inspector` to dynamically add the `user_id` column to tables that were missing it. Since `Inspector` failed to evaluate the schema correctly in some production environments (the same bug that caused `scan_schedule_id` to be skipped), the `user_id` column was never added to `crawl_jobs` and other core tables on Production. This caused all `manual_scan` DB queries to fail with `UndefinedColumn`.

## Fix
1. **Frontend:** Added the missing translation keys to `vi.ts` and `en.ts` via direct object insertion.
2. **Backend:** Created a new "Force Repair" migration (`33f8bf51df62_force_add_missing_user_ids.py`) using raw PostgreSQL statements:
   ```sql
   ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS user_id INTEGER;
   ```
   This raw SQL migration forcefuly ensures `user_id` exists on all 14 tables affected by the original skipped migration, completely bypassing any ORM introspection flaws.
