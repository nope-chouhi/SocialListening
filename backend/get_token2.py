from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token
from datetime import timedelta
import json

db = SessionLocal()
user = db.query(User).first()
if user:
    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(minutes=30))
    print(token)
else:
    print("No user")
