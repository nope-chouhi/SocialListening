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
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    
    if 'system_notification_settings' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('system_notification_settings')]
        if 'report_email_recipients' not in columns:
            op.add_column('system_notification_settings', sa.Column('report_email_recipients', sa.Text(), nullable=True))
    else:
        op.add_column('system_notification_settings', sa.Column('report_email_recipients', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    
    if 'system_notification_settings' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('system_notification_settings')]
        if 'report_email_recipients' in columns:
            op.drop_column('system_notification_settings', 'report_email_recipients')
