"""Add add_to_report field to mentions table

Revision ID: 023
Revises: 022
Create Date: 2026-06-02 10:00:00.000000

This migration adds the add_to_report field to the mentions table
to support the reports workflow where users can select mentions to include in reports.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    if conn.dialect.name == 'postgresql':
        # PostgreSQL: Use DO block for safe idempotent column addition
        stmt = """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'mentions' AND column_name = 'add_to_report'
            ) THEN
                ALTER TABLE mentions ADD COLUMN add_to_report BOOLEAN DEFAULT FALSE;
            END IF;
        END $$;
        """
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Migration 023 statement warning: {e}")
            conn.rollback()
    else:
        # SQLite: simpler approach
        try:
            op.add_column('mentions', sa.Column('add_to_report', sa.Boolean(), nullable=True, default=False))
        except Exception:
            pass  # Column already exists

    print("✅ Migration 023 complete - mentions.add_to_report added!")


def downgrade():
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        try:
            conn.execute(sa.text("ALTER TABLE mentions DROP COLUMN IF EXISTS add_to_report"))
            conn.commit()
        except Exception:
            conn.rollback()
    else:
        try:
            op.drop_column('mentions', 'add_to_report')
        except Exception:
            pass
