# Email Reports Migration Fix

## Incident Summary
Production code for the Email Reports Setup feature was deployed, which included a new column `report_email_recipients` on the `system_notification_settings` table. However, the migration `028_add_report_email_recipients` failed to apply through the normal deployment/startup flow.

## Root Cause
The root cause was a `DuplicateObject` error originating from an earlier migration (`8842624c78e7_add_report_exports_table.py`) that attempted to recreate the `exportstatus` enum type. This blocked Alembic from running subsequent migrations, including `028`. As a result, the backend application attempted to query the non-existent column, leading to `psycopg2.errors.UndefinedColumn` crashes in production.

## Fix
1. Updated `8842624c78e7_add_report_exports_table.py` to make the `exportstatus` enum creation safely idempotent using a PostgreSQL `DO $$ BEGIN ... END $$` block.
2. Updated `028_add_report_email_recipients.py` to use idempotent raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) to prevent any partial execution errors if it was partially applied.

## Next Steps
- Merge these fixes into the `main` branch.
- Wait for the normal Vercel/Render automatic deployment to trigger. The updated startup migration flow will successfully run through `alembic upgrade head`.
- **Do not** manually run production migrations using the debug endpoints or scripts unless the automated deployment is explicitly confirmed to have failed again.
