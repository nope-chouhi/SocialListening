from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Any
from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.organization import Organization, OrganizationMember
from app.models.team import Team, TeamMember
from app.core.rbac import RequirePermission
from datetime import datetime

router = APIRouter()

@router.get("/")
def get_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.is_superuser:
        orgs = db.query(Organization).all()
    else:
        orgs = db.query(Organization).join(OrganizationMember).filter(
            OrganizationMember.user_id == current_user.id
        ).all()
        
    return orgs

@router.post("/")
def create_organization(
    name: str,
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to create organizations")
        
    org = Organization(
        name=name,
        slug=slug,
        owner_user_id=current_user.id
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    
    # Make creator owner
    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner",
        status="active"
    )
    db.add(member)
    db.commit()
    
    return org

@router.get("/{org_id}")
def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequirePermission("org.view"))
):
    # RequirePermission ensures the user is in the org or superuser
    if not current_user.is_superuser and current_user.current_organization_id != org_id:
        raise HTTPException(status_code=403, detail="Cannot access other organizations")
        
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    return org

@router.get("/{org_id}/members")
def get_organization_members(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RequirePermission("org.members.view"))
):
    members = db.query(OrganizationMember, User.email, User.full_name).join(
        User, User.id == OrganizationMember.user_id
    ).filter(
        OrganizationMember.organization_id == org_id
    ).all()
    
    return [
        {
            "id": m.OrganizationMember.id,
            "user_id": m.OrganizationMember.user_id,
            "role": m.OrganizationMember.role,
            "status": m.OrganizationMember.status,
            "email": m.email,
            "full_name": m.full_name
        }
        for m in members
    ]

@router.post("/{org_id}/members/invite")
def invite_member(
    org_id: int,
    email: str,
    role: str = "viewer",
    db: Session = Depends(get_db),
    current_user: User = Depends(RequirePermission("org.members.invite"))
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # In a real app, send email and create invite token. 
        # For MVP, we create a placeholder user or reject.
        raise HTTPException(status_code=400, detail="User with this email does not exist yet. Need to implement full invite flow.")
        
    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already in this organization")
        
    member = OrganizationMember(
        organization_id=org_id,
        user_id=user.id,
        role=role,
        status="active",
        joined_at=datetime.utcnow()
    )
    db.add(member)
    db.commit()
    return {"message": "User added successfully"}
