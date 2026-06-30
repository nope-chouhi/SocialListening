from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_superuser, get_current_user
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
    # Validate emails if provided
    if settings_data.report_email_recipients:
        emails = [e.strip() for e in settings_data.report_email_recipients.split(',') if e.strip()]
        invalid = [e for e in emails if '@' not in e]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid email addresses: {', '.join(invalid)}")
            
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    try:
        from app.services.scheduler_service import sync_email_report_schedules
        sync_email_report_schedules()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error syncing email report schedules: {e}")
        
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


# ─── AI Model Configuration ──────────────────────────────────────────────────

@router.get("/ai-model")
def get_ai_model_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get AI model configuration - Admin only"""
    from app.models.ai_config import AIModelConfig

    try:
        config = db.execute(
            select(AIModelConfig).where(AIModelConfig.user_id == current_user.id)
        ).scalar_one_or_none()

        if not config:
            config = AIModelConfig(
                user_id=current_user.id,
                provider='gemini',
                model_name='gemini-2.5-flash',
                is_enabled=True
            )
            db.add(config)
            db.commit()
            db.refresh(config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database is not initialized. Please run migrations.")

    # Mask the API key
    masked_key = ""
    if config.api_key:
        key = config.api_key
        if len(key) > 8:
            masked_key = key[:4] + "..." + key[-4:]
        else:
            masked_key = "****"

    return {
        "id": config.id,
        "provider": config.provider,
        "api_key_masked": masked_key,
        "model_name": config.model_name,
        "base_url": config.base_url,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "is_enabled": config.is_enabled,
        "system_prompt": config.system_prompt or "",
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.put("/ai-model")
def update_ai_model_config(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update AI model configuration - Admin only"""
    from app.models.ai_config import AIModelConfig

    try:
        config = db.execute(
            select(AIModelConfig).where(AIModelConfig.user_id == current_user.id)
        ).scalar_one_or_none()

        if not config:
            config = AIModelConfig(user_id=current_user.id)
            db.add(config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database is not initialized. Please run migrations.")

    provider = data.get("provider")
    if provider and provider in ("gemini", "openai", "custom"):
        config.provider = provider

    api_key = data.get("api_key")
    if api_key is not None and api_key != "":
        # Do not overwrite if it is just the masked version being submitted back
        if not (api_key.startswith("****") or (len(api_key) > 8 and api_key[4:7] == "...")):
            config.api_key = api_key

    model_name = data.get("model_name")
    if model_name:
        config.model_name = model_name

    base_url = data.get("base_url")
    if base_url is not None:
        config.base_url = base_url if base_url else None

    max_tokens = data.get("max_tokens")
    if max_tokens is not None:
        config.max_tokens = max(128, min(16384, int(max_tokens)))

    temperature = data.get("temperature")
    if temperature is not None:
        config.temperature = max(0.0, min(2.0, float(temperature)))

    is_enabled = data.get("is_enabled")
    if is_enabled is not None:
        config.is_enabled = bool(is_enabled)

    system_prompt = data.get("system_prompt")
    if system_prompt is not None:
        config.system_prompt = system_prompt if system_prompt.strip() else None

    try:
        db.commit()
        db.refresh(config)
    except Exception as e:
        db.rollback()
        return {"success": False, "message": f"Failed to save config: {e}"}

    masked_key = ""
    if config.api_key:
        key = config.api_key
        if len(key) > 8:
            masked_key = key[:4] + "..." + key[-4:]
        else:
            masked_key = "****"

    return {
        "id": config.id,
        "provider": config.provider,
        "api_key_masked": masked_key,
        "model_name": config.model_name,
        "base_url": config.base_url,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "is_enabled": config.is_enabled,
        "system_prompt": config.system_prompt or "",
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.post("/ai-model/test")
def test_ai_model_connection(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Test AI provider connection - Admin only"""
    provider = data.get("provider", "")
    api_key = data.get("api_key", "")
    model_name = data.get("model_name", "")
    base_url = data.get("base_url", "")

    if not api_key:
        return {"success": False, "message": "API key is required", "response_preview": None}

    test_prompt = "Xin chào, bạn có thể trả lời được không? Trả lời ngắn gọn trong 1 câu."

    try:
        if provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name or "gemini-2.5-flash")
            response = model.generate_content(test_prompt)
            preview = response.text.strip()[:200]
            return {"success": True, "message": f"Kết nối Gemini ({model_name}) thành công!", "response_preview": preview}

        elif provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model_name or "gpt-4o-mini",
                messages=[{"role": "user", "content": test_prompt}],
                max_tokens=100,
                timeout=15
            )
            preview = response.choices[0].message.content.strip()[:200]
            return {"success": True, "message": f"Kết nối OpenAI ({model_name}) thành công!", "response_preview": preview}

        elif provider == "custom":
            if not base_url:
                return {"success": False, "message": "Base URL is required for custom provider", "response_preview": None}
            from openai import OpenAI
            client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
            
            sys_prompt = data.get("system_prompt")
            sys_prompt = sys_prompt if sys_prompt and sys_prompt.strip() else "Bạn là chuyên gia phân tích."
            
            response = client.chat.completions.create(
                model=model_name or "default",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": test_prompt}
                ],
                max_tokens=100,
                timeout=15
            )
            preview = response.choices[0].message.content.strip()[:200]
            return {"success": True, "message": f"Kết nối Custom ({model_name}) thành công!", "response_preview": preview}

        else:
            return {"success": False, "message": f"Unknown provider: {provider}", "response_preview": None}

    except Exception as e:
        return {"success": False, "message": f"Lỗi kết nối: {str(e)}", "response_preview": None}

