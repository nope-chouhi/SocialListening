"""add builder_config to report_exports

Revision ID: bdd2e5fc2cee
Revises: 8842624c78e7
Create Date: 2026-06-26 09:44:51.069648

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
"""add builder_config to report_exports

Revision ID: bdd2e5fc2cee
Revises: 8842624c78e7
Create Date: 2026-06-26 09:44:51.069648

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'bdd2e5fc2cee'
down_revision = '8842624c78e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    
    if 'report_exports' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('report_exports')]
        if 'builder_config' not in columns:
            with op.batch_alter_table('report_exports', schema=None) as batch_op:
                batch_op.add_column(sa.Column('builder_config', sa.JSON(), nullable=True))
    else:
        with op.batch_alter_table('report_exports', schema=None) as batch_op:
            batch_op.add_column(sa.Column('builder_config', sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    
    if 'report_exports' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('report_exports')]
        if 'builder_config' in columns:
            with op.batch_alter_table('report_exports', schema=None) as batch_op:
                batch_op.drop_column('builder_config')
