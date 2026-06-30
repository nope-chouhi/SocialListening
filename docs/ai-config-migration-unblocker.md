# Fix: AI Config Migration Unblocker

## Why AI Config Appeared Not To Save
The AI Configuration requires the `ai_model_config` database table (specifically the new `user_id` column) to persist settings properly. When a user clicked "Save Configuration" in the AI Settings page, the backend API tried to write to this table. Because the table/column did not exist in production, the backend returned an error. An older frontend implementation swallowed this error and falsely displayed a success message, leading users to believe the AI Config was saved when it was not.

## Why the AI Config Migration Could Not Run
The Alembic migration that creates the required AI Config structure (`05c3b568d49b_add_user_id_to_ai_model_config.py`) was completely blocked from running on production. 

Alembic runs migrations in a strict sequential chain. Two earlier, non-idempotent migrations were failing:
1. `bdd2e5fc2cee_add_builder_config_to_report_exports.py`
2. `028_add_report_email_recipients.py`

Because the production database had previously been synced using `db.create_all()`, the columns these migrations attempted to add already existed. Alembic crashed with `psycopg2.errors.DuplicateColumn`, instantly halting the migration process before it could ever reach the AI Config migration.

## The Minimal Compatibility Fix
To unblock the AI Config migration, these two earlier migrations were updated to be idempotent. They now use SQLAlchemy's `Inspector` to check if their respective columns already exist before attempting to add them (or drop them on downgrade). 

**Important:** These edits are strictly structural compatibility fixes for Alembic. **No report email feature behavior, logic, UI, scheduling, or settings were changed.** The sole purpose of modifying these files is to allow Alembic to bypass the crash and proceed to the AI Config migration.

## Verification Steps
Once the migration chain is unblocked and the AI Config table is properly initialized, you can verify the AI functionality:
1. **AI Settings can save config:** Enter a provider, model, and API key, then click save. The request will succeed and the config will be stored securely in the database.
2. **AI Settings persists after refresh:** Reloading the page or switching tabs will correctly load the saved provider/model status.
3. **AI Assistant detects configuration:** The AI Assistant tab will recognize the saved config and no longer display the "go to settings" warning.
4. **Preserves existing key:** Saving the configuration again without typing a new API key will preserve the existing key in the backend.
