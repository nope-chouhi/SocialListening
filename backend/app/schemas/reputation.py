from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.reputation import ReputationCaseType, ReputationCaseStatus, RiskLevel, Priority, ReputationActionType, ReputationActionStatus

# Evidence Schemas
class ReputationEvidenceBase(BaseModel):
    original_url: Optional[str] = None
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    captured_text: str
    captured_title: Optional[str] = None
    captured_author: Optional[str] = None
    notes: Optional[str] = None

class ReputationEvidenceCreate(ReputationEvidenceBase):
    pass

class ReputationEvidenceOut(ReputationEvidenceBase):
    id: int
    case_id: int
    mention_id: Optional[int] = None
    captured_at: datetime
    content_hash: str
    created_by_user_id: Optional[int] = None

    class Config:
        from_attributes = True

# Action Schemas
class ReputationActionBase(BaseModel):
    action_type: ReputationActionType
    title: str
    content: Optional[str] = None
    status: Optional[ReputationActionStatus] = ReputationActionStatus.DRAFT

class ReputationActionCreate(ReputationActionBase):
    requires_approval: Optional[bool] = False

class ReputationActionUpdate(BaseModel):
    status: Optional[ReputationActionStatus] = None
    content: Optional[str] = None
    result_note: Optional[str] = None

class ReputationActionOut(ReputationActionBase):
    id: int
    case_id: int
    requires_approval: bool
    approved_by_user_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    result_note: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Case Schemas
class ReputationCaseBase(BaseModel):
    title: str
    description: Optional[str] = None
    case_type: Optional[ReputationCaseType] = None
    risk_level: Optional[RiskLevel] = None
    status: Optional[ReputationCaseStatus] = ReputationCaseStatus.NEW
    priority: Optional[Priority] = Priority.MEDIUM
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    platform: Optional[str] = None
    original_author: Optional[str] = None
    assigned_department: Optional[str] = None
    assigned_to_user_id: Optional[int] = None
    deadline_at: Optional[datetime] = None

class ReputationCaseCreate(ReputationCaseBase):
    mention_id: Optional[int] = None
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None

class ReputationCaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[ReputationCaseType] = None
    risk_level: Optional[RiskLevel] = None
    status: Optional[ReputationCaseStatus] = None
    priority: Optional[Priority] = None
    assigned_department: Optional[str] = None
    assigned_to_user_id: Optional[int] = None
    deadline_at: Optional[datetime] = None
    outcome: Optional[str] = None

class ReputationCaseOut(ReputationCaseBase):
    id: int
    mention_id: Optional[int] = None
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    outcome: Optional[str] = None

    class Config:
        from_attributes = True

class ReputationCaseDetail(ReputationCaseOut):
    evidence: List[ReputationEvidenceOut] = []
    actions: List[ReputationActionOut] = []

    class Config:
        from_attributes = True
