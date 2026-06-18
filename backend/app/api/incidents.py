from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from math import ceil
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import Incident, IncidentStatus, IncidentLog
from app.services.notification_service import notify_incident_assigned
from app.core.tenant import apply_tenant_filter

router = APIRouter()


# â”€â”€â”€ Pydantic Request Bodies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class IncidentCreateBody(BaseModel):
    title: str
    description: Optional[str] = None
    mention_id: Optional[int] = None
    deadline: Optional[str] = None  # ISO format string


class IncidentUpdateBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    outcome: Optional[str] = None
    deadline: Optional[str] = None
    owner_id: Optional[int] = None


class IncidentLogBody(BaseModel):
    action: str
    notes: Optional[str] = None


# â”€â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("")
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List incidents with filtering and pagination"""
    query = apply_tenant_filter(select(Incident), Incident, current_user)

    if status:
        query = query.where(Incident.status == status)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Incident.created_at.desc())

    incidents = db.execute(query).scalars().all()

    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": [
            {
                "id": i.id,
                "mention_id": i.mention_id,
                "owner_id": i.owner_id,
                "title": i.title,
                "description": i.description,
                "status": i.status.value if hasattr(i.status, 'value') else i.status,
                "is_overdue": i.is_overdue,
                "deadline": i.deadline.isoformat() if i.deadline else None,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None
            }
            for i in incidents
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("", status_code=201)
def create_incident(
    body: IncidentCreateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new incident (accepts JSON body)"""
    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Äá»‹nh dáº¡ng deadline khÃ´ng há»£p lá»‡ (dÃ¹ng ISO format)")

    incident = Incident(
        mention_id=body.mention_id,
        owner_id=current_user.id,
        title=body.title,
        description=body.description,
        status=IncidentStatus.NEW,
        deadline=deadline,
        user_id=current_user.id
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Create log entry
    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="created",
        new_status=incident.status.value,
        notes="Sá»± cá»‘ Ä‘Æ°á»£c táº¡o"
    )
    db.add(log)
    db.commit()

    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "owner_id": incident.owner_id,
        "title": incident.title,
        "description": incident.description,
        "status": incident.status.value if hasattr(incident.status, 'value') else incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None
    }


@router.get("/{incident_id}")
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get an incident by ID"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "owner_id": incident.owner_id,
        "title": incident.title,
        "description": incident.description,
        "status": incident.status.value if hasattr(incident.status, 'value') else incident.status,
        "is_overdue": incident.is_overdue,
        "deadline": incident.deadline.isoformat() if incident.deadline else None,
        "outcome": incident.outcome,
        "resolution_notes": incident.resolution_notes,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None
    }


@router.put("/{incident_id}")
def update_incident(
    incident_id: int,
    body: IncidentUpdateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an incident (accepts JSON body)"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = incident.status
    old_owner_id = incident.owner_id

    if body.title is not None:
        incident.title = body.title
    if body.description is not None:
        incident.description = body.description
    if body.resolution_notes is not None:
        incident.resolution_notes = body.resolution_notes
    if body.outcome is not None:
        incident.outcome = body.outcome
    if body.deadline is not None:
        try:
            incident.deadline = datetime.fromisoformat(body.deadline.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Định dạng deadline không hợp lệ")

    if body.owner_id is not None:
        incident.owner_id = body.owner_id

    if body.status is not None:
        # Validate status
        allowed_statuses = [s.value for s in IncidentStatus]
        if body.status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡. Cho phÃ©p: {allowed_statuses}"
            )
        incident.status = body.status

        if body.status == 'resolved' and not incident.resolved_at:
            incident.resolved_at = datetime.utcnow()
        elif body.status == 'closed' and not incident.closed_at:
            incident.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)

    # Create log entry if status changed
    if body.status is not None and old_status != incident.status:
        log = IncidentLog(
            incident_id=incident.id,
            user_id=current_user.id,
            action="status_changed",
            old_status=old_status.value if hasattr(old_status, 'value') else str(old_status),
            new_status=incident.status.value if hasattr(incident.status, 'value') else str(incident.status),
            notes="Tráº¡ng thÃ¡i Ä‘Æ°á»£c cáº­p nháº­t"
        )
        db.add(log)
        db.commit()

    # Trigger notification if assigned
    if body.owner_id is not None and old_owner_id != body.owner_id:
        try:
            notify_incident_assigned(db, incident.id, body.owner_id)
        except Exception as e:
            print(f"Notification failed for incident {incident.id}: {e}")

    return {
        "id": incident.id,
        "status": incident.status.value if hasattr(incident.status, 'value') else incident.status,
        "title": incident.title,
        "description": incident.description,
        "resolution_notes": incident.resolution_notes,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None
    }


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an incident"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    db.delete(incident)
    db.commit()


@router.get("/{incident_id}/logs")
def get_incident_logs(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all logs for an incident"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    logs = db.execute(
        select(IncidentLog)
        .where(IncidentLog.incident_id == incident_id)
        .order_by(IncidentLog.created_at.desc())
    ).scalars().all()

    return [
        {
            "id": log.id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "notes": log.notes,
            "user_id": log.user_id,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]


@router.post("/{incident_id}/logs", status_code=201)
def add_incident_log(
    incident_id: int,
    body: IncidentLogBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a manual log entry to an incident"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    log = IncidentLog(
        incident_id=incident_id,
        user_id=current_user.id,
        action=body.action,
        notes=body.notes
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "id": log.id,
        "incident_id": log.incident_id,
        "action": log.action,
        "notes": log.notes,
        "user_id": log.user_id,
        "created_at": log.created_at.isoformat() if log.created_at else None
    }


@router.post("/{incident_id}/close")
def close_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Close an incident"""
    incident = db.execute(
        apply_tenant_filter(select(Incident), Incident, current_user).where(Incident.id == incident_id)
    ).scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = incident.status
    incident.status = IncidentStatus.CLOSED
    incident.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)

    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="closed",
        old_status=old_status.value if hasattr(old_status, 'value') else str(old_status),
        new_status=IncidentStatus.CLOSED.value,
        notes="Sá»± cá»‘ Ä‘Ã£ Ä‘Æ°á»£c Ä‘Ã³ng"
    )
    db.add(log)
    db.commit()

    return {
        "id": incident.id,
        "status": incident.status.value,
        "closed_at": incident.closed_at.isoformat()
    }

