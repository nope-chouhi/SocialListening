"""add_performance_indexes_trgm

Revision ID: 39818fa14818
Revises: 9ca8ada20c4d
Create Date: 2026-06-10 21:08:14.515910

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '39818fa14818'
down_revision = '9ca8ada20c4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use context connection to execute raw SQL
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        # Add pg_trgm extension
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        
        # GIN trigram indexes for text search
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_title_trgm ON mentions USING gin (title gin_trgm_ops);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_content_trgm ON mentions USING gin (content gin_trgm_ops);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_domain_trgm ON mentions USING gin (domain gin_trgm_ops);")
        
        # B-Tree indexes for filtering and sorting
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_project_id ON mentions (project_id);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_created_at ON mentions (created_at DESC);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_project_created ON mentions (project_id, created_at DESC);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_sentiment ON mentions (sentiment);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_mentions_source_type ON mentions (source_type);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_crawl_jobs_status ON crawl_jobs (status);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_crawl_jobs_created_at ON crawl_jobs (created_at DESC);")


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        op.execute("DROP INDEX IF EXISTS ix_crawl_jobs_created_at;")
        op.execute("DROP INDEX IF EXISTS ix_crawl_jobs_status;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_source_type;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_sentiment;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_project_created;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_created_at;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_project_id;")
        
        op.execute("DROP INDEX IF EXISTS ix_mentions_domain_trgm;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_content_trgm;")
        op.execute("DROP INDEX IF EXISTS ix_mentions_title_trgm;")
        # We do not drop the extension automatically, as other databases might rely on it
