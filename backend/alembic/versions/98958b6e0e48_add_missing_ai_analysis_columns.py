from alembic import op
import sqlalchemy as sa

revision = '98958b6e0e48'
down_revision = '013_add_schedule_arrays'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add missing columns to ai_analysis table
    op.add_column('ai_analysis', sa.Column('urgency', sa.String(length=50), nullable=True))
    op.add_column('ai_analysis', sa.Column('response_type', sa.String(length=100), nullable=True))
    op.add_column('ai_analysis', sa.Column('recommended_owner', sa.String(length=100), nullable=True))
    op.add_column('ai_analysis', sa.Column('deadline_suggestion', sa.String(length=100), nullable=True))
    op.add_column('ai_analysis', sa.Column('escalation_needed', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('ai_analysis', sa.Column('why_it_matters', sa.Text(), nullable=True))
    op.add_column('ai_analysis', sa.Column('vietnamese_context_label', sa.String(length=100), nullable=True))
    op.add_column('ai_analysis', sa.Column('tone', sa.String(length=50), nullable=True))
    op.add_column('ai_analysis', sa.Column('sarcasm_possible', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('ai_analysis', sa.Column('complaint_type', sa.String(length=100), nullable=True))
    op.add_column('ai_analysis', sa.Column('sensitive_signal', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('ai_analysis', sa.Column('explanation', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('ai_analysis', 'explanation')
    op.drop_column('ai_analysis', 'sensitive_signal')
    op.drop_column('ai_analysis', 'complaint_type')
    op.drop_column('ai_analysis', 'sarcasm_possible')
    op.drop_column('ai_analysis', 'tone')
    op.drop_column('ai_analysis', 'vietnamese_context_label')
    op.drop_column('ai_analysis', 'why_it_matters')
    op.drop_column('ai_analysis', 'escalation_needed')
    op.drop_column('ai_analysis', 'deadline_suggestion')
    op.drop_column('ai_analysis', 'recommended_owner')
    op.drop_column('ai_analysis', 'response_type')
    op.drop_column('ai_analysis', 'urgency')
