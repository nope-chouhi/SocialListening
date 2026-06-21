from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class OrganizationSettings(Base):
    """Single row table for organization settings"""
    __tablename__ = "organization_settings"
    
    id = Column(Integer, primary_key=True)  # Always 1
    organization_name = Column(String(255), nullable=False, default='My Organization')
    logo_url = Column(Text)
    address = Column(Text)
    contact_email = Column(String(255))
    hotline = Column(String(50))
    website = Column(String(255))
    timezone = Column(String(50), default='Asia/Ho_Chi_Minh')
    language = Column(String(10), default='vi')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class EmailSettings(Base):
    """Single row table for email/SMTP settings"""
    __tablename__ = "email_settings"
    
    id = Column(Integer, primary_key=True)  # Always 1
    smtp_host = Column(String(255))
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String(255))
    smtp_password = Column(Text)  # Should be encrypted in production
    from_email = Column(String(255))
    from_name = Column(String(255))
    use_tls = Column(Boolean, default=True, nullable=False)
    use_ssl = Column(Boolean, default=False, nullable=False)
    is_configured = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SystemNotificationSettings(Base):
    """Single row table for system notification settings"""
    __tablename__ = "system_notification_settings"
    
    id = Column(Integer, primary_key=True)  # Always 1
    webhook_url = Column(Text)
    telegram_webhook = Column(Text)
    slack_webhook = Column(Text)
    discord_webhook = Column(Text)
    system_alerts_enabled = Column(Boolean, default=True, nullable=False)
    alert_channels = Column(JSON)  # Array: ['email', 'telegram', 'slack', 'discord']
    
    # Report scheduling
    daily_report_enabled = Column(Boolean, default=False, nullable=False)
    daily_report_time = Column(String(10), default='09:00')  # HH:MM
    weekly_report_enabled = Column(Boolean, default=False, nullable=False)
    weekly_report_day = Column(Integer, default=0)  # 0=Monday, 6=Sunday
    weekly_report_time = Column(String(10), default='09:00')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WorkerStatus(Base):
    """Single row table for tracking worker status and heartbeat"""
    __tablename__ = "worker_status"
    
    id = Column(Integer, primary_key=True)  # Always 1
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    running_jobs = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    
    # Locking & Concurrency
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Observability Metrics
    scan_interval_minutes = Column(Integer, default=15, nullable=False)
    last_started_at = Column(DateTime(timezone=True), nullable=True)
    last_finished_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    last_scan_count = Column(Integer, default=0, nullable=False)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    skipped_due_to_lock_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

