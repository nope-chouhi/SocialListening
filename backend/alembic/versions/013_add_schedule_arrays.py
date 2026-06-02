"""add schedule arrays for multiple selections

Revision ID: 013_add_schedule_arrays
Revises: 012_fix_app_wide_missing_columns
Create Date: 2026-05-11 21:30:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '013_add_schedule_arrays'
down_revision = '012_fix_app_wide_missing_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Add new JSON columns for multiple schedule selections
    conn = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('sources')]
    
    if 'schedule_days_of_week' not in columns:
        op.add_column('sources', sa.Column('schedule_days_of_week', postgresql.JSON, nullable=True))
        
    if 'schedule_days_of_month' not in columns:
        op.add_column('sources', sa.Column('schedule_days_of_month', postgresql.JSON, nullable=True))
        
    if 'schedule_months' not in columns:
        op.add_column('sources', sa.Column('schedule_months', postgresql.JSON, nullable=True))
        
    if 'schedule_hours' not in columns:
        op.add_column('sources', sa.Column('schedule_hours', postgresql.JSON, nullable=True))


def downgrade():
    op.drop_column('sources', 'schedule_hours')
    op.drop_column('sources', 'schedule_months')
    op.drop_column('sources', 'schedule_days_of_month')
    op.drop_column('sources', 'schedule_days_of_week')
