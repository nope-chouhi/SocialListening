from app.core.database import engine, Base
# Import all models so they are registered with Base
from app.models.system_settings import WorkerStatus
from app.models import *

Base.metadata.create_all(bind=engine)
print("Tables created successfully.")
