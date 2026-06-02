"""Ensure missing mention columns exist

Revision ID: 026_ensure_missing_mention_columns
Revises: 025_create_saved_filters_table
Create Date: 2026-06-02 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [col['name'] for col in inspector.get_columns('mentions')]
    
    # List of columns to ensure
    # format: (name, type, kwargs)
    to_ensure = [
        ('project_id', sa.Integer(), {'nullable': True}),
        ('keyword_id', sa.Integer(), {'nullable': True}),
        ('keyword_text', sa.String(255), {'nullable': True}),
        ('job_id', sa.Integer(), {'nullable': True}),
        ('source_type', sa.String(50), {'nullable': True}),
        ('platform', sa.String(100), {'nullable': True}),
        ('domain', sa.String(500), {'nullable': True}),
        ('snippet', sa.Text(), {'nullable': True}),
        ('sentiment', sa.String(50), {'nullable': True}),
        ('sentiment_confidence', sa.Float(), {'nullable': True}),
        ('influence_score', sa.Float(), {'nullable': True}),
        ('reach_estimate', sa.Integer(), {'nullable': True}),
        ('views_count', sa.Integer(), {'nullable': True}),
        ('comments_count', sa.Integer(), {'nullable': True}),
        ('likes_count', sa.Integer(), {'nullable': True}),
        ('shares_count', sa.Integer(), {'nullable': True}),
        ('language', sa.String(50), {'nullable': True}),
        ('country', sa.String(50), {'nullable': True}),
        ('tags_json', sa.JSON(), {'nullable': True}),
        ('is_muted', sa.Boolean(), {'server_default': 'false', 'nullable': True}),
        ('is_deleted', sa.Boolean(), {'server_default': 'false', 'nullable': True}),
        ('add_to_report', sa.Boolean(), {'server_default': 'false', 'nullable': True}),
        ('extraction_source', sa.String(100), {'nullable': True}),
        ('confidence', sa.String(50), {'nullable': True}),
        ('platform_post_id', sa.String(255), {'nullable': True}),
        ('meta_data', sa.JSON(), {'nullable': True}),
        ('is_reviewed', sa.Boolean(), {'server_default': 'false', 'nullable': True}),
        ('matched_keywords', sa.JSON(), {'nullable': True}),
    ]
    
    for col_name, col_type, col_kwargs in to_ensure:
        if col_name not in columns:
            op.add_column('mentions', sa.Column(col_name, col_type, **col_kwargs))
            
    # Also check if existing columns need to be modified (like content/url nullable)
    # But it's generally safe to just add missing ones to prevent UndefinedColumn.

def downgrade() -> None:
    pass
