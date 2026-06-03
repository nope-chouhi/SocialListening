from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, Boolean, JSON
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class CrawlJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_NO_RESULTS = "completed_no_results"
    FAILED = "failed"
    PARTIAL_FAILED = "partial_failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"



class CrawlJob(Base):
    __tablename__ = "crawl_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    
    # Job details
    job_type = Column(String(50), nullable=False)  # manual, scheduled
    source_ids = Column(JSON)  # List of source IDs to crawl
    keyword_group_ids = Column(JSON)  # List of keyword group IDs to match
    
    # Status
    status = Column(SQLEnum(CrawlJobStatus, values_callable=lambda x: [e.value for e in x]), default=CrawlJobStatus.PENDING, index=True)
    
    # Progress
    total_sources = Column(Integer, default=0)
    processed_sources = Column(Integer, default=0)
    mentions_found = Column(Integer, default=0)
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Metadata
    meta_data = Column(JSON)  # Additional job-specific data (renamed from metadata)


class ScanSchedule(Base):
    __tablename__ = "scan_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Schedule configuration
    cron_expression = Column(String(100), nullable=False)  # Cron format
    timezone = Column(String(50), default="Asia/Ho_Chi_Minh")
    
    # Target
    source_group_ids = Column(JSON)  # List of source group IDs
    keyword_group_ids = Column(JSON)  # List of keyword group IDs
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    last_run_at = Column(DateTime(timezone=True))
    next_run_at = Column(DateTime(timezone=True), index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
