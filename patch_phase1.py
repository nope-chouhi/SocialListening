import os
import sys

# 1. Update models/__init__.py
init_path = "backend/app/models/__init__.py"
with open(init_path, "r", encoding="utf-8") as f:
    init_content = f.read()

if "from app.models.source_item import SourceItem" not in init_content:
    with open(init_path, "a", encoding="utf-8") as f:
        f.write("\nfrom app.models.source_item import SourceItem\n")

# 2. Additive migration script to create table safely without alembic
# (We use SQLAlchemy create_all, which only creates missing tables)
create_table_script = """
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import engine, Base
# Import all models to ensure metadata is populated
from app.models import *

print("Creating missing tables...")
Base.metadata.create_all(bind=engine)
print("Done.")
"""

with open("create_tables.py", "w", encoding="utf-8") as f:
    f.write(create_table_script)

print("Phase 1 scripts generated.")
