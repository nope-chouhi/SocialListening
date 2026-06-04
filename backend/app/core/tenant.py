from sqlalchemy.sql import Select
from app.core.security import can_access_admin
from app.models.user import User

def apply_tenant_filter(query: Select, model, current_user: User, user_col: str = "user_id") -> Select:
    """
    Applies a tenant filter to a SQLAlchemy query based on organization_id.
    If the current_user is a super admin, returns the original query (sees all data).
    If the current_user has a current_organization_id, filters by that organization.
    """
    from app.core.security import can_access_admin
    if can_access_admin(current_user):
        return query
    
    # If the user has a selected organization, filter by it
    if hasattr(current_user, 'current_organization_id') and current_user.current_organization_id:
        org_id_field = getattr(model, 'organization_id', None)
        if org_id_field is not None:
            return query.where(org_id_field == current_user.current_organization_id)
            
    # Fallback to legacy user_id filtering if no organization_id is found
    # Special case for legacy Mentions, Alerts, etc.
    if model.__name__ in ['Mention', 'Alert', 'Incident']:
        from app.models.keyword import KeywordGroup
        from sqlalchemy import select
        allowed_projects = select(KeywordGroup.id).where(KeywordGroup.user_id == current_user.id)
        return query.where(model.project_id.in_(allowed_projects))
    
    user_id_field = getattr(model, user_col, None)
    if user_id_field is not None:
        return query.where(user_id_field == current_user.id)
    
    return query
