# Fix: Crawl Jobs Schema Mismatch (scan_schedule_id)

## Production Symptom
When making a `POST` request to `/api/crawl/manual-scan` in production, the API returns a 500 Internal Server Error.
The backend logs show:
```
psycopg2.errors.UndefinedColumn: column crawl_jobs.scan_schedule_id does not exist
```

## Root Cause
The production database schema is missing the `scan_schedule_id` column in the `crawl_jobs` table. The SQLAlchemy `CrawlJob` model declares this column, causing all ORM queries (such as checking for existing jobs during `manual_scan`) to fail when SQLAlchemy requests the missing column from Postgres. This typically happens if a migration was bypassed, skipped, or failed to apply correctly in production.

## Fix
Created an Alembic repair migration (`a6acc60b770b_add_scan_schedule_id_to_crawl_jobs.py`) that safely and idempotently checks for the existence of `scan_schedule_id`. 
- If the column is missing, it adds it as `INTEGER NULL`.
- If the column already exists (e.g., in local development environments where migrations were run properly), it gracefully skips the addition.
- It also manages the index creation for `ix_crawl_jobs_scan_schedule_id` using the same idempotent checks.

## Why this avoids Render Shell
By relying on Alembic's idempotent runtime schema checks (using `Inspector`), we can deploy the fix via the standard code deployment pipeline. Render's automated startup script (`RUN_MIGRATIONS_ON_STARTUP=true` or similar deployment hooks) will trigger `alembic upgrade head`. The migration will run safely, patch the production schema, and resolve the 500 error without requiring manual SSH access or a Render Shell console session to run manual SQL `ALTER TABLE` commands.
