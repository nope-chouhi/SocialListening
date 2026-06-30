# Fix: AI Config Migration Blocker

## Why AI Config Appeared Not To Save
In the frontend, when a user clicked "Save Configuration" in the AI Settings page, the UI showed a success toast. However, the backend was actually encountering an error because the `AIModelConfig` database table did not exist. Instead of returning a standard 500 or 400 error, an older implementation swallowed this error and returned a 200 OK with `{"success": false}` to prevent crashes. The frontend did not parse this correctly and falsely assumed the save was successful.

## Which Migration Failures Blocked Production
The core issue was on the production environment (Render). The backend database was partially synced via `db.create_all()` in the past, meaning certain tables and columns were manually created outside of Alembic's version control. 

When the deployment script ran `alembic upgrade head`, it encountered two specific migrations that attempted to add columns that already existed in the database:
1. `bdd2e5fc2cee_add_builder_config_to_report_exports.py` (tried to add `builder_config` to `report_exports`)
2. `028_add_report_email_recipients.py` (tried to add `report_email_recipients` to `system_notification_settings`)

This threw `psycopg2.errors.DuplicateColumn` errors, causing Alembic to crash and halt all subsequent migrations.

## Why Idempotent Checks Were Needed
Because Alembic crashed on the `DuplicateColumn` errors, it could not proceed to run newer migrations, including the one that actually creates the `AIModelConfig` table and the `user_id` column (`05c3b568d49b_add_user_id_to_ai_model_config.py`). By adding idempotent checks using `Inspector` to verify if the columns exist before attempting to add them, Alembic can safely skip the duplicate operations and continue executing the rest of the migration chain.

## Why This Unblocks the AI Model Config Migration
By making the problematic migrations idempotent, Alembic successfully completes `bdd2e5fc2cee` and `028_add_report_email_recipients`, allowing it to finally execute `05c3b568d49b_add_user_id_to_ai_model_config.py`. Once this migration runs, the `ai_model_config` table is correctly initialized with the `user_id` column on production, allowing the AI Settings and AI Assistant features to persist their configurations securely per-user.

## How to Verify the Fix After Deployment
1. Log in to the application.
2. Go to AI Settings and enter your provider, model, and API key.
3. Click "Save Configuration".
4. Refresh the page or switch tabs; verify the configuration persists and the UI accurately reflects the saved state.
5. Navigate to the AI Assistant tab and confirm it no longer prompts you to go back to settings.
6. Return to AI Settings and save again without entering a new API key; verify that the existing key remains intact.
