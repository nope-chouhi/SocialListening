"""force_add_missing_user_ids

Revision ID: 33f8bf51df62
Revises: ad0726e1745a
Create Date: 2026-07-07 22:58:30.010121

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '33f8bf51df62'
down_revision = 'ad0726e1745a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use Postgres-specific safe raw SQL to avoid crash if table does not exist
    def pg_safe_add(table, column):
        # ALTER TABLE IF EXISTS prevents error if table is completely missing
        op.execute(f"ALTER TABLE IF EXISTS {table} ADD COLUMN IF NOT EXISTS {column} INTEGER;")
        # DO block ensures CREATE INDEX only runs if the table exists
        op.execute(f"""
        DO $$ 
        BEGIN 
            IF to_regclass('{table}') IS NOT NULL THEN 
                EXECUTE 'CREATE INDEX IF NOT EXISTS ix_{table}_{column} ON {table} ({column});';
            END IF; 
        END $$;
        """)

    tables_with_user_id = [
        "keyword_groups", "alerts", "crawl_jobs", "scan_schedules",
        "incidents", "incident_logs", "sources"
    ]
    for table in tables_with_user_id:
        pg_safe_add(table, "user_id")

    # Discovery
    pg_safe_add("discovery_jobs", "created_by_user_id")
    pg_safe_add("blocked_domains", "blocked_by_user_id")

    # Reputation
    pg_safe_add("reputation_cases", "assigned_to_user_id")
    pg_safe_add("reputation_cases", "created_by_user_id")
    pg_safe_add("reputation_evidence", "created_by_user_id")
    pg_safe_add("reputation_actions", "approved_by_user_id")
    pg_safe_add("reputation_actions", "created_by_user_id")


def downgrade() -> None:
    pass
