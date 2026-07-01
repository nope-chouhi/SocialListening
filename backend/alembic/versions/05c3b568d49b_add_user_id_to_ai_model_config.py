"""add user_id to ai_model_config

Revision ID: 05c3b568d49b
Revises: 028_add_report_email_recipients
Create Date: 2026-06-30 23:03:49.687801

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '05c3b568d49b'
down_revision = '028_add_report_email_recipients'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('ai_model_config', schema=None) as batch_op:
        # Add column user_id
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
        
        # We assume PostgreSQL, create the constraint
        batch_op.create_foreign_key('fk_ai_model_config_user_id', 'users', ['user_id'], ['id'], ondelete='CASCADE')
        batch_op.create_index(batch_op.f('ix_ai_model_config_user_id'), ['user_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('ai_model_config', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_model_config_user_id'))
        batch_op.drop_constraint('fk_ai_model_config_user_id', type_='foreignkey')
        batch_op.drop_column('user_id')
