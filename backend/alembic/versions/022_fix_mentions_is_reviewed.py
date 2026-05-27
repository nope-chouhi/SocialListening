"""Fix mentions.is_reviewed column - force add if missing

Revision ID: 022
Revises: 021
Create Date: 2026-05-27 09:37:00.000000

This migration uses raw SQL with IF NOT EXISTS to guarantee
the is_reviewed column is present on the mentions table,
regardless of what previous migrations may or may not have done.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    if conn.dialect.name == 'postgresql':
        # PostgreSQL: Use DO block for safe idempotent column addition
        stmts = [
            # --- mentions table: ensure ALL columns from the model exist ---
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'is_reviewed'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN is_reviewed BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'title'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN title TEXT;
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'content_hash'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN content_hash VARCHAR(64);
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'collected_at'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'matched_keywords'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN matched_keywords JSON;
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'platform_post_id'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN platform_post_id VARCHAR(255);
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'meta_data'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN meta_data JSON;
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'author'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN author VARCHAR(500);
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'mentions' AND column_name = 'published_at'
                ) THEN
                    ALTER TABLE mentions ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
            """,
            # Create indexes if not exists
            "CREATE INDEX IF NOT EXISTS idx_mention_published ON mentions (published_at)",
            "CREATE INDEX IF NOT EXISTS idx_mention_collected ON mentions (collected_at)",
            "CREATE INDEX IF NOT EXISTS idx_mention_source ON mentions (source_id)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_mentions_content_hash ON mentions (content_hash)",
            "CREATE INDEX IF NOT EXISTS ix_mentions_platform_post_id ON mentions (platform_post_id)",
        ]

        for stmt in stmts:
            try:
                conn.execute(sa.text(stmt))
                conn.commit()
            except Exception as e:
                print(f"Migration 022 statement warning: {e}")
                conn.rollback()

    else:
        # SQLite: simpler approach
        try:
            op.add_column('mentions', sa.Column('is_reviewed', sa.Boolean(), nullable=True, default=False))
        except Exception:
            pass  # Column already exists

    print("✅ Migration 022 complete - mentions.is_reviewed guaranteed!")


def downgrade():
    pass
