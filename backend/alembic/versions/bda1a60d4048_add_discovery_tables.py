"""Add discovery tables

Revision ID: bda1a60d4048
Revises: 1a696bbad03b
Create Date: 2026-06-01 23:42:44.141853

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bda1a60d4048'
down_revision = '1a696bbad03b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── discovery_jobs ───
    op.create_table('discovery_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('keyword_group_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='queued'),
        sa.Column('query_keywords', sa.JSON(), nullable=True),
        sa.Column('exclude_keywords', sa.JSON(), nullable=True),
        sa.Column('language', sa.String(length=10), nullable=True),
        sa.Column('country', sa.String(length=10), nullable=True),
        sa.Column('date_range', sa.String(length=50), nullable=True),
        sa.Column('limit', sa.Integer(), nullable=True),
        sa.Column('providers_used_json', sa.JSON(), nullable=True),
        sa.Column('urls_found', sa.Integer(), nullable=True),
        sa.Column('pages_scanned', sa.Integer(), nullable=True),
        sa.Column('mentions_created', sa.Integer(), nullable=True),
        sa.Column('candidate_sources_created', sa.Integer(), nullable=True),
        sa.Column('candidate_sources_updated', sa.Integer(), nullable=True),
        sa.Column('rss_feeds_detected', sa.Integer(), nullable=True),
        sa.Column('valid_rss_feeds', sa.Integer(), nullable=True),
        sa.Column('duplicates_skipped', sa.Integer(), nullable=True),
        sa.Column('blocked_domains_skipped', sa.Integer(), nullable=True),
        sa.Column('failed_items', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovery_jobs_id'), 'discovery_jobs', ['id'], unique=False)
    op.create_index(op.f('ix_discovery_jobs_project_id'), 'discovery_jobs', ['project_id'], unique=False)
    op.create_index(op.f('ix_discovery_jobs_keyword_group_id'), 'discovery_jobs', ['keyword_group_id'], unique=False)
    op.create_index(op.f('ix_discovery_jobs_status'), 'discovery_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_discovery_jobs_created_by_user_id'), 'discovery_jobs', ['created_by_user_id'], unique=False)

    # ─── discovered_sources ───
    op.create_table('discovered_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('discovery_job_id', sa.Integer(), nullable=True),
        sa.Column('source_name', sa.String(length=500), nullable=True),
        sa.Column('domain', sa.String(length=500), nullable=False),
        sa.Column('homepage_url', sa.Text(), nullable=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('platform', sa.String(length=100), nullable=True),
        sa.Column('recommended_monitoring_type', sa.String(length=50), nullable=True, server_default='website'),
        sa.Column('rss_feed_url', sa.Text(), nullable=True),
        sa.Column('rss_valid', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('rss_last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rss_error', sa.Text(), nullable=True),
        sa.Column('sample_url', sa.Text(), nullable=True),
        sa.Column('sample_mentions_count', sa.Integer(), nullable=True),
        sa.Column('matched_keywords_json', sa.JSON(), nullable=True),
        sa.Column('relevance_score', sa.Float(), nullable=True),
        sa.Column('relevance_reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='candidate'),
        sa.Column('blocked_reason', sa.Text(), nullable=True),
        sa.Column('approved_source_id', sa.Integer(), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovered_sources_id'), 'discovered_sources', ['id'], unique=False)
    op.create_index(op.f('ix_discovered_sources_project_id'), 'discovered_sources', ['project_id'], unique=False)
    op.create_index(op.f('ix_discovered_sources_discovery_job_id'), 'discovered_sources', ['discovery_job_id'], unique=False)
    op.create_index(op.f('ix_discovered_sources_domain'), 'discovered_sources', ['domain'], unique=False)
    op.create_index(op.f('ix_discovered_sources_status'), 'discovered_sources', ['status'], unique=False)

    # ─── blocked_domains ───
    op.create_table('blocked_domains',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('domain', sa.String(length=500), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('blocked_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_blocked_domains_id'), 'blocked_domains', ['id'], unique=False)
    op.create_index(op.f('ix_blocked_domains_project_id'), 'blocked_domains', ['project_id'], unique=False)
    op.create_index(op.f('ix_blocked_domains_domain'), 'blocked_domains', ['domain'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_blocked_domains_domain'), table_name='blocked_domains')
    op.drop_index(op.f('ix_blocked_domains_project_id'), table_name='blocked_domains')
    op.drop_index(op.f('ix_blocked_domains_id'), table_name='blocked_domains')
    op.drop_table('blocked_domains')

    op.drop_index(op.f('ix_discovered_sources_status'), table_name='discovered_sources')
    op.drop_index(op.f('ix_discovered_sources_domain'), table_name='discovered_sources')
    op.drop_index(op.f('ix_discovered_sources_discovery_job_id'), table_name='discovered_sources')
    op.drop_index(op.f('ix_discovered_sources_project_id'), table_name='discovered_sources')
    op.drop_index(op.f('ix_discovered_sources_id'), table_name='discovered_sources')
    op.drop_table('discovered_sources')

    op.drop_index(op.f('ix_discovery_jobs_created_by_user_id'), table_name='discovery_jobs')
    op.drop_index(op.f('ix_discovery_jobs_status'), table_name='discovery_jobs')
    op.drop_index(op.f('ix_discovery_jobs_keyword_group_id'), table_name='discovery_jobs')
    op.drop_index(op.f('ix_discovery_jobs_project_id'), table_name='discovery_jobs')
    op.drop_index(op.f('ix_discovery_jobs_id'), table_name='discovery_jobs')
    op.drop_table('discovery_jobs')
