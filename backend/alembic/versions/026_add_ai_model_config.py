"""add ai_model_config table

Revision ID: c4a1e2f3b5d7
Revises: bdd2e5fc2cee
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'c4a1e2f3b5d7'
down_revision = 'bdd2e5fc2cee'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_model_config',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('provider', sa.String(50), nullable=False, server_default='gemini'),
        sa.Column('api_key', sa.Text(), nullable=True),
        sa.Column('model_name', sa.String(255), nullable=False, server_default='gemini-2.5-flash'),
        sa.Column('base_url', sa.Text(), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=False, server_default='2048'),
        sa.Column('temperature', sa.Float(), nullable=False, server_default='0.7'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('ai_model_config')
