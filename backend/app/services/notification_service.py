"""
Notification Service for Social Listening Platform
Handles email (SMTP) and webhook notifications
"""
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.system_settings import EmailSettings, SystemNotificationSettings


import os

def send_email_notification(
    db: Session,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
) -> Dict:
    """
    Send email notification using SMTP
    """
    env_smtp_host = os.getenv("SMTP_HOST", "").strip()
    env_smtp_port = os.getenv("SMTP_PORT", "").strip()
    env_smtp_user = os.getenv("SMTP_USER", "").strip()
    env_smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    env_smtp_from_email = os.getenv("SMTP_FROM_EMAIL", "").strip() or env_smtp_user
    env_smtp_from_name = os.getenv("SMTP_FROM_NAME", "").strip()
    
    # Get email settings
    settings = db.execute(
        select(EmailSettings).limit(1)
    ).scalar_one_or_none()
    
    use_env = bool(env_smtp_host and env_smtp_port and env_smtp_user and env_smtp_password)
    db_configured = bool(settings and settings.is_configured and all([settings.smtp_host, settings.smtp_port, settings.smtp_username, settings.smtp_password]))

    if not use_env and not db_configured:
        return {
            "success": False,
            "message": "Email notifications not configured or missing credentials"
        }
        
    smtp_host = env_smtp_host if use_env else settings.smtp_host
    smtp_port = int(env_smtp_port) if use_env else settings.smtp_port
    smtp_user = env_smtp_user if use_env else settings.smtp_username
    smtp_password = env_smtp_password if use_env else settings.smtp_password
    smtp_from = env_smtp_from_email if use_env else (settings.from_email or settings.smtp_username)
    
    if use_env:
        # Auto-detect SSL vs TLS based on port
        smtp_use_tls = (smtp_port != 465)
    elif settings:
        smtp_use_tls = settings.use_tls
    else:
        smtp_use_tls = True
        
    if env_smtp_from_name and use_env:
        smtp_from_str = f"{env_smtp_from_name} <{smtp_from}>"
    else:
        smtp_from_str = smtp_from
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_from_str
        msg['To'] = to_email
        
        # Add plain text part
        if body_text:
            part1 = MIMEText(body_text, 'plain', 'utf-8')
            msg.attach(part1)
        
        # Add HTML part
        part2 = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(part2)
        
        # Connect to SMTP server (force IPv4 via getaddrinfo patch to avoid Errno 101/Errno -9 on Render)
        import socket
        orig_getaddrinfo = socket.getaddrinfo
        def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
            return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        
        socket.getaddrinfo = getaddrinfo_ipv4
        try:
            if smtp_use_tls:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            
            # Login
            server.login(smtp_user, smtp_password)
            
            # Send email
            server.send_message(msg)
            server.quit()
        finally:
            socket.getaddrinfo = orig_getaddrinfo
        
        print(f"[Email] ✅ Sent to {to_email}: {subject}")
        
        return {
            "success": True,
            "message": f"Email sent to {to_email}",
            "sent_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"[Email] ❌ Failed to send to {to_email}: {e}")
        return {
            "success": False,
            "message": f"Failed to send email: {str(e)}"
        }


def send_webhook_notification(
    db: Session,
    event_type: str,
    data: Dict
) -> Dict:
    """
    Send webhook notification via HTTP POST
    
    Args:
        db: Database session
        event_type: Type of event (mention_high_risk, alert_created, etc.)
        data: Event data to send
        
    Returns:
        dict with success status and message
    """
    # Get notification settings
    settings = db.execute(
        select(SystemNotificationSettings).limit(1)
    ).scalar_one_or_none()
    
    if not settings or not settings.webhook_enabled:
        return {
            "success": False,
            "message": "Webhook notifications not configured or disabled"
        }
    
    if not settings.webhook_url:
        return {
            "success": False,
            "message": "Webhook URL not configured"
        }
    
    try:
        # Prepare payload
        payload = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "SocialListening/1.0"
        }
        
        # Add custom headers if configured
        if settings.webhook_headers:
            headers.update(settings.webhook_headers)
        
        # Send POST request
        response = requests.post(
            settings.webhook_url,
            json=payload,
            headers=headers,
            timeout=10
        )
        
        response.raise_for_status()
        
        print(f"[Webhook] ✅ Sent {event_type} to {settings.webhook_url}")
        
        return {
            "success": True,
            "message": f"Webhook sent successfully",
            "status_code": response.status_code,
            "sent_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        print(f"[Webhook] ❌ Failed to send {event_type}: {e}")
        return {
            "success": False,
            "message": f"Failed to send webhook: {str(e)}"
        }


def notify_high_risk_mention(db: Session, mention_id: int, analysis: Dict):
    """
    Send notifications for high-risk mention detection
    
    Args:
        db: Database session
        mention_id: Mention ID
        analysis: AI analysis results
    """
    from app.models.mention import Mention
    
    # Get mention
    mention = db.execute(
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()
    
    if not mention:
        return
    
    # Email notification
    subject = f"⚠️ High Risk Mention Detected (Risk: {analysis['risk_score']})"
    
    body_html = f"""
    <html>
    <body>
        <h2>High Risk Mention Detected</h2>
        <p><strong>Risk Score:</strong> {analysis['risk_score']}/100</p>
        <p><strong>Crisis Level:</strong> {analysis['crisis_level']}/5</p>
        <p><strong>Sentiment:</strong> {analysis['sentiment']}</p>
        <p><strong>Summary:</strong> {analysis['summary_vi']}</p>
        <p><strong>Suggested Action:</strong> {analysis['suggested_action']}</p>
        <p><strong>Department:</strong> {analysis['responsible_department']}</p>
        <hr>
        <p><strong>Title:</strong> {mention.title or 'No title'}</p>
        <p><strong>URL:</strong> <a href="{mention.url}">{mention.url}</a></p>
        <p><strong>Content Preview:</strong></p>
        <p>{mention.content[:500]}...</p>
        <hr>
        <p><small>Detected at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</small></p>
    </body>
    </html>
    """
    
    body_text = f"""
    High Risk Mention Detected
    
    Risk Score: {analysis['risk_score']}/100
    Crisis Level: {analysis['crisis_level']}/5
    Sentiment: {analysis['sentiment']}
    Summary: {analysis['summary_vi']}
    Suggested Action: {analysis['suggested_action']}
    Department: {analysis['responsible_department']}
    
    Title: {mention.title or 'No title'}
    URL: {mention.url}
    Content: {mention.content[:500]}...
    
    Detected at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
    """
    
    # Get email settings to find recipient
    email_settings = db.execute(
        select(EmailSettings).limit(1)
    ).scalar_one_or_none()
    
    if email_settings and email_settings.is_configured:
        # Send to configured recipient or default
        recipient = email_settings.from_email or "admin@sociallistening.com"
        send_email_notification(db, recipient, subject, body_html, body_text)
    
    # Webhook notification
    webhook_data = {
        "mention_id": mention_id,
        "risk_score": analysis['risk_score'],
        "crisis_level": analysis['crisis_level'],
        "sentiment": analysis['sentiment'],
        "summary": analysis['summary_vi'],
        "suggested_action": analysis['suggested_action'],
        "responsible_department": analysis['responsible_department'],
        "mention_url": mention.url,
        "mention_title": mention.title
    }
    
    send_webhook_notification(db, "mention_high_risk", webhook_data)


def notify_alert_created(db: Session, alert_id: int):
    """
    Send notifications when an alert is created
    
    Args:
        db: Database session
        alert_id: Alert ID
    """
    from app.models.alert import Alert
    
    # Get alert
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()
    
    if not alert:
        return
    
    # Email notification
    subject = f"🚨 New Alert: {alert.title}"
    
    body_html = f"""
    <html>
    <body>
        <h2>New Alert Created</h2>
        <p><strong>Title:</strong> {alert.title}</p>
        <p><strong>Severity:</strong> {alert.severity.value if hasattr(alert.severity, 'value') else alert.severity}</p>
        <p><strong>Status:</strong> {alert.status.value if hasattr(alert.status, 'value') else alert.status}</p>
        <p><strong>Message:</strong> {alert.message or 'No message'}</p>
        <hr>
        <p><small>Created at: {alert.created_at.strftime('%Y-%m-%d %H:%M:%S') if alert.created_at else 'Unknown'}</small></p>
    </body>
    </html>
    """
    
    # Get email settings
    email_settings = db.execute(
        select(EmailSettings).limit(1)
    ).scalar_one_or_none()
    
    if email_settings and email_settings.is_configured:
        recipient = email_settings.from_email or "admin@sociallistening.com"
        send_email_notification(db, recipient, subject, body_html)
    
    # Webhook notification
    webhook_data = {
        "alert_id": alert_id,
        "title": alert.title,
        "severity": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "message": alert.message,
        "mention_id": alert.mention_id
    }
    
    send_webhook_notification(db, "alert_created", webhook_data)


def notify_incident_assigned(db: Session, incident_id: int, assigned_to_id: int):
    """
    Send notifications when an incident is assigned
    
    Args:
        db: Database session
        incident_id: Incident ID
        assigned_to_id: User ID of assignee
    """
    from app.models.incident import Incident
    from app.models.user import User
    
    # Get incident and user
    incident = db.execute(
        select(Incident).where(Incident.id == incident_id)
    ).scalar_one_or_none()
    
    user = db.execute(
        select(User).where(User.id == assigned_to_id)
    ).scalar_one_or_none()
    
    if not incident or not user:
        return
    
    # Email notification
    subject = f"📋 Incident Assigned: {incident.title}"
    
    body_html = f"""
    <html>
    <body>
        <h2>Incident Assigned to You</h2>
        <p><strong>Title:</strong> {incident.title}</p>
        <p><strong>Status:</strong> {incident.status.value if hasattr(incident.status, 'value') else incident.status}</p>
        <p><strong>Description:</strong> {incident.description or 'No description'}</p>
        <hr>
        <p><small>Assigned at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</small></p>
    </body>
    </html>
    """
    
    if user.email:
        send_email_notification(db, user.email, subject, body_html)
    
    # Webhook notification
    webhook_data = {
        "incident_id": incident_id,
        "title": incident.title,
        "status": incident.status.value if hasattr(incident.status, 'value') else incident.status,
        "assigned_to": user.email,
        "assigned_to_id": assigned_to_id
    }
    
    send_webhook_notification(db, "incident_assigned", webhook_data)
