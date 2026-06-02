"""Merge multiple heads

Revision ID: d070fd3fdb6e
Revises: 026, a82197fe90fe
Create Date: 2026-06-02 16:01:38.261695

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd070fd3fdb6e'
down_revision = ('026', 'a82197fe90fe')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
