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
        import os
        import alembic.config
        import alembic.command
        from app.core.config import settings

        # Move to backend directory so alembic can find env.py
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        original_cwd = os.getcwd()
        os.chdir(base_dir)
        
        try:
            from app.core.database import engine
            import sqlalchemy as sa
            
            # Check current version
            current_version = None
            try:
                with engine.connect() as conn:
                    result = conn.execute(sa.text("SELECT version_num FROM alembic_version"))
                    row = result.fetchone()
                    if row:
                        current_version = row[0]
            except sa.exc.ProgrammingError:
                # Table doesn't exist
                pass
                
            # If empty or missing, stamp it to the revision BEFORE the worker_status enhance
            if not current_version:
                with engine.begin() as conn:
                    conn.execute(sa.text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num))"))
                    conn.execute(sa.text("DELETE FROM alembic_version"))
                    conn.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('5fe3f0fbfb82')"))
            
            alembic_cfg = alembic.config.Config("alembic.ini")
            if settings.DATABASE_URL:
                alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))
            alembic.command.upgrade(alembic_cfg, "head")
        finally:
            # Restore directory
            os.chdir(original_cwd)

        from app.core.database import engine
        from sqlalchemy.engine.reflection import Inspector
        inspector = Inspector.from_engine(engine)
        tables = inspector.get_table_names()
        
        return {
            "status": "success",
            "message": "Database migrations applied successfully.",
            "tables": tables
        }
    except Exception as e:
        import traceback
        return {"status": "error", "detail": f"Migration failed: {str(e)}", "traceback": traceback.format_exc()}

@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the real-time status of the background worker."""
    try:
        status_record = db.query(WorkerStatus).first()
    except Exception:
        db.rollback()
        status_record = None
    
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
    try:
        active_sources = db.query(Source).filter(Source.is_active == True).count()
    except Exception:
        db.rollback()
        active_sources = 0
    
    # Get due sources (rough estimate: active and next_crawl_at < now)
    try:
        from sqlalchemy.sql import func
        due_sources = db.query(Source).filter(
            Source.is_active == True,
            Source.next_crawl_at <= func.now()
        ).count()
    except Exception:
        db.rollback()
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

    try:
        from app.services.ai_service import get_ai_status
        ai_system_status = get_ai_status()
    except Exception as e:
        ai_system_status = {"ai_available": False, "error": str(e)}

    return {
        "scheduler_enabled": scheduler_enabled,
        "worker_mode": worker_mode,
        "worker_running": worker_running,
        "last_worker_heartbeat": last_heartbeat.isoformat() if last_heartbeat else None,
        "active_sources": active_sources,
        "due_sources": due_sources,
        "running_jobs": status_record.running_jobs if status_record else 0,
        "last_error": safe_last_error,
        "ai_system": ai_system_status,
        "is_locked": status_record.is_locked if status_record else False,
        "scan_interval_minutes": status_record.scan_interval_minutes if status_record else 15,
        "last_started_at": status_record.last_started_at.isoformat() if status_record and status_record.last_started_at else None,
        "last_finished_at": status_record.last_finished_at.isoformat() if status_record and status_record.last_finished_at else None,
        "last_success_at": status_record.last_success_at.isoformat() if status_record and status_record.last_success_at else None,
        "last_scan_count": status_record.last_scan_count if status_record else 0,
        "skipped_due_to_lock_count": status_record.skipped_due_to_lock_count if status_record else 0,
    }
