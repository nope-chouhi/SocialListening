from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List


# Organization Settings Schemas
class OrganizationSettingsBase(BaseModel):
    organization_name: str = Field(..., min_length=1, max_length=255)
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    hotline: Optional[str] = None
    website: Optional[str] = None
    timezone: str = 'Asia/Ho_Chi_Minh'
    language: str = Field('vi', pattern='^(vi|en)$')


class OrganizationSettingsUpdate(BaseModel):
    organization_name: Optional[str] = Field(None, min_length=1, max_length=255)
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    hotline: Optional[str] = None
    website: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = Field(None, pattern='^(vi|en)$')


class OrganizationSettingsResponse(OrganizationSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# Email Settings Schemas
class EmailSettingsBase(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    use_tls: bool = True
    use_ssl: bool = False


class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = Field(None, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None  # Only for updates
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    use_tls: Optional[bool] = None
    use_ssl: Optional[bool] = None


class EmailSettingsResponse(EmailSettingsBase):
    id: int
    is_configured: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Never return smtp_password
    
    class Config:
        orm_mode = True


# System Notification Settings Schemas
class SystemNotificationSettingsBase(BaseModel):
    webhook_url: Optional[str] = None
    telegram_webhook: Optional[str] = None
    slack_webhook: Optional[str] = None
    discord_webhook: Optional[str] = None
    system_alerts_enabled: bool = True
    alert_channels: Optional[List[str]] = ['email']
    daily_report_enabled: bool = False
    daily_report_time: str = '09:00'
    weekly_report_enabled: bool = False
    weekly_report_day: int = Field(0, ge=0, le=6)
    weekly_report_time: str = '09:00'
    report_email_recipients: Optional[str] = None


class SystemNotificationSettingsUpdate(BaseModel):
    webhook_url: Optional[str] = None
    telegram_webhook: Optional[str] = None
    slack_webhook: Optional[str] = None
    discord_webhook: Optional[str] = None
    system_alerts_enabled: Optional[bool] = None
    alert_channels: Optional[List[str]] = None
    daily_report_enabled: Optional[bool] = None
    daily_report_time: Optional[str] = None
    weekly_report_enabled: Optional[bool] = None
    weekly_report_day: Optional[int] = Field(None, ge=0, le=6)
    weekly_report_time: Optional[str] = None
    report_email_recipients: Optional[str] = None


class SystemNotificationSettingsResponse(SystemNotificationSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True
