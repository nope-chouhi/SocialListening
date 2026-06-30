"""add_ai_usage_log

Revision ID: 7a8e2eb4683b
Revises: c4a1e2f3b5d7
Create Date: 2026-06-28 17:51:19.877161

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a8e2eb4683b'
down_revision = 'c4a1e2f3b5d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    if 'ai_usage_logs' not in inspector.get_table_names():
        op.create_table(
            'ai_usage_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('model_config_id', sa.Integer(), nullable=True),
            sa.Column('provider', sa.String(length=50), nullable=False),
            sa.Column('model', sa.String(length=255), nullable=False),
            sa.Column('request_type', sa.String(length=50), nullable=False),
            sa.Column('input_tokens', sa.Integer(), nullable=True),
            sa.Column('output_tokens', sa.Integer(), nullable=True),
            sa.Column('total_tokens', sa.Integer(), nullable=True),
            sa.Column('estimated_cost', sa.Float(), nullable=True),
            sa.Column('success', sa.Boolean(), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['model_config_id'], ['ai_model_config.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_ai_usage_logs_id'), 'ai_usage_logs', ['id'], unique=False)
        op.create_index(op.f('ix_ai_usage_logs_model_config_id'), 'ai_usage_logs', ['model_config_id'], unique=False)
        op.create_index(op.f('ix_ai_usage_logs_organization_id'), 'ai_usage_logs', ['organization_id'], unique=False)
        op.create_index(op.f('ix_ai_usage_logs_user_id'), 'ai_usage_logs', ['user_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy.engine.reflection import Inspector
    inspector = Inspector.from_engine(bind)
    if 'ai_usage_logs' in inspector.get_table_names():
        op.drop_index(op.f('ix_ai_usage_logs_user_id'), table_name='ai_usage_logs')
        op.drop_index(op.f('ix_ai_usage_logs_organization_id'), table_name='ai_usage_logs')
        op.drop_index(op.f('ix_ai_usage_logs_model_config_id'), table_name='ai_usage_logs')
        op.drop_index(op.f('ix_ai_usage_logs_id'), table_name='ai_usage_logs')
        op.drop_table('ai_usage_logs')
