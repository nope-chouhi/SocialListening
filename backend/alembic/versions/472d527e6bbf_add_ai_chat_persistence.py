"""add ai chat persistence

Revision ID: 472d527e6bbf
Revises: c4a1e2f3b5d7
Create Date: 2026-06-28 16:35:19.125296

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '472d527e6bbf'
down_revision = 'c4a1e2f3b5d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. ai_chat_sessions
    op.create_table(
        'ai_chat_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('model_config_id', sa.Integer(), sa.ForeignKey('ai_model_config.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 2. ai_chat_messages
    op.create_table(
        'ai_chat_messages',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('ai_chat_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. ai_usage_logs
    op.create_table(
        'ai_usage_logs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('ai_chat_sessions.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('ai_chat_messages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('model_config_id', sa.Integer(), sa.ForeignKey('ai_model_config.id', ondelete='SET NULL'), nullable=True),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model', sa.String(255), nullable=False),
        sa.Column('request_type', sa.String(50), nullable=False, server_default='chat'),
        sa.Column('input_tokens', sa.Integer(), nullable=True),
        sa.Column('output_tokens', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('estimated_cost', sa.Float(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('ai_usage_logs')
    op.drop_table('ai_chat_messages')
    op.drop_table('ai_chat_sessions')
