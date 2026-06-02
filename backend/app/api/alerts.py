from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from math import ceil
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.models.incident import Incident, IncidentStatus, IncidentLog
from app.models.mention import Mention, AIAnalysis
from app.services.notification_service import notify_alert_created

router = APIRouter()


class AlertCreateBody(BaseModel):
    mention_id: Optional[int] = None
    title: str
    severity: str
    message: Optional[str] = None


class AlertRuleCreateBody(BaseModel):
    project_id: Optional[int] = None
    name: str
    rule_type: str  # "mention_spike", "negative_spike", "high_risk"
    threshold: float  # e.g., 10 for spike, 0.3 for negative ratio, 70 for risk score
    window_hours: int = 24  # Time window to check
    is_active: bool = True


@router.get("")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List alerts with filtering and pagination"""
    query = select(Alert)

    if severity:
        query = query.where(Alert.severity == severity)

    if status:
        query = query.where(Alert.status == status)

    if project_id:
        query = query.where(Alert.project_id == project_id)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Alert.created_at.desc())

    alerts = db.execute(query).scalars().all()

    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": [
            {
                "id": a.id,
                "project_id": a.project_id,
                "mention_id": a.mention_id,
                "severity": a.severity.value if hasattr(a.severity, 'value') else a.severity,
                "status": a.status.value if hasattr(a.status, 'value') else a.status,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None
            }
            for a in alerts
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("", status_code=201)
def create_alert(
    body: AlertCreateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new alert (accepts JSON body)"""
    # Validate severity
    allowed_severities = [s.value for s in AlertSeverity]
    if body.severity not in allowed_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Má»©c Ä‘á»™ khÃ´ng há»£p lá»‡. Cho phÃ©p: {allowed_severities}"
        )

    alert = Alert(
        mention_id=body.mention_id,
        title=body.title,
        severity=body.severity,
        message=body.message,
        status=AlertStatus.NEW
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    # Send notification
    try:
        notify_alert_created(db, alert.id)
    except Exception as e:
        print(f"Failed to send alert notification: {e}")

    return {
        "id": alert.id,
        "mention_id": alert.mention_id,
        "severity": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "title": alert.title,
        "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None
    }


@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an alert by ID"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {
        "id": alert.id,
        "mention_id": alert.mention_id,
        "severity": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "title": alert.title,
        "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
    }


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Acknowledge an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Cáº£nh bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c giáº£i quyáº¿t")

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "acknowledged_at": alert.acknowledged_at.isoformat()
    }


@router.post("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Resolve an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = AlertStatus.RESOLVED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "resolved_at": alert.resolved_at.isoformat()
    }


@router.post("/{alert_id}/ignore")
def ignore_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Ignore an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = AlertStatus.IGNORED
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "resolved_at": alert.resolved_at.isoformat()
    }


@router.post("/{alert_id}/create-incident", status_code=201)
def create_incident_from_alert(
    alert_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create an incident from an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    incident_title = title or f"Sự cố từ cảnh báo: {alert.title}"
    incident = Incident(
        mention_id=alert.mention_id,
        owner_id=current_user.id,
        title=incident_title,
        description=description or f"Sự cố được tạo từ cảnh báo #{alert.id}: {alert.title}",
        status=IncidentStatus.NEW
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="created",
        new_status=incident.status.value,
        notes=f"Sự cố được tạo từ cảnh báo #{alert_id}"
    )
    db.add(log)
    db.commit()

    # Automatically resolve/assign the alert since an incident was created? 
    # Or just leave it as is. We'll set it to ASSIGNED.
    alert.status = AlertStatus.ASSIGNED
    db.commit()

    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "title": incident.title,
        "status": incident.status.value,
        "created_at": incident.created_at.isoformat() if incident.created_at else None
    }


