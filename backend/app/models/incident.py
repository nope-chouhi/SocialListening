from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, Boolean
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class IncidentStatus(str, Enum):
    NEW = "new"
    VERIFYING = "verifying"
    RESPONDING = "responding"
    WAITING_LEGAL = "waiting_legal"
    WAITING_PLATFORM = "waiting_platform"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TakedownStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"


class TakedownPlatform(str, Enum):
    FACEBOOK = "facebook"
    YOUTUBE = "youtube"
    GOOGLE = "google"
    TIKTOK = "tiktok"
    ZALO = "zalo"
    AUTHORITY = "authority"
    OTHER = "other"


class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    mention_id = Column(Integer, nullable=False, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    
    # Incident details
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(SQLEnum(IncidentStatus, values_callable=lambda x: [e.value for e in x]), default=IncidentStatus.NEW, index=True)
    
    # Deadline
    deadline = Column(DateTime(timezone=True), index=True)
    is_overdue = Column(Boolean, default=False, index=True)
    
    # Outcome
    outcome = Column(Text)
    resolution_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    


class IncidentLog(Base):
    __tablename__ = "incident_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer)
    
    # Log entry
    action = Column(String(100), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    notes = Column(Text)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    


class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    
    # File details
    file_name = Column(String(500), nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(String(100))  # screenshot, document, archive, etc.
    file_size = Column(Integer)
    
    # Chain of custody
    captured_by = Column(Integer)  # User ID
    capture_method = Column(String(100))  # auto_screenshot, manual_upload, etc.
    original_url = Column(Text)
    
    # Metadata
    meta_data = Column(Text)  # JSON string with additional data (renamed from metadata)
    
    # Timestamps
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    


class TakedownRequest(Base):
    __tablename__ = "takedown_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, nullable=False, index=True)
    
    # Request details
    platform = Column(SQLEnum(TakedownPlatform, values_callable=lambda x: [e.value for e in x]), nullable=False)
    content_url = Column(Text, nullable=False)
    reason = Column(String(100), nullable=False)  # defamation, misinformation, copyright, etc.
    description = Column(Text, nullable=False)
    
    # Status
    status = Column(SQLEnum(TakedownStatus, values_callable=lambda x: [e.value for e in x]), default=TakedownStatus.DRAFT)
    
    # Approval workflow
    submitted_by = Column(Integer)  # User ID
    approved_by = Column(Integer)  # User ID
    approved_at = Column(DateTime(timezone=True))
    
    # Submission
    submitted_at = Column(DateTime(timezone=True))
    platform_reference = Column(String(255))  # Platform's case/ticket number
    
    # Response
    platform_response = Column(Text)
    completed_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    


class ResponseTemplate(Base):
    __tablename__ = "response_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    template_type = Column(String(100), nullable=False)  # public_statement, customer_reply, legal_takedown, press_response
    language = Column(String(10), default="vi")
    
    # Template content
    subject = Column(String(500))
    body = Column(Text, nullable=False)
    
    # Variables that can be used in template
    variables = Column(Text)  # JSON array of variable names
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
