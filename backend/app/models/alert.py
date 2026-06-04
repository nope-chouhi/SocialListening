from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum, Boolean
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    ASSIGNED = "assigned"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, index=True, nullable=True) # Added for multi-tenancy
    user_id = Column(Integer, index=True, nullable=True)
    project_id = Column(Integer, nullable=True, index=True)
    mention_id = Column(Integer, nullable=False, index=True)
    
    # Alert details
    severity = Column(SQLEnum(AlertSeverity, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(SQLEnum(AlertStatus, values_callable=lambda x: [e.value for e in x]), default=AlertStatus.NEW, index=True)
    title = Column(String(500), nullable=False)
    message = Column(Text)
    
    # Assignment
    assigned_to = Column(Integer)  # User ID
    acknowledged_by = Column(Integer)  # User ID
    acknowledged_at = Column(DateTime(timezone=True))
    resolved_by = Column(Integer)  # User ID
    resolved_at = Column(DateTime(timezone=True))
    
    # Notification
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(String(500))  # Comma-separated: email,telegram,sms
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    channel_type = Column(String(50), nullable=False)  # email, telegram, sms, webhook, zalo
    is_active = Column(Boolean, default=True)
    
    # Configuration (JSON)
    config = Column(Text)  # JSON string with channel-specific config
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