@router.delete("/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an alert"""
    alert = db.execute(
        select(Alert).where(Alert.id == alert_id)
    ).scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()


@router.post("/check-rules", status_code=200)
def check_alert_rules(
    body: AlertRuleCreateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check alert rules and create alerts if thresholds are met"""
    if not body.is_active:
        return {"message": "Rule is inactive", "alerts_created": 0}
    
    # Calculate time window
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=body.window_hours)
    
    alerts_created = 0
    
    # Build base filter for mentions
    mention_filter = [
        Mention.collected_at >= start_time,
        Mention.collected_at <= end_time,
        Mention.is_muted == False,
        Mention.is_deleted == False
    ]
    
    if body.project_id:
        mention_filter.append(Mention.project_id == body.project_id)
    
    if body.rule_type == "mention_spike":
        # Check if mention count exceeds threshold
        total_mentions = db.execute(
            select(func.count(Mention.id)).where(and_(*mention_filter))
        ).scalar() or 0
        
        # Compare with previous period (same window, shifted back)
        prev_start = start_time - timedelta(hours=body.window_hours)
        prev_end = start_time
        prev_mentions = db.execute(
            select(func.count(Mention.id)).where(
                and_(
                    Mention.collected_at >= prev_start,
                    Mention.collected_at <= prev_end,
                    Mention.is_muted == False,
                    Mention.is_deleted == False,
                    *(mention_filter[1:] if body.project_id else [])
                )
            )
        ).scalar() or 0
        
        # Calculate spike (current vs previous)
        if prev_mentions > 0:
            spike_ratio = (total_mentions - prev_mentions) / prev_mentions
        else:
            spike_ratio = 1.0 if total_mentions > 0 else 0
        
        # If spike exceeds threshold, create alert
        if spike_ratio >= body.threshold:
            alert = Alert(
                project_id=body.project_id,
                title=f"Mention Spike Detected: {body.name}",
                message=f"Mentions increased by {spike_ratio:.1%} in the last {body.window_hours}h (current: {total_mentions}, previous: {prev_mentions})",
                severity=AlertSeverity.HIGH if spike_ratio >= 0.5 else AlertSeverity.MEDIUM,
                status=AlertStatus.NEW
            )
            db.add(alert)
            db.commit()
            alerts_created += 1
    
    elif body.rule_type == "negative_spike":
        # Check if negative mentions exceed threshold
        mention_ids = db.execute(
            select(Mention.id).where(and_(*mention_filter))
        ).scalars().all()
        
        if mention_ids:
            # Get AI analysis for sentiment
            negative_count = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.mention_id.in_(mention_ids),
                        AIAnalysis.sentiment.in_(["negative_low", "negative_medium", "negative_high"])
                    )
                )
            ).scalar() or 0
            
            total_count = len(mention_ids)
            negative_ratio = negative_count / total_count if total_count > 0 else 0
            
            # If negative ratio exceeds threshold, create alert
            if negative_ratio >= body.threshold:
                alert = Alert(
                    project_id=body.project_id,
                    title=f"Negative Sentiment Spike: {body.name}",
                    message=f"Negative sentiment ratio is {negative_ratio:.1%} in the last {body.window_hours}h ({negative_count}/{total_count} mentions)",
                    severity=AlertSeverity.CRITICAL if negative_ratio >= 0.5 else AlertSeverity.HIGH,
                    status=AlertStatus.NEW
                )
                db.add(alert)
                db.commit()
                alerts_created += 1
    
    elif body.rule_type == "high_risk":
        # Check if any mentions have risk score above threshold
        mention_ids = db.execute(
            select(Mention.id).where(and_(*mention_filter))
        ).scalars().all()
        
        if mention_ids:
            high_risk_mentions = db.execute(
                select(AIAnalysis).where(
                    and_(
                        AIAnalysis.mention_id.in_(mention_ids),
                        AIAnalysis.risk_score >= body.threshold
                    )
                )
            ).scalars().all()
            
            if high_risk_mentions:
                alert = Alert(
                    project_id=body.project_id,
                    title=f"High Risk Mentions: {body.name}",
                    message=f"Found {len(high_risk_mentions)} mentions with risk score >= {body.threshold} in the last {body.window_hours}h",
                    severity=AlertSeverity.CRITICAL if body.threshold >= 85 else AlertSeverity.HIGH,
                    status=AlertStatus.NEW
                )
                db.add(alert)
                db.commit()
                alerts_created += 1
    
    return {
        "message": f"Alert rule check complete",
        "alerts_created": alerts_created,
        "rule_type": body.rule_type,
        "threshold": body.threshold,
        "window_hours": body.window_hours
    }

