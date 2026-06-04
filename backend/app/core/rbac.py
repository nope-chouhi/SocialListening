from fastapi import Depends, HTTPException, status
from typing import List, Optional
from app.models.user import User
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.organization import OrganizationMember, Organization
from sqlalchemy.orm import Session

def get_effective_permissions(user: User, org_id: int, db: Session) -> List[str]:
    # Placeholder for actual role permission mapping
    # Later we will join Role -> RolePermission
    if user.is_superuser:
        return ["*"]
        
    member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user.id,
        OrganizationMember.organization_id == org_id,
        OrganizationMember.status == 'active'
    ).first()
    
    if not member:
        return []
        
    # Map roles to hardcoded permissions for now since we don't have a UI for roles yet
    if member.role == "owner" or member.role == "admin":
        return ["*"]
        
    if member.role == "manager":
        return [
            "project.view", "project.create", "project.update", "project.delete",
            "keyword.view", "keyword.create", "keyword.update", "keyword.delete",
            "source.view", "source.create", "source.update", "source.delete", "source.run",
            "mention.view", "mention.update", "mention.tag", "mention.export", "mention.mute",
            "alert.view", "alert.create", "alert.update", "alert.delete",
            "report.view", "report.create", "report.export", "report.schedule",
            "scan.view", "scan.run", "scan.cancel"
        ]
        
    if member.role == "analyst":
        return [
            "project.view", "keyword.view", "source.view",
            "mention.view", "mention.tag", "mention.export", "mention.mute",
            "alert.view", "alert.create", "alert.update", "alert.delete",
            "report.view", "report.create", "report.export", "report.schedule",
            "scan.view"
        ]
        
    if member.role == "viewer":
        return [
            "project.view", "keyword.view", "source.view", "mention.view", "alert.view", "report.view"
        ]
        
    if member.role == "billing_admin":
        return [
            "billing.view", "billing.manage", "usage.view", "org.view"
        ]
        
    return []

def has_permission(permission: str, permissions: List[str]) -> bool:
    if "*" in permissions:
        return True
    return permission in permissions

class RequirePermission:
    def __init__(self, permission: str):
        self.permission = permission
        
    def __call__(self, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
        if current_user.is_superuser:
            return current_user
            
        org_id = current_user.current_organization_id
        if not org_id:
            raise HTTPException(status_code=403, detail="No active organization selected")
            
        permissions = get_effective_permissions(current_user, org_id, db)
        
        if not has_permission(self.permission, permissions):
            raise HTTPException(status_code=403, detail=f"Missing required permission: {self.permission}")
            
        return current_user
