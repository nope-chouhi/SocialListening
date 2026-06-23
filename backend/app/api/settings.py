from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_superuser
from app.models.user import User
from app.models.system_settings import OrganizationSettings, EmailSettings, SystemNotificationSettings
from app.models.alert import NotificationDeliveryLog
from app.schemas.system_settings import (
    OrganizationSettingsResponse, OrganizationSettingsUpdate,
    EmailSettingsResponse, EmailSettingsUpdate,
    SystemNotificationSettingsResponse, SystemNotificationSettingsUpdate
)
from app.schemas.alert import NotificationDeliveryLogResponse, NotificationDeliveryLogListResponse

router = APIRouter()


# ─── Organization Settings ────────────────────────────────────────────────────

@router.get("/organization", response_model=OrganizationSettingsResponse)
def get_organization_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get organization settings - Admin only"""
    settings = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = OrganizationSettings(
            id=1,
            organization_name='Social Listening Platform',
            timezone='Asia/Ho_Chi_Minh',
            language='vi'
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return OrganizationSettingsResponse.from_orm(settings)


@router.put("/organization", response_model=OrganizationSettingsResponse)
def update_organization_settings(
    settings_data: OrganizationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update organization settings - Admin only"""
    settings = db.execute(
        select(OrganizationSettings).where(OrganizationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = OrganizationSettings(id=1)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return OrganizationSettingsResponse.from_orm(settings)


# ─── Email Settings ───────────────────────────────────────────────────────────

@router.get("/email", response_model=EmailSettingsResponse)
def get_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get email/SMTP settings - Admin only"""
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = EmailSettings(
            id=1,
            smtp_port=587,
            use_tls=True,
            use_ssl=False,
            is_configured=False
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return EmailSettingsResponse.from_orm(settings)


@router.put("/email", response_model=EmailSettingsResponse)
def update_email_settings(
    settings_data: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update email/SMTP settings - Admin only"""
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = EmailSettings(id=1)
        db.add(settings)
    
    # Update fields
    update_dict = settings_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(settings, field, value)
    
    # Mark as configured if all required fields are present
    if settings.smtp_host and settings.smtp_username and settings.from_email:
        settings.is_configured = True
    
    db.commit()
    db.refresh(settings)
    
    return EmailSettingsResponse.from_orm(settings)


@router.post("/email/test")
def test_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Test email configuration by sending a test email - Admin only"""
    from app.services.notification_service import send_email_notification
    
    settings = db.execute(
        select(EmailSettings).where(EmailSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings or not settings.is_configured:
        raise HTTPException(
            status_code=400,
            detail="Email settings not configured or disabled"
        )
    
    # Send test email
    test_subject = "🧪 Test Email from Social Listening Platform"
    test_body_html = """
    <html>
    <body>
        <h2>Test Email</h2>
        <p>This is a test email from Social Listening Platform.</p>
        <p>If you received this email, your SMTP configuration is working correctly!</p>
        <hr>
        <p><small>Sent at: {}</small></p>
    </body>
    </html>
    """.format(__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'))
    
    test_body_text = """
    Test Email
    
    This is a test email from Social Listening Platform.
    If you received this email, your SMTP configuration is working correctly!
    
    Sent at: {}
    """.format(__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'))
    
    # Send to configured from_email
    recipient = settings.from_email or settings.smtp_username
    result = send_email_notification(db, recipient, test_subject, test_body_html, test_body_text)
    
    if result['success']:
        return {
            "success": True,
            "message": f"Test email sent successfully to {recipient}",
            "sent_at": result.get('sent_at')
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=result['message']
        )


# ─── System Notification Settings ─────────────────────────────────────────────

@router.get("/notifications", response_model=SystemNotificationSettingsResponse)
def get_system_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get system notification settings - Admin only"""
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create default if not exists
        settings = SystemNotificationSettings(
            id=1,
            system_alerts_enabled=True,
            alert_channels=['email'],
            daily_report_enabled=False,
            daily_report_time='09:00',
            weekly_report_enabled=False,
            weekly_report_day=0,
            weekly_report_time='09:00'
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return SystemNotificationSettingsResponse.from_orm(settings)


@router.put("/notifications", response_model=SystemNotificationSettingsResponse)
def update_system_notification_settings(
    settings_data: SystemNotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update system notification settings - Admin only"""
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        # Create if not exists
        settings = SystemNotificationSettings(id=1)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return SystemNotificationSettingsResponse.from_orm(settings)


@router.post("/notifications/test")
def test_notification_settings(
    channel: str,  # 'webhook'
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Test notification channel by sending a test message - Admin only"""
    from app.services.notification_service import send_webhook_notification
    
    settings = db.execute(
        select(SystemNotificationSettings).where(SystemNotificationSettings.id == 1)
    ).scalar_one_or_none()
    
    if not settings:
        raise HTTPException(status_code=404, detail="Notification settings not found")
    
    if channel == 'webhook':
        if not settings.webhook_enabled or not settings.webhook_url:
            raise HTTPException(
                status_code=400,
                detail="Webhook not configured or disabled"
            )
        
        # Send test webhook
        test_data = {
            "message": "This is a test webhook from Social Listening Platform",
            "test": True,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }
        
        result = send_webhook_notification(db, "test_webhook", test_data)
        
        if result['success']:
            return {
                "success": True,
                "message": f"Test webhook sent successfully",
                "webhook_url": settings.webhook_url,
                "status_code": result.get('status_code'),
                "sent_at": result.get('sent_at')
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result['message']
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Channel '{channel}' not supported. Use 'webhook'"
        )

# ─── Delivery Logs ──────────────────────────────────────────────────────────

@router.get("/notifications/deliveries", response_model=NotificationDeliveryLogListResponse)
def list_notification_deliveries(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """List notification deliveries - Admin only"""
    query = select(NotificationDeliveryLog)
    
    if status:
        query = query.where(NotificationDeliveryLog.status == status)
    if channel:
        query = query.where(NotificationDeliveryLog.channel == channel)
        
    query = query.order_by(NotificationDeliveryLog.created_at.desc())
    
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    
    items = db.execute(query.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/notifications/deliveries/{log_id}", response_model=NotificationDeliveryLogResponse)
def get_notification_delivery(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get a specific notification delivery log - Admin only"""
    log = db.execute(
        select(NotificationDeliveryLog).where(NotificationDeliveryLog.id == log_id)
    ).scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Delivery log not found")
        
    return log


@router.post("/notifications/deliveries/{log_id}/retry")
def retry_notification_delivery(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Retry a failed notification delivery - Admin only"""
    from app.services.notification_service import retry_delivery
    
    result = retry_delivery(db, log_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Retry failed"))
        
    return {"success": True, "message": "Notification queued for retry or sent successfully"}

