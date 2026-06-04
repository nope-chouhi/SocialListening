"""add_performance_indexes

Revision ID: 308ae8695f74
Revises: 0703f131f6ae
Create Date: 2026-06-04 14:24:09.327561

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '308ae8695f74'
down_revision = '0703f131f6ae'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add index on (project_id, collected_at) for faster trends/summary queries
    op.create_index('idx_mention_project_collected', 'mentions', ['project_id', 'collected_at'])
    
    # Add index on analyzed_at for AIAnalysis trends
    op.create_index('idx_analysis_analyzed_at', 'ai_analysis', ['analyzed_at'])

def downgrade() -> None:
    op.drop_index('idx_analysis_analyzed_at', table_name='ai_analysis')
    op.drop_index('idx_mention_project_collected', table_name='mentions')
