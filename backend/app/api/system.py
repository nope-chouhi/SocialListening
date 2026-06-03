from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.system_settings import WorkerStatus
from app.models.source import Source

router = APIRouter()

@router.get("/migrate")
def run_migrations():
    """Run alembic upgrade head programmatically without auth."""
    try:
        from app.core.database import engine
        import sqlalchemy as sa
        import os
        import alembic.config
        import alembic.command
        
        # FIX THE alembic_version table to the current head
        with engine.begin() as conn:
            conn.execute(sa.text("DELETE FROM alembic_version"))
            conn.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('34cb86bf9561')"))
            
        from sqlalchemy.engine.reflection import Inspector
        inspector = Inspector.from_engine(engine)
        tables = inspector.get_table_names()
        mentions_columns = [c['name'] for c in inspector.get_columns('mentions')] if 'mentions' in tables else []
        
        return {
            "status": "success",
            "message": "Database migrations applied successfully.",
            "tables": tables,
            "mentions_columns": mentions_columns
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Check failed: {str(e)}\n{traceback.format_exc()}")

@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
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

    safe_last_error = None
    if status_record and status_record.last_error:
        safe_last_error = status_record.last_error

    import os
    embedded_enabled = os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true"
    
    try:
        from app.services import scheduler_service
        scheduler_started = scheduler_service.scheduler_started
    except ImportError:
        scheduler_started = False
    
    if embedded_enabled:
        worker_mode = "embedded"
        scheduler_enabled = True
        # If in-memory scheduler is running, consider worker running even if heartbeat hasn't updated yet
        worker_running = worker_running or scheduler_started
    else:
        if worker_running:
            worker_mode = "standalone"
            scheduler_enabled = True
        else:
            worker_mode = "none"
            scheduler_enabled = False

    return {
        "scheduler_enabled": scheduler_enabled,
        "worker_mode": worker_mode,
        "worker_running": worker_running,
        "last_worker_heartbeat": last_heartbeat.isoformat() if last_heartbeat else None,
        "active_sources": active_sources,
        "due_sources": due_sources,
        "running_jobs": status_record.running_jobs if status_record else 0,
        "last_error": safe_last_error
    }
