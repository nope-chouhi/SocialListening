"""add user preferences and sessions

Revision ID: 014
Revises: 013
Create Date: 2026-05-12 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013_add_schedule_arrays'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # Create user_notification_settings table
    if 'user_notification_settings' not in tables:
        op.create_table(
            'user_notification_settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('email_notifications', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('in_app_notifications', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('alert_notifications', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('incident_notifications', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('report_notifications', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.UniqueConstraint('user_id', name='uq_user_notification_settings_user_id')
        )
        op.create_index('ix_user_notification_settings_user_id', 'user_notification_settings', ['user_id'])

    # Create user_preferences table
    if 'user_preferences' not in tables:
        op.create_table(
            'user_preferences',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('theme', sa.String(20), server_default='system', nullable=False),  # light, dark, system
            sa.Column('language', sa.String(10), server_default='vi', nullable=False),  # vi, en
            sa.Column('sidebar_collapsed', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('items_per_page', sa.Integer(), server_default='20', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.UniqueConstraint('user_id', name='uq_user_preferences_user_id')
        )
        op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'])

    # Create user_sessions table
    if 'user_sessions' not in tables:
        op.create_table(
            'user_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('token_jti', sa.String(255), nullable=False),  # JWT ID
            sa.Column('ip_address', sa.String(45)),  # IPv4 or IPv6
            sa.Column('user_agent', sa.Text()),
            sa.Column('device_type', sa.String(50)),  # desktop, mobile, tablet
            sa.Column('location', sa.String(255)),  # City, Country
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('last_active_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_revoked', sa.Boolean(), server_default='false', nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
        )
        op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
        op.create_index('ix_user_sessions_token_jti', 'user_sessions', ['token_jti'])
        op.create_index('ix_user_sessions_is_revoked', 'user_sessions', ['is_revoked'])


def downgrade():
    op.drop_index('ix_user_sessions_is_revoked', table_name='user_sessions')
    op.drop_index('ix_user_sessions_token_jti', table_name='user_sessions')
    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_table('user_sessions')
    
    op.drop_index('ix_user_preferences_user_id', table_name='user_preferences')
    op.drop_table('user_preferences')
    
    op.drop_index('ix_user_notification_settings_user_id', table_name='user_notification_settings')
    op.drop_table('user_notification_settings')

