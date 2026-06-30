"""add system_prompt to ai_model_config

Revision ID: a1b2c3d4e5f6
Revises: c4a1e2f3b5d7
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = 'c4a1e2f3b5d7'
branch_labels = None
depends_on = None


def upgrade():
    # Safe add: check if column already exists
    try:
        op.add_column('ai_model_config', sa.Column('system_prompt', sa.Text(), nullable=True))
    except Exception:
        pass  # Column may already exist


def downgrade():
    try:
        op.drop_column('ai_model_config', 'system_prompt')
    except Exception:
        pass
