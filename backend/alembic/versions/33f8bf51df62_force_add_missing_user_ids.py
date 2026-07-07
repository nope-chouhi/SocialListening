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
    tables_with_user_id = [
        "keyword_groups", "alerts", "crawl_jobs", "scan_schedules",
        "incidents", "incident_logs", "sources"
    ]
    for table in tables_with_user_id:
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id INTEGER;")
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_{table}_user_id ON {table} (user_id);")

    # Discovery
    op.execute("ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_discovery_jobs_created_by_user_id ON discovery_jobs (created_by_user_id);")
    
    op.execute("ALTER TABLE blocked_domains ADD COLUMN IF NOT EXISTS blocked_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_blocked_domains_blocked_by_user_id ON blocked_domains (blocked_by_user_id);")

    # Reputation
    op.execute("ALTER TABLE reputation_cases ADD COLUMN IF NOT EXISTS assigned_to_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reputation_cases_assigned_to_user_id ON reputation_cases (assigned_to_user_id);")
    
    op.execute("ALTER TABLE reputation_cases ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reputation_cases_created_by_user_id ON reputation_cases (created_by_user_id);")
    
    op.execute("ALTER TABLE reputation_evidence ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reputation_evidence_created_by_user_id ON reputation_evidence (created_by_user_id);")
    
    op.execute("ALTER TABLE reputation_actions ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reputation_actions_approved_by_user_id ON reputation_actions (approved_by_user_id);")
    
    op.execute("ALTER TABLE reputation_actions ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_reputation_actions_created_by_user_id ON reputation_actions (created_by_user_id);")


def downgrade() -> None:
    pass
