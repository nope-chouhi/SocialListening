from sqlalchemy.orm import Session
from app.models.billing import UsageEvent
from datetime import datetime

def track_usage(
    db: Session,
    org_id: int,
    user_id: int = None,
    project_id: int = None,
    event_type: str = "general",
    event_name: str = "action",
    quantity: int = 1,
    metadata: dict = None
):
    """
    Track a usage event for an organization.
    Useful for billing and limits.
    """
    event = UsageEvent(
        organization_id=org_id,
        user_id=user_id,
        project_id=project_id,
        event_type=event_type,
        event_name=event_name,
        quantity=quantity,
        metadata_json=metadata or {}
    )
    db.add(event)
    # Note: caller is responsible for db.commit() to keep it in the same transaction
