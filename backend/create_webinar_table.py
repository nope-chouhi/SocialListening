import sys
import os
from dotenv import load_dotenv
load_dotenv('.env')
sys.path.append(os.getcwd())
from app.core.database import engine
from app.models.webinar import WebinarRegistration
WebinarRegistration.metadata.create_all(bind=engine)
print("Table created!")
