"""add_scan_schedule_id_to_crawl_jobs

Revision ID: a6acc60b770b
Revises: 029_ensure_report_email_recipients
Create Date: 2026-07-07 22:28:13.954254

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a6acc60b770b'
down_revision = '029_ensure_report_email_recipients'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    
    # Check for scan_schedule_id column
    columns = [c['name'] for c in inspector.get_columns('crawl_jobs')]
    if 'scan_schedule_id' not in columns:
        op.add_column('crawl_jobs', sa.Column('scan_schedule_id', sa.Integer(), nullable=True))
        
    # Check for index
    indexes = [i['name'] for i in inspector.get_indexes('crawl_jobs')]
    if 'ix_crawl_jobs_scan_schedule_id' not in indexes:
        op.create_index(op.f('ix_crawl_jobs_scan_schedule_id'), 'crawl_jobs', ['scan_schedule_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    
    indexes = [i['name'] for i in inspector.get_indexes('crawl_jobs')]
    if 'ix_crawl_jobs_scan_schedule_id' in indexes:
        op.drop_index(op.f('ix_crawl_jobs_scan_schedule_id'), table_name='crawl_jobs')
        
    columns = [c['name'] for c in inspector.get_columns('crawl_jobs')]
    if 'scan_schedule_id' in columns:
        op.drop_column('crawl_jobs', 'scan_schedule_id')
