
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import engine, Base
# Import all models to ensure metadata is populated
from app.models import *

print("Creating missing tables...")
Base.metadata.create_all(bind=engine)
print("Done.")
