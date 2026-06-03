"""add all missing user_ids

Revision ID: add_all_missing_user_ids
Revises: add_user_id_multi_tenancy
Create Date: 2026-06-03 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = 'add_all_missing_user_ids'
down_revision = 'add_user_id_multi_tenancy'
branch_labels = None
depends_on = None

def _tables():
    return set(sa.inspect(op.get_bind()).get_table_names())

def _columns(table_name: str):
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}

def _add(table_name: str, column_name: str = "user_id"):
    if table_name in _tables() and column_name not in _columns(table_name):
        op.add_column(table_name, sa.Column(column_name, sa.Integer(), nullable=True))
        op.create_index(op.f(f'ix_{table_name}_{column_name}'), table_name, [column_name], unique=False)

def upgrade() -> None:
    # Basic user_id
    tables_with_user_id = [
        "keyword_groups",
        "alerts",
        "crawl_jobs",
        "scan_schedules",
        "incidents",
        "incident_logs",
        "sources",
        "source_items",
        "integration_accounts",
    ]
    for t in tables_with_user_id:
        _add(t, "user_id")
        
    # Discovery
    _add("discovery_jobs", "created_by_user_id")
    _add("blocked_domains", "blocked_by_user_id")
    
    # Reputation
    _add("reputation_cases", "assigned_to_user_id")
    _add("reputation_cases", "created_by_user_id")
    _add("reputation_evidence", "created_by_user_id")
    _add("reputation_actions", "approved_by_user_id")
    _add("reputation_actions", "created_by_user_id")


def downgrade() -> None:
    pass
