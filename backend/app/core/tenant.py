from sqlalchemy.sql import Select
from app.core.security import can_access_admin
from app.models.user import User

def apply_tenant_filter(query: Select, model, current_user: User, user_col: str = "user_id") -> Select:
    """
    Applies a tenant filter to a SQLAlchemy query.
    If the current_user is an admin, returns the original query (sees all data).
    If the current_user is a regular user, filters by the specified user_id column.
    """
    if can_access_admin(current_user):
        return query
    
    # Special case: For entities that belong to a Project (KeywordGroup),
    # determine ownership based on the project's user_id, not the entity's user_id.
    if model.__name__ in ['Mention', 'Alert', 'Incident']:
        from app.models.keyword import KeywordGroup
        from sqlalchemy import select
        allowed_projects = select(KeywordGroup.id).where(KeywordGroup.user_id == current_user.id)
        return query.where(model.project_id.in_(allowed_projects))
    
    user_id_field = getattr(model, user_col, None)
    if user_id_field is not None:
        return query.where(user_id_field == current_user.id)
    
    return query
