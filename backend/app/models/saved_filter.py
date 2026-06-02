from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class SavedFilter(Base):
    __tablename__ = "saved_filters"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    filter_json = Column(JSON, nullable=False)  # Stores the filter configuration
    created_by = Column(Integer, nullable=True)  # User ID
    is_default = Column(Boolean, default=False)  # Mark as default filter for project
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
