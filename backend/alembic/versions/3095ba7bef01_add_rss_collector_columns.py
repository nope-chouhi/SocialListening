"""add_rss_collector_columns

Revision ID: 3095ba7bef01
Revises: e59ddbd5393d
Create Date: 2026-06-04 09:25:58.410157

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3095ba7bef01'
down_revision = 'e59ddbd5393d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to sources
    with op.batch_alter_table('sources', schema=None) as batch_op:
        batch_op.add_column(sa.Column('platform', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('category', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('domain', sa.String(length=500), nullable=True))
        batch_op.create_index(batch_op.f('ix_sources_platform'), ['platform'], unique=False)
        batch_op.create_index(batch_op.f('ix_sources_category'), ['category'], unique=False)
        batch_op.create_index(batch_op.f('ix_sources_domain'), ['domain'], unique=False)



def downgrade() -> None:


    with op.batch_alter_table('sources', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sources_domain'))
        batch_op.drop_index(batch_op.f('ix_sources_category'))
        batch_op.drop_index(batch_op.f('ix_sources_platform'))
        batch_op.drop_column('domain')
        batch_op.drop_column('category')
        batch_op.drop_column('platform')
