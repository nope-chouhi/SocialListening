"""Add user_id for multi-tenancy

Revision ID: e59ddbd5393d
Revises: add_all_missing_user_ids
Create Date: 2026-06-03 14:21:21.835140

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e59ddbd5393d'
down_revision = 'add_all_missing_user_ids'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
