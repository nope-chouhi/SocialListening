from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.organization import OrganizationMember, Organization
from app.core.rbac import get_effective_permissions
from typing import Dict, Any

def setup_context_endpoint(router):
    @router.get("/me/context")
    def get_my_context(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> Dict[str, Any]:
        """Get the user's multi-tenant context (organizations, roles, permissions)"""
        
        # Get all organizations the user belongs to
        memberships = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == 'active'
        ).all()
        
        organizations = []
        for m in memberships:
            org = db.query(Organization).filter(Organization.id == m.organization_id).first()
            if org:
                organizations.append({
                    "id": org.id,
                    "name": org.name,
                    "slug": org.slug,
                    "role": m.role
                })
                
        # Get effective permissions for the current organization
        permissions = []
        if current_user.current_organization_id:
            permissions = get_effective_permissions(current_user, current_user.current_organization_id, db)
            
        return {
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "is_superuser": current_user.is_superuser,
                "current_organization_id": current_user.current_organization_id
            },
            "organizations": organizations,
            "permissions": permissions
        }
