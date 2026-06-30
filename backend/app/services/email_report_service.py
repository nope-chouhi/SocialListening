import logging
import traceback
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_

from app.models.system_settings import SystemNotificationSettings
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert
from app.models.incident import Incident
from app.core.tenant import apply_tenant_filter
from app.services.notification_service import send_email_notification
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_system_user(db: Session) -> User:
    """Get a system user context for executing tenant-filtered queries"""
    user = db.execute(select(User).where(User.is_superuser == True)).scalars().first()
    if not user:
        user = db.execute(select(User).where(User.is_active == True)).scalars().first()
    return user

def _generate_report_html(report_type: str, data: dict) -> str:
    """Generate simple HTML report"""
    
    date_from = data.get("date_from", "")
    date_to = data.get("date_to", "")
    metrics = data.get("metrics", {})
    sentiment = metrics.get("sentiment", {})
    total = metrics.get("total_mentions", 0)
    alerts = metrics.get("total_alerts", 0)
    incidents = metrics.get("total_incidents", 0)
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Social Listening {report_type.capitalize()} Report
        </h2>
        <p style="color: #64748b; font-size: 14px;">Period: {date_from} to {date_to}</p>
        
        <div style="margin-top: 20px;">
            <h3 style="color: #334155;">Key Metrics</h3>
            <ul style="list-style-type: none; padding: 0;">
                <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <strong>Total Mentions:</strong> {total}
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <strong>Alerts:</strong> {alerts}
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <strong>Incidents:</strong> {incidents}
                </li>
            </ul>
        </div>
        
        <div style="margin-top: 20px;">
            <h3 style="color: #334155;">Sentiment Breakdown</h3>
            <div style="display: flex; gap: 10px; text-align: center;">
                <div style="flex: 1; padding: 15px; background: #dcfce7; border-radius: 8px;">
                    <div style="color: #166534; font-weight: bold; font-size: 20px;">{sentiment.get('positive', 0)}</div>
                    <div style="color: #15803d; font-size: 12px;">Positive</div>
                </div>
                <div style="flex: 1; padding: 15px; background: #fee2e2; border-radius: 8px;">
                    <div style="color: #991b1b; font-weight: bold; font-size: 20px;">{sentiment.get('negative', 0)}</div>
                    <div style="color: #b91c1c; font-size: 12px;">Negative</div>
                </div>
                <div style="flex: 1; padding: 15px; background: #f1f5f9; border-radius: 8px;">
                    <div style="color: #334155; font-weight: bold; font-size: 20px;">{sentiment.get('neutral', 0)}</div>
                    <div style="color: #475569; font-size: 12px;">Neutral</div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            <p>This is an automatically generated report from Nope Social Listening Platform.</p>
        </div>
    </div>
    """
    return html

def send_scheduled_report_email(db: Session, report_type: str = "daily") -> dict:
    """
    Build a real HTML summary from live DB data and send via notification_service.
    Returns {"success": bool, "message": str}.
    """
    try:
        sys_settings = db.execute(select(SystemNotificationSettings)).scalars().first()
        if not sys_settings or not sys_settings.report_email_recipients:
            return {"success": False, "message": "No report email recipients configured."}
            
        recipients = [e.strip() for e in sys_settings.report_email_recipients.split(',') if e.strip()]
        if not recipients:
            return {"success": False, "message": "No valid report email recipients configured."}
            
        import os
        smtp_configured = settings.SMTP_ENABLED or bool(os.getenv("RESEND_API_KEY"))
        if not smtp_configured:
            return {"success": False, "message": "Email provider (SMTP or Resend) is not configured."}
            
        now = datetime.now(timezone.utc)
        if report_type == "daily":
            date_from = now - timedelta(days=1)
        elif report_type == "weekly":
            date_from = now - timedelta(days=7)
        else:
            date_from = now - timedelta(days=30)
            
        date_to = now
        
        user = get_system_user(db)
        if not user:
            return {"success": False, "message": "No active user found to scope report data."}
            
        # Get data
        mentions_query = apply_tenant_filter(select(Mention), Mention, user).where(Mention.published_at >= date_from).where(Mention.published_at <= date_to)
        mentions = db.execute(mentions_query).scalars().all()
        mention_ids = [m.id for m in mentions]
        
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
        
        # Build analysis lookup by mention_id (keeping the first/latest found per mention)
        analysis_by_mention = {}
        if mention_ids:
            analyses = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))).scalars().all()
            for a in analyses:
                analysis_by_mention[a.mention_id] = a
                
        # Count sentiment per mention
        for m in mentions:
            a = analysis_by_mention.get(m.id)
            if a:
                sent_val = a.sentiment.value if hasattr(a.sentiment, 'value') else a.sentiment
                if not isinstance(sent_val, str):
                    sent_val = str(sent_val).lower() if sent_val else "neutral"
                else:
                    sent_val = sent_val.lower()
                    
                if sent_val.startswith('negative'):
                    sent_val = 'negative'
                    
                if sent_val in sentiment_counts:
                    sentiment_counts[sent_val] += 1
                else:
                    sentiment_counts["neutral"] += 1
            else:
                sentiment_counts["neutral"] += 1
            
        alerts_query = apply_tenant_filter(select(Alert), Alert, user).where(Alert.created_at >= date_from).where(Alert.created_at <= date_to)
        total_alerts = db.execute(select(func.count()).select_from(alerts_query.subquery())).scalar() or 0
        
        incidents_query = select(Incident).where(Incident.created_at >= date_from).where(Incident.created_at <= date_to)
        total_incidents = db.execute(select(func.count()).select_from(incidents_query.subquery())).scalar() or 0
        
        data = {
            "date_from": date_from.strftime("%Y-%m-%d %H:%M"),
            "date_to": date_to.strftime("%Y-%m-%d %H:%M"),
            "metrics": {
                "total_mentions": len(mentions),
                "sentiment": sentiment_counts,
                "total_alerts": total_alerts,
                "total_incidents": total_incidents
            }
        }
        
        html_body = _generate_report_html(report_type, data)
        subject = f"[{settings.APP_NAME}] {report_type.capitalize()} Report: {date_from.strftime('%Y-%m-%d')} to {date_to.strftime('%Y-%m-%d')}"
        
        success_count = 0
        for email in recipients:
            res = send_email_notification(
                db=db,
                to_email=email,
                subject=subject,
                body_html=html_body,
                event_type=f"scheduled_report_{report_type}"
            )
            if res.get("success"):
                success_count += 1
                
        total_recipients = len(recipients)
        if success_count == total_recipients:
            return {"success": True, "message": f"Successfully sent {report_type} report to all {total_recipients} recipients."}
        elif success_count > 0:
            return {"success": True, "message": f"Partially succeeded: sent {report_type} report to {success_count} out of {total_recipients} recipients."}
        else:
            return {"success": False, "message": "Failed to send report to any recipient."}
            
    except Exception as e:
        logger.error(f"Error sending scheduled report email: {e}\\n{traceback.format_exc()}")
        return {"success": False, "message": f"Internal error: {str(e)}"}
