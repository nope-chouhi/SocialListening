from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models.alert import AlertSeverity, AlertStatus


# Alert Schemas
class AlertBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    message: Optional[str] = None
    severity: AlertSeverity


class AlertCreate(AlertBase):
    mention_id: int
    notification_channels: Optional[str] = None


class AlertUpdate(BaseModel):
    status: Optional[AlertStatus] = None
    assigned_to: Optional[int] = None
    message: Optional[str] = None


class AlertAcknowledge(BaseModel):
    pass


class AlertResolve(BaseModel):
    resolution_notes: Optional[str] = None


class AlertResponse(AlertBase):
    id: int
    mention_id: int
    status: AlertStatus
    assigned_to: Optional[int]
    acknowledged_by: Optional[int]
    acknowledged_at: Optional[datetime]
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    notification_sent: bool
    notification_channels: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class AlertFilter(BaseModel):
    severity: Optional[AlertSeverity] = None
    status: Optional[AlertStatus] = None
    assigned_to: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Notification Channel Schemas
class NotificationChannelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    channel_type: str = Field(..., pattern="^(email|telegram|sms|webhook|zalo)$")
    config: str
    is_active: bool = True


class NotificationChannelCreate(NotificationChannelBase):
    pass


class NotificationChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[str] = None
    is_active: Optional[bool] = None


class NotificationChannelResponse(NotificationChannelBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True


# Notification Delivery Log Schemas
class NotificationDeliveryLogResponse(BaseModel):
    id: int
    project_id: Optional[int]
    alert_id: Optional[int]
    incident_id: Optional[int]
    mention_id: Optional[int]
    
    event_type: str
    channel: str
    destination: str
    status: str
    
    attempt_count: int
    last_error: Optional[str]
    response_status_code: Optional[int]
    payload: Optional[str]
    
    created_at: datetime
    sent_at: Optional[datetime]
    next_retry_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class NotificationDeliveryLogListResponse(BaseModel):
    items: List[NotificationDeliveryLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


