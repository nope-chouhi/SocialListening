from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum


# Enums
class ServiceTypeEnum(str, Enum):
    CRISIS_CONSULTING = "crisis_consulting"
    MONITORING = "monitoring"
    LEGAL_TAKEDOWN = "legal_takedown"
    PRESS_MEDIA = "press_media"
    COPYRIGHT_PROTECTION = "copyright_protection"
    COMMUNITY_RESPONSE = "community_response"
    REPUTATION_MANAGEMENT = "reputation_management"
    EVIDENCE_COLLECTION = "evidence_collection"
    AI_REPORTING = "ai_reporting"


class PlatformEnum(str, Enum):
    FACEBOOK = "facebook"
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    WEBSITE = "website"
    NEWS_MEDIA = "news_media"
    ALL_PLATFORMS = "all_platforms"


class RiskLevelEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ServiceRequestStatusEnum(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    WAITING_EXTERNAL_RESPONSE = "waiting_external_response"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalStatusEnum(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUIRED = "revision_required"


class PriorityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class DeliverableTypeEnum(str, Enum):
    REPORT = "report"
    DRAFT_RESPONSE = "draft_response"
    LEGAL_DOCUMENT = "legal_document"
    EVIDENCE_PACKAGE = "evidence_package"
    STRATEGY_PLAN = "strategy_plan"
    BRIEFING = "briefing"
    MONITORING_DASHBOARD = "monitoring_dashboard"


# Service Category Schemas
class ServiceCategoryBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    is_active: bool = True


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceCategoryResponse(BaseModel):
    id: int
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Service Schemas
class ServiceBase(BaseModel):
    category_id: int
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    service_type: ServiceTypeEnum
    platform: PlatformEnum
    legal_basis: Optional[str] = None
    workflow_template: Optional[Dict[str, Any]] = None
    deliverables: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[str] = Field(None, max_length=100)
    sla_hours: Optional[int] = None
    base_price: Optional[Decimal] = None
    min_quantity: int = 1
    unit: Optional[str] = Field(None, max_length=50)
    risk_level: RiskLevelEnum = RiskLevelEnum.LOW
    requires_approval: bool = True
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    category_id: Optional[int] = None
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    service_type: Optional[ServiceTypeEnum] = None
    platform: Optional[PlatformEnum] = None
    legal_basis: Optional[str] = None
    workflow_template: Optional[Dict[str, Any]] = None
    deliverables: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[str] = Field(None, max_length=100)
    sla_hours: Optional[int] = None
    base_price: Optional[Decimal] = None
    min_quantity: Optional[int] = None
    unit: Optional[str] = Field(None, max_length=50)
    risk_level: Optional[RiskLevelEnum] = None
    requires_approval: Optional[bool] = None
    is_active: Optional[bool] = None


class ServiceResponse(ServiceBase):
    id: int
    category: ServiceCategoryResponse
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Service Request Schemas
class ServiceRequestBase(BaseModel):
    service_id: int
    related_mention_id: Optional[int] = None
    related_alert_id: Optional[int] = None
    related_incident_id: Optional[int] = None
    priority: PriorityEnum = PriorityEnum.MEDIUM
    request_reason: Optional[str] = None
    evidence_summary: Optional[str] = None
    desired_outcome: Optional[str] = None
    quoted_price: Optional[Decimal] = None
    deadline: Optional[datetime] = None


class ServiceRequestCreate(ServiceRequestBase):
    pass


class ServiceRequestUpdate(BaseModel):
    service_id: Optional[int] = None
    related_mention_id: Optional[int] = None
    related_alert_id: Optional[int] = None
    related_incident_id: Optional[int] = None
    assigned_to: Optional[int] = None
    status: Optional[ServiceRequestStatusEnum] = None
    priority: Optional[PriorityEnum] = None
    request_reason: Optional[str] = None
    evidence_summary: Optional[str] = None
    desired_outcome: Optional[str] = None
    approval_status: Optional[ApprovalStatusEnum] = None
    quoted_price: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    deadline: Optional[datetime] = None
    result_summary: Optional[str] = None


class ServiceRequestResponse(ServiceRequestBase):
    id: int
    requester_id: int
    assigned_to: Optional[int] = None
    status: ServiceRequestStatusEnum
    approval_status: ApprovalStatusEnum
    final_price: Optional[Decimal] = None
    result_summary: Optional[str] = None
    service: ServiceResponse
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Service Request Action Schemas
class ServiceRequestSubmit(BaseModel):
    note: Optional[str] = None


class ServiceRequestApprove(BaseModel):
    final_price: Optional[Decimal] = None
    note: Optional[str] = None


class ServiceRequestReject(BaseModel):
    note: str


class ServiceRequestComplete(BaseModel):
    result_summary: str
    note: Optional[str] = None


class ServiceRequestCancel(BaseModel):
    note: str


# Service Request Log Schemas
class ServiceRequestLogBase(BaseModel):
    action: str = Field(..., max_length=100)
    old_status: Optional[str] = Field(None, max_length=50)
    new_status: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = None


class ServiceRequestLogCreate(ServiceRequestLogBase):
    pass


class ServiceRequestLogResponse(ServiceRequestLogBase):
    id: int
    service_request_id: int
    created_by: int
    created_at: datetime

    class Config:
        orm_mode = True


# Service Deliverable Schemas
class ServiceDeliverableBase(BaseModel):
    deliverable_type: DeliverableTypeEnum
    title: str = Field(..., max_length=500)
    content: Optional[str] = None
    file_url: Optional[str] = Field(None, max_length=1000)
    approval_status: ApprovalStatusEnum = ApprovalStatusEnum.PENDING


class ServiceDeliverableCreate(ServiceDeliverableBase):
    pass


class ServiceDeliverableUpdate(BaseModel):
    deliverable_type: Optional[DeliverableTypeEnum] = None
    title: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    file_url: Optional[str] = Field(None, max_length=1000)
    approval_status: Optional[ApprovalStatusEnum] = None


class ServiceDeliverableResponse(ServiceDeliverableBase):
    id: int
    service_request_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Dashboard Schemas
class ServiceDashboardSummary(BaseModel):
    total_active_services: int
    open_service_requests: int
    pending_approvals: int
    completed_requests: int
    high_risk_requests: int
    monthly_estimated_cost: Decimal


# Service Recommendation Schemas
class ServiceRecommendationRequest(BaseModel):
    mention_id: Optional[int] = None
    alert_id: Optional[int] = None
    incident_id: Optional[int] = None
    content_summary: Optional[str] = None
    risk_level: Optional[RiskLevelEnum] = None
    platform: Optional[PlatformEnum] = None


class ServiceRecommendationResponse(BaseModel):
    recommended_services: List[ServiceResponse]
    reasoning: str
    estimated_total_cost: Optional[Decimal] = None
    estimated_timeline: Optional[str] = None
