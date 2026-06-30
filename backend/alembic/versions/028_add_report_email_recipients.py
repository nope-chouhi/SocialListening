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
    op.add_column('system_notification_settings', sa.Column('report_email_recipients', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_notification_settings', 'report_email_recipients')
