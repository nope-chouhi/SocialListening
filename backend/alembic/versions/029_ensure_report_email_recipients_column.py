"""ensure_report_email_recipients_column

Revision ID: 029_ensure_report_email_recipients
Revises: 05c3b568d49b
Create Date: 2026-06-30 23:59:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '029_ensure_report_email_recipients'
down_revision = '05c3b568d49b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE system_notification_settings
    ADD COLUMN IF NOT EXISTS report_email_recipients TEXT
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE system_notification_settings
    DROP COLUMN IF EXISTS report_email_recipients
    """)
