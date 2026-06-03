"""add user_id to mentions

Revision ID: add_user_id_multi_tenancy
Revises: 178fbcd3be6b
Create Date: 2026-06-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_user_id_multi_tenancy'
down_revision = '178fbcd3be6b'
branch_labels = None
depends_on = None


def _tables():
    try:
        return set(sa.inspect(op.get_bind()).get_table_names())
    except Exception:
        return set()

def _columns(table_name: str):
    try:
        return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}
    except Exception:
        return set()

def upgrade() -> None:
    tables = _tables()
    
    # 1. Add user_id to mentions
    if 'mentions' in tables:
        if 'user_id' not in _columns('mentions'):
            op.add_column('mentions', sa.Column('user_id', sa.Integer(), nullable=True))
            op.create_index(op.f('ix_mentions_user_id'), 'mentions', ['user_id'], unique=False)

    # 2. Add user_id to echo_keywords
    if 'echo_keywords' in tables:
        if 'user_id' not in _columns('echo_keywords'):
            op.add_column('echo_keywords', sa.Column('user_id', sa.Integer(), nullable=True))
            op.create_index(op.f('ix_echo_keywords_user_id'), 'echo_keywords', ['user_id'], unique=False)
        # also we changed keyword from unique=True to just index in models, but altering unique constraint is harder
        try:
            op.execute("ALTER TABLE echo_keywords DROP CONSTRAINT IF EXISTS echo_keywords_keyword_key")
        except Exception:
            pass
        try:
            op.execute("DROP INDEX IF EXISTS ix_echo_keywords_keyword")
        except Exception:
            pass
        try:
            op.create_index(op.f('ix_echo_keywords_keyword'), 'echo_keywords', ['keyword'], unique=False)
        except Exception:
            pass

    # 3. Add user_id to echo_mentions
    if 'echo_mentions' in tables:
        if 'user_id' not in _columns('echo_mentions'):
            op.add_column('echo_mentions', sa.Column('user_id', sa.Integer(), nullable=True))
            op.create_index(op.f('ix_echo_mentions_user_id'), 'echo_mentions', ['user_id'], unique=False)


def downgrade() -> None:
    tables = _tables()
    
    if 'echo_mentions' in tables and 'user_id' in _columns('echo_mentions'):
        try:
            op.drop_index(op.f('ix_echo_mentions_user_id'), table_name='echo_mentions')
            op.drop_column('echo_mentions', 'user_id')
        except Exception:
            pass

    if 'echo_keywords' in tables and 'user_id' in _columns('echo_keywords'):
        try:
            op.drop_index(op.f('ix_echo_keywords_user_id'), table_name='echo_keywords')
            op.drop_column('echo_keywords', 'user_id')
        except Exception:
            pass

    if 'mentions' in tables and 'user_id' in _columns('mentions'):
        try:
            op.drop_index(op.f('ix_mentions_user_id'), table_name='mentions')
            op.drop_column('mentions', 'user_id')
        except Exception:
            pass
