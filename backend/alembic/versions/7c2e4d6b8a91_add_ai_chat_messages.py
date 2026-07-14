"""add ai chat messages

Revision ID: 7c2e4d6b8a91
Revises: 33f8bf51df62
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa


revision = '7c2e4d6b8a91'
down_revision = '33f8bf51df62'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ai_chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=255), nullable=True),
        sa.Column('used_tools', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_chat_messages_id'), 'ai_chat_messages', ['id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_organization_id'), 'ai_chat_messages', ['organization_id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_user_id'), 'ai_chat_messages', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_chat_messages_created_at'), 'ai_chat_messages', ['created_at'], unique=False)
    op.create_index('idx_ai_chat_user_created', 'ai_chat_messages', ['user_id', 'created_at'], unique=False)
    op.create_index('idx_ai_chat_org_created', 'ai_chat_messages', ['organization_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_ai_chat_org_created', table_name='ai_chat_messages')
    op.drop_index('idx_ai_chat_user_created', table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_created_at'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_user_id'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_organization_id'), table_name='ai_chat_messages')
    op.drop_index(op.f('ix_ai_chat_messages_id'), table_name='ai_chat_messages')
    op.drop_table('ai_chat_messages')
