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
    else:
        # Verify and add missing columns
        existing_columns = [c['name'] for c in inspector.get_columns('ai_usage_logs')]
        
        with op.batch_alter_table('ai_usage_logs', schema=None) as batch_op:
            if 'organization_id' not in existing_columns:
                batch_op.add_column(sa.Column('organization_id', sa.Integer(), nullable=True))
                batch_op.create_foreign_key('fk_ai_usage_logs_organization_id', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
            if 'user_id' not in existing_columns:
                batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
                batch_op.create_foreign_key('fk_ai_usage_logs_user_id', 'users', ['user_id'], ['id'], ondelete='SET NULL')
            if 'model_config_id' not in existing_columns:
                batch_op.add_column(sa.Column('model_config_id', sa.Integer(), nullable=True))
                batch_op.create_foreign_key('fk_ai_usage_logs_model_config_id', 'ai_model_config', ['model_config_id'], ['id'], ondelete='SET NULL')
            if 'provider' not in existing_columns:
                batch_op.add_column(sa.Column('provider', sa.String(length=50), nullable=False, server_default='gemini'))
            if 'model' not in existing_columns:
                batch_op.add_column(sa.Column('model', sa.String(length=255), nullable=False, server_default='gemini-1.5-flash'))
            if 'request_type' not in existing_columns:
                batch_op.add_column(sa.Column('request_type', sa.String(length=50), nullable=False, server_default='chat'))
            if 'input_tokens' not in existing_columns:
                batch_op.add_column(sa.Column('input_tokens', sa.Integer(), nullable=True))
            if 'output_tokens' not in existing_columns:
                batch_op.add_column(sa.Column('output_tokens', sa.Integer(), nullable=True))
            if 'total_tokens' not in existing_columns:
                batch_op.add_column(sa.Column('total_tokens', sa.Integer(), nullable=True))
            if 'estimated_cost' not in existing_columns:
                batch_op.add_column(sa.Column('estimated_cost', sa.Float(), nullable=True))
            if 'success' not in existing_columns:
                batch_op.add_column(sa.Column('success', sa.Boolean(), nullable=False, server_default='true'))
            if 'error_message' not in existing_columns:
                batch_op.add_column(sa.Column('error_message', sa.Text(), nullable=True))
            if 'created_at' not in existing_columns:
                batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))

        # Verify and create missing indexes
        existing_indexes = [i['name'] for i in inspector.get_indexes('ai_usage_logs')]
        
        if 'ix_ai_usage_logs_id' not in existing_indexes:
            op.create_index(op.f('ix_ai_usage_logs_id'), 'ai_usage_logs', ['id'], unique=False)
        if 'ix_ai_usage_logs_model_config_id' not in existing_indexes:
            op.create_index(op.f('ix_ai_usage_logs_model_config_id'), 'ai_usage_logs', ['model_config_id'], unique=False)
        if 'ix_ai_usage_logs_organization_id' not in existing_indexes:
            op.create_index(op.f('ix_ai_usage_logs_organization_id'), 'ai_usage_logs', ['organization_id'], unique=False)
        if 'ix_ai_usage_logs_user_id' not in existing_indexes:
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
