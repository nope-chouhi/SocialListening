from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class WebinarRegistration(Base):
    __tablename__ = "webinar_registrations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    webinar_title = Column(String(255), nullable=False)
    webinar_time = Column(String(255), nullable=False)
    timezone = Column(String(50), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
