from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Plan(Base):
    __tablename__ = "plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), unique=True, index=True, nullable=False)  # trial, basic, pro, enterprise
    price_monthly = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(10), default="USD")
    
    # Limits
    max_users = Column(Integer, default=1)
    max_projects = Column(Integer, default=1)
    max_keywords = Column(Integer, default=5)
    max_sources = Column(Integer, default=10)
    max_scan_runs_per_month = Column(Integer, default=100)
    max_alerts = Column(Integer, default=5)
    max_exports_per_month = Column(Integer, default=5)
    max_history_days = Column(Integer, default=30)
    allowed_platforms_json = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrganizationPlan(Base):
    __tablename__ = "organization_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey('plans.id', ondelete='RESTRICT'), nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active, cancelled, expired
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)


class UsageEvent(Base):
    __tablename__ = "usage_events"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey('keyword_groups.id', ondelete='SET NULL'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    event_type = Column(String(100), nullable=False, index=True)  # search, scan, alert, export
    event_name = Column(String(255), nullable=False)  # search.manual, scan.auto, etc.
    quantity = Column(Integer, default=1, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
