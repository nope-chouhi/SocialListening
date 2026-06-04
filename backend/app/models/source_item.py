from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Index
from sqlalchemy.sql import func
from app.core.database import Base

class SourceItem(Base):
    __tablename__ = "source_items"
    
    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), index=True)  # rss, web, video, facebook, etc.
    platform = Column(String(100), index=True)
    source_id = Column(Integer, nullable=True, index=True)  # ID in 'sources' table if applicable
    source_name = Column(String(255), nullable=True)
    
    url = Column(Text, nullable=False)
    normalized_url = Column(Text, nullable=False, index=True)
    domain = Column(String(500), index=True)
    
    title = Column(Text)
    content = Column(Text, nullable=True)
    snippet = Column(Text, nullable=True)
    author = Column(String(500), nullable=True)
    
    published_at = Column(DateTime(timezone=True), index=True, nullable=True)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    guid = Column(String(500), index=True, nullable=True)
    image_url = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    media_thumbnail = Column(Text, nullable=True)
    
    content_hash = Column(String(64), unique=True, index=True)
    language = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    
    raw_payload_json = Column(JSON, nullable=True)
    status = Column(String(50), default="collected", index=True)  # collected, matched, discarded
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
