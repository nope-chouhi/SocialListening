from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.system_settings import WorkerStatus
from app.models.source import Source

router = APIRouter()

@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db)
):
    """Get the real-time status of the background worker."""
    status_record = db.query(WorkerStatus).first()
    
    # Check if worker is running (heartbeat within last 2 minutes)
    worker_running = False
    last_heartbeat = None
    if status_record and status_record.last_heartbeat:
        last_heartbeat = status_record.last_heartbeat
        now = datetime.now(timezone.utc)
        
        # Ensure last_heartbeat is timezone aware for comparison
        if last_heartbeat.tzinfo is None:
            last_heartbeat = last_heartbeat.replace(tzinfo=timezone.utc)
            
        diff = (now - last_heartbeat).total_seconds()
        if diff < 120:  # 2 minutes
            worker_running = True
            
    # Get active sources count
    active_sources = db.query(Source).filter(Source.is_active == True).count()
    
    # Get due sources (rough estimate: active and next_crawl_at < now)
    try:
        from sqlalchemy.sql import func
        due_sources = db.query(Source).filter(
            Source.is_active == True,
            Source.next_crawl_at <= func.now()
        ).count()
    except:
        due_sources = 0

    # Sanitize last_error for public exposure
    safe_last_error = None
    if status_record and status_record.last_error:
        safe_last_error = "Worker encountered an error."

    return {
        "scheduler_enabled": True,
        "worker_running": worker_running,
        "last_worker_heartbeat": last_heartbeat.isoformat() if last_heartbeat else None,
        "active_sources": active_sources,
        "due_sources": due_sources,
        "running_jobs": status_record.running_jobs if status_record else 0,
        "last_error": safe_last_error
    }
