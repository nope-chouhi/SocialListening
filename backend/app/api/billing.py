from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.billing import Plan, UsageEvent, OrganizationPlan
from app.core.rbac import RequirePermission

router = APIRouter()

@router.get("/plans")
def get_plans(db: Session = Depends(get_db)):
    return db.query(Plan).all()

@router.get("/usage/organization/{org_id}")
def get_org_usage(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequirePermission("usage.view"))
):
    if not current_user.is_superuser and current_user.current_organization_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organization's usage")
        
    events = db.query(
        UsageEvent.event_type, 
        func.sum(UsageEvent.quantity).label("total")
    ).filter(
        UsageEvent.organization_id == org_id
    ).group_by(UsageEvent.event_type).all()
    
    return [{"event_type": e.event_type, "total": e.total} for e in events]
