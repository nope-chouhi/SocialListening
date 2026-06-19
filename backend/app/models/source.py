from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, JSON, Time
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class SourceType(str, Enum):
    FACEBOOK_PAGE = "facebook_page"
    FACEBOOK_GROUP = "facebook_group"
    FACEBOOK_PROFILE = "facebook_profile"
    INSTAGRAM_BUSINESS = "instagram_business"
    YOUTUBE_CHANNEL = "youtube_channel"
    YOUTUBE_VIDEO = "youtube_video"
    WEBSITE = "website"
    NEWS = "news"
    RSS = "rss"
    FORUM = "forum"
    MANUAL_URL = "manual_url"
    GLOBAL_SEARCH = "global_search"


class CrawlFrequency(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    MANUAL = "manual"


class SourceGroup(Base):
    __tablename__ = "source_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, index=True, nullable=True) # Added for multi-tenancy
    user_id = Column(Integer, index=True, nullable=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    


class Source(Base):
    """Specific sources (e.g., a specific Facebook page URL or YouTube channel)"""
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, index=True, nullable=True) # Added for multi-tenancy
    user_id = Column(Integer, index=True, nullable=True)
    group_id = Column(Integer, index=True)
    name = Column(String(500), nullable=False)
    source_type = Column(SQLEnum(SourceType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    url = Column(Text, nullable=False)
    
    # Discovery Info
    platform = Column(String(100), index=True)
    category = Column(String(100), index=True)
    domain = Column(String(500), index=True)
    
    # Metadata
    platform_id = Column(String(255))  # Facebook ID, YouTube channel ID, etc.
    meta_data = Column(JSON)  # Additional platform-specific data (renamed from metadata)
    
    # Crawl Schedule
    crawl_frequency = Column(SQLEnum(CrawlFrequency, values_callable=lambda x: [e.value for e in x]), default=CrawlFrequency.MANUAL, index=True)
    crawl_time = Column(Time)  # For daily: specific time (e.g., 09:00)
    crawl_day_of_week = Column(Integer)  # For weekly: 0=Monday, 6=Sunday (legacy single value)
    crawl_day_of_month = Column(Integer)  # For monthly: 1-31 (legacy single value)
    crawl_month = Column(Integer)  # For yearly: 1-12 (legacy single value)
    
    # New: Multiple selections support (JSON arrays)
    schedule_days_of_week = Column(JSON)  # Array of integers [0-6] for weekly
    schedule_days_of_month = Column(JSON)  # Array of integers [1-31] for monthly
    schedule_months = Column(JSON)  # Array of integers [1-12] for yearly
    schedule_hours = Column(JSON)  # Array of hours [0-23] for daily
    
    next_crawl_at = Column(DateTime(timezone=True))  # Calculated next crawl time
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    last_crawled_at = Column(DateTime(timezone=True))
    last_success_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    crawl_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
