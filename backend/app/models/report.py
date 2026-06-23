from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, JSON, Boolean
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class ReportType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CRISIS = "crisis"
    CUSTOM = "custom"


class ReportStatus(str, Enum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, index=True, nullable=True) # Added for multi-tenancy
    project_id = Column(Integer, index=True, nullable=True)
    # Report details
    report_type = Column(SQLEnum(ReportType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    
    # Time range
    start_date = Column(DateTime(timezone=True), nullable=False, index=True)
    end_date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Status
    status = Column(SQLEnum(ReportStatus, values_callable=lambda x: [e.value for e in x]), default=ReportStatus.GENERATING, index=True)
    
    # Report data (JSON)
    data = Column(JSON)  # Contains all metrics and charts data
    
    # Files
    pdf_path = Column(Text)
    excel_path = Column(Text)
    json_path = Column(Text)
    
    # Metadata
    generated_by = Column(Integer)  # User ID
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    
    # Email delivery
    email_sent = Column(Boolean, default=False)
    email_recipients = Column(Text)  # Comma-separated emails
    email_sent_at = Column(DateTime(timezone=True))


class SystemSettings(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text)
    value_type = Column(String(50), default="string")  # string, int, float, bool, json
    description = Column(Text)
    is_public = Column(Boolean, default=False)  # Can be accessed without auth
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ExportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

class ReportExport(Base):
    __tablename__ = "report_exports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50), nullable=False)  # 'pdf' or 'excel'
    project_id = Column(Integer, index=True, nullable=True)
    requested_by = Column(Integer, nullable=False, index=True)
    
    status = Column(SQLEnum(ExportStatus, values_callable=lambda x: [e.value for e in x]), default=ExportStatus.PENDING, index=True)
    file_path = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
