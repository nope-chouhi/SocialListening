from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from enum import Enum
from app.core.database import Base

class ReputationCaseType(str, Enum):
    NEGATIVE_CONTENT = "negative_content"
    MISINFORMATION = "misinformation"
    SUSPECTED_FAKE_NEWS = "suspected_fake_news"
    BRAND_HARM = "brand_harm"
    ABUSIVE_COMMENT = "abusive_comment"
    CUSTOMER_COMPLAINT = "customer_complaint"
    MEDIA_CRISIS = "media_crisis"
    IMPERSONATION = "impersonation"
    PLATFORM_POLICY_VIOLATION = "platform_policy_violation"
    OFFICIAL_RESPONSE = "official_response"
    CORRECTION_REQUEST = "correction_request"
    LEGAL_CASE = "legal_case"

class ReputationCaseStatus(str, Enum):
    NEW = "new"
    REVIEWING = "reviewing"
    COLLECTING_EVIDENCE = "collecting_evidence"
    DRAFTING_RESPONSE = "drafting_response"
    WAITING_APPROVAL = "waiting_approval"
    REQUEST_SENT = "request_sent"
    MONITORING = "monitoring"
    RESOLVED = "resolved"
    CLOSED = "closed"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class ReputationActionType(str, Enum):
    INTERNAL_NOTE = "internal_note"
    COLLECT_EVIDENCE = "collect_evidence"
    DRAFT_PUBLIC_RESPONSE = "draft_public_response"
    DRAFT_PRIVATE_RESPONSE = "draft_private_response"
    DRAFT_CORRECTION_REQUEST = "draft_correction_request"
    DRAFT_PLATFORM_REPORT = "draft_platform_report"
    ESCALATE_LEGAL = "escalate_legal"
    ASSIGN_OWNER = "assign_owner"
    MARK_RESOLVED = "mark_resolved"
    CLOSE_CASE = "close_case"

class ReputationActionStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"

class ReputationCase(Base):
    __tablename__ = "reputation_cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    case_type = Column(SQLEnum(ReputationCaseType, values_callable=lambda x: [e.value for e in x]), index=True)
    risk_level = Column(SQLEnum(RiskLevel, values_callable=lambda x: [e.value for e in x]), index=True)
    status = Column(SQLEnum(ReputationCaseStatus, values_callable=lambda x: [e.value for e in x]), default=ReputationCaseStatus.NEW, index=True)
    priority = Column(SQLEnum(Priority, values_callable=lambda x: [e.value for e in x]), default=Priority.MEDIUM, index=True)
    
    source_url = Column(String(1000))
    source_name = Column(String(255))
    source_type = Column(String(100))
    platform = Column(String(100))
    original_author = Column(String(255))
    
    mention_id = Column(Integer, ForeignKey("mentions.id"), nullable=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    
    assigned_department = Column(String(255), nullable=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    outcome = Column(Text, nullable=True)

    # Relationships
    mention = relationship("Mention")
    alert = relationship("Alert")
    incident = relationship("Incident")
    assigned_user = relationship("User", foreign_keys=[assigned_to_user_id])
    creator = relationship("User", foreign_keys=[created_by_user_id])
    evidence = relationship("ReputationEvidence", back_populates="case", cascade="all, delete-orphan")
    actions = relationship("ReputationAction", back_populates="case", cascade="all, delete-orphan")

class ReputationEvidence(Base):
    __tablename__ = "reputation_evidence"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("reputation_cases.id"), nullable=False, index=True)
    mention_id = Column(Integer, ForeignKey("mentions.id"), nullable=True, index=True)
    
    original_url = Column(String(1000))
    source_name = Column(String(255))
    source_type = Column(String(100))
    
    captured_text = Column(Text, nullable=False)
    captured_title = Column(String(500))
    captured_author = Column(String(255))
    captured_at = Column(DateTime(timezone=True), default=func.now())
    content_hash = Column(String(255), nullable=False)
    
    screenshot_url = Column(String(1000), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    case = relationship("ReputationCase", back_populates="evidence")
    mention = relationship("Mention")
    creator = relationship("User", foreign_keys=[created_by_user_id])

class ReputationAction(Base):
    __tablename__ = "reputation_actions"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("reputation_cases.id"), nullable=False, index=True)
    action_type = Column(SQLEnum(ReputationActionType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True) # Used for AI drafts or notes
    status = Column(SQLEnum(ReputationActionStatus, values_callable=lambda x: [e.value for e in x]), default=ReputationActionStatus.DRAFT, index=True)
    
    requires_approval = Column(Boolean, default=False)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    result_note = Column(Text, nullable=True)
    
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    case = relationship("ReputationCase", back_populates="actions")
    creator = relationship("User", foreign_keys=[created_by_user_id])
    approver = relationship("User", foreign_keys=[approved_by_user_id])
