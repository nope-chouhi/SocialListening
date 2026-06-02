"""Expand mentions table for Brand24 style results

Revision ID: a82197fe90fe
Revises: bda1a60d4048
Create Date: 2026-06-01 23:59:31.039383

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a82197fe90fe'
down_revision = 'bda1a60d4048'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('mentions')]
    
    # Modify existing columns to be nullable
    op.alter_column('mentions', 'source_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('mentions', 'content', existing_type=sa.Text(), nullable=True)
    op.alter_column('mentions', 'url', existing_type=sa.Text(), nullable=True)
    
    # Add new columns conditionally
    if 'project_id' not in columns: op.add_column('mentions', sa.Column('project_id', sa.Integer(), nullable=True))
    if 'keyword_id' not in columns: op.add_column('mentions', sa.Column('keyword_id', sa.Integer(), nullable=True))
    if 'keyword_text' not in columns: op.add_column('mentions', sa.Column('keyword_text', sa.String(length=255), nullable=True))
    if 'job_id' not in columns: op.add_column('mentions', sa.Column('job_id', sa.Integer(), nullable=True))
    
    if 'source_type' not in columns: op.add_column('mentions', sa.Column('source_type', sa.String(length=50), nullable=True))
    if 'platform' not in columns: op.add_column('mentions', sa.Column('platform', sa.String(length=100), nullable=True))
    if 'domain' not in columns: op.add_column('mentions', sa.Column('domain', sa.String(length=500), nullable=True))
    if 'snippet' not in columns: op.add_column('mentions', sa.Column('snippet', sa.Text(), nullable=True))
    
    if 'sentiment' not in columns: op.add_column('mentions', sa.Column('sentiment', sa.String(length=50), nullable=True))
    if 'sentiment_confidence' not in columns: op.add_column('mentions', sa.Column('sentiment_confidence', sa.Float(), nullable=True))
    if 'influence_score' not in columns: op.add_column('mentions', sa.Column('influence_score', sa.Float(), nullable=True))
    if 'reach_estimate' not in columns: op.add_column('mentions', sa.Column('reach_estimate', sa.Integer(), nullable=True))
    if 'views_count' not in columns: op.add_column('mentions', sa.Column('views_count', sa.Integer(), nullable=True))
    if 'comments_count' not in columns: op.add_column('mentions', sa.Column('comments_count', sa.Integer(), nullable=True))
    if 'likes_count' not in columns: op.add_column('mentions', sa.Column('likes_count', sa.Integer(), nullable=True))
    if 'shares_count' not in columns: op.add_column('mentions', sa.Column('shares_count', sa.Integer(), nullable=True))
    
    if 'language' not in columns: op.add_column('mentions', sa.Column('language', sa.String(length=50), nullable=True))
    if 'country' not in columns: op.add_column('mentions', sa.Column('country', sa.String(length=50), nullable=True))
    
    if 'tags_json' not in columns: op.add_column('mentions', sa.Column('tags_json', sa.JSON(), nullable=True))
    if 'is_muted' not in columns: op.add_column('mentions', sa.Column('is_muted', sa.Boolean(), server_default='false', nullable=True))
    if 'is_deleted' not in columns: op.add_column('mentions', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True))
    if 'extraction_source' not in columns: op.add_column('mentions', sa.Column('extraction_source', sa.String(length=100), nullable=True))
    if 'confidence' not in columns: op.add_column('mentions', sa.Column('confidence', sa.String(length=50), nullable=True))
    
    # Create new indices
    indices = [ix['name'] for ix in inspector.get_indexes('mentions')]
    if 'ix_mention_job' not in indices:
        op.create_index(op.f('ix_mention_job'), 'mentions', ['job_id'], unique=False)
    if 'ix_mention_domain' not in indices:
        op.create_index(op.f('ix_mention_domain'), 'mentions', ['domain'], unique=False)


def downgrade() -> None:
    # Drop indices
    op.drop_index(op.f('ix_mention_domain'), table_name='mentions')
    op.drop_index(op.f('ix_mention_job'), table_name='mentions')
    
    # Drop new columns
    op.drop_column('mentions', 'confidence')
    op.drop_column('mentions', 'extraction_source')
    op.drop_column('mentions', 'is_deleted')
    op.drop_column('mentions', 'is_muted')
    op.drop_column('mentions', 'tags_json')
    op.drop_column('mentions', 'country')
    op.drop_column('mentions', 'language')
    op.drop_column('mentions', 'shares_count')
    op.drop_column('mentions', 'likes_count')
    op.drop_column('mentions', 'comments_count')
    op.drop_column('mentions', 'views_count')
    op.drop_column('mentions', 'reach_estimate')
    op.drop_column('mentions', 'influence_score')
    op.drop_column('mentions', 'sentiment_confidence')
    op.drop_column('mentions', 'sentiment')
    op.drop_column('mentions', 'snippet')
    op.drop_column('mentions', 'domain')
    op.drop_column('mentions', 'platform')
    op.drop_column('mentions', 'source_type')
    op.drop_column('mentions', 'job_id')
    op.drop_column('mentions', 'keyword_text')
    op.drop_column('mentions', 'keyword_id')
    op.drop_column('mentions', 'project_id')
    
    # Revert modified columns
    op.alter_column('mentions', 'url', existing_type=sa.Text(), nullable=False)
    op.alter_column('mentions', 'content', existing_type=sa.Text(), nullable=False)
    op.alter_column('mentions', 'source_id', existing_type=sa.Integer(), nullable=False)
