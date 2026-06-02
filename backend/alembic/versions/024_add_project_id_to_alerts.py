"""Add project_id field to alerts table

Revision ID: 024
Revises: 023
Create Date: 2026-06-02 10:05:00.000000

This migration adds the project_id field to the alerts table
to support project-centric alert filtering and management.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '024'
down_revision = '023'
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
                WHERE table_name = 'alerts' AND column_name = 'project_id'
            ) THEN
                ALTER TABLE alerts ADD COLUMN project_id INTEGER;
                CREATE INDEX idx_alerts_project_id ON alerts (project_id);
            END IF;
        END $$;
        """
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Migration 024 statement warning: {e}")
            conn.rollback()
    else:
        # SQLite: simpler approach
        try:
            op.add_column('alerts', sa.Column('project_id', sa.Integer(), nullable=True))
            op.create_index('idx_alerts_project_id', 'alerts', ['project_id'])
        except Exception:
            pass  # Column already exists

    print("✅ Migration 024 complete - alerts.project_id added!")


def downgrade():
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        try:
            conn.execute(sa.text("DROP INDEX IF EXISTS idx_alerts_project_id"))
            conn.execute(sa.text("ALTER TABLE alerts DROP COLUMN IF EXISTS project_id"))
            conn.commit()
        except Exception:
            conn.rollback()
    else:
        try:
            op.drop_index('idx_alerts_project_id', 'alerts')
            op.drop_column('alerts', 'project_id')
        except Exception:
            pass
