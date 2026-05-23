"""dashboard_updates

Revision ID: 021
Revises: 020
Create Date: 2026-05-23 14:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    # 1. Add is_reviewed to mentions
    columns = [col['name'] for col in inspector.get_columns('mentions')]
    if 'is_reviewed' not in columns:
        if conn.dialect.name == 'postgresql':
            op.add_column('mentions', sa.Column('is_reviewed', sa.Boolean(), server_default='false', nullable=True))
        else:
            op.add_column('mentions', sa.Column('is_reviewed', sa.Boolean(), nullable=True, default=False))
            
    # 2. Add 'ignored' to AlertStatus enum
    if conn.dialect.name == 'postgresql':
        # In postgres, we can use ALTER TYPE to add a value to an enum
        try:
            with op.get_context().autocommit_block():
                op.execute("ALTER TYPE alertstatus ADD VALUE IF NOT EXISTS 'ignored'")
        except Exception as e:
            print(f"Warning: Could not add 'ignored' to alertstatus enum: {e}")
            pass

def downgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    columns = [col['name'] for col in inspector.get_columns('mentions')]
    if 'is_reviewed' in columns:
        op.drop_column('mentions', 'is_reviewed')
        
    # Note: downgrading Enums in Postgres is complex (cannot easily DROP VALUE). We skip it.
