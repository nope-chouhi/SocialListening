"""merge_multiple_heads

Revision ID: 9ca8ada20c4d
Revises: 1d09402c6678, 98958b6e0e48
Create Date: 2026-06-10 21:08:09.973117

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9ca8ada20c4d'
down_revision = ('1d09402c6678', '98958b6e0e48')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
