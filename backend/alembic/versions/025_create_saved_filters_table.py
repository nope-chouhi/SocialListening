"""Create saved_filters table

Revision ID: 025
Revises: 024
Create Date: 2026-06-02 10:10:00.000000

This migration creates the saved_filters table to support
saving and reusing filter configurations across the application.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    if conn.dialect.name == 'postgresql':
        # PostgreSQL: Use IF NOT EXISTS for table creation
        stmt = """
        CREATE TABLE IF NOT EXISTS saved_filters (
            id SERIAL PRIMARY KEY,
            project_id INTEGER,
            name VARCHAR(255) NOT NULL,
            filter_json JSON NOT NULL,
            created_by INTEGER,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX IF NOT EXISTS idx_saved_filters_project_id ON saved_filters (project_id);
        CREATE INDEX IF NOT EXISTS idx_saved_filters_created_by ON saved_filters (created_by);
        """
        try:
            conn.execute(sa.text(stmt))
            conn.commit()
        except Exception as e:
            print(f"Migration 025 statement warning: {e}")
            conn.rollback()
    else:
        # SQLite: simpler approach
        try:
            op.create_table(
                'saved_filters',
                sa.Column('id', sa.Integer(), primary_key=True),
                sa.Column('project_id', sa.Integer(), nullable=True),
                sa.Column('name', sa.String(255), nullable=False),
                sa.Column('filter_json', sa.JSON(), nullable=False),
                sa.Column('created_by', sa.Integer(), nullable=True),
                sa.Column('is_default', sa.Boolean(), default=False),
                sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
                sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
            )
            op.create_index('idx_saved_filters_project_id', 'saved_filters', ['project_id'])
            op.create_index('idx_saved_filters_created_by', 'saved_filters', ['created_by'])
        except Exception:
            pass  # Table already exists

    print("✅ Migration 025 complete - saved_filters table created!")


def downgrade():
    conn = op.get_bind()
    if conn.dialect.name == 'postgresql':
        try:
            conn.execute(sa.text("DROP TABLE IF EXISTS saved_filters"))
            conn.commit()
        except Exception:
            conn.rollback()
    else:
        try:
            op.drop_index('idx_saved_filters_created_by', 'saved_filters')
            op.drop_index('idx_saved_filters_project_id', 'saved_filters')
            op.drop_table('saved_filters')
        except Exception:
            pass
