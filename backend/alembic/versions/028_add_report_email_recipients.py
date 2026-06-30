"""add_report_email_recipients

Revision ID: 028_add_report_email_recipients
Revises: 914d78ba6c8e
Create Date: 2026-06-30 15:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '028_add_report_email_recipients'
down_revision = '914d78ba6c8e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE system_notification_settings ADD COLUMN IF NOT EXISTS report_email_recipients TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE system_notification_settings DROP COLUMN IF EXISTS report_email_recipients")
