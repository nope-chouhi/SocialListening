"""force_add_scan_schedule_id_to_crawl_jobs

Revision ID: ad0726e1745a
Revises: a6acc60b770b
Create Date: 2026-07-07 22:49:04.753162

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ad0726e1745a'
down_revision = 'a6acc60b770b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS scan_schedule_id INTEGER;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crawl_jobs_scan_schedule_id ON crawl_jobs (scan_schedule_id);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_crawl_jobs_scan_schedule_id;")
    op.execute("ALTER TABLE crawl_jobs DROP COLUMN IF EXISTS scan_schedule_id;")
