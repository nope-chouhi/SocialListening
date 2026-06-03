"""clean_invalid_keyword_types

Revision ID: 178fbcd3be6b
Revises: 34cb86bf9561
Create Date: 2026-06-03 09:18:44.649440

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '178fbcd3be6b'
down_revision = '34cb86bf9561'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safely update known invalid values using CAST to handle both VARCHAR and ENUM natively
    op.execute("UPDATE keywords SET keyword_type = 'brand' WHERE CAST(keyword_type AS VARCHAR) IN ('PRODUCT', 'Product', 'product', 'products', 'BRAND')")
    op.execute("UPDATE keywords SET keyword_type = 'general' WHERE CAST(keyword_type AS VARCHAR) IN ('GENERAL')")
    op.execute("UPDATE keywords SET keyword_type = 'competitor' WHERE CAST(keyword_type AS VARCHAR) IN ('COMPETITOR')")
    
    # Update any remaining unknown values to general
    op.execute("UPDATE keywords SET keyword_type = 'general' WHERE CAST(keyword_type AS VARCHAR) NOT IN ('general', 'brand', 'competitor', 'person', 'service', 'location', 'hashtag', 'negative_phrase', 'positive_phrase')")


def downgrade() -> None:
    pass
