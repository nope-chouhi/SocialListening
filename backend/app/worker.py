"""
Standalone RSS Worker Process
Run with: python -m app.worker

This process runs independently from the FastAPI web server.
It continuously monitors RSS sources on their configured schedules.

Usage:
    python -m app.worker                    # Default: scan every 10 minutes
    python -m app.worker --interval 5       # Scan every 5 minutes
    python -m app.worker --once             # Single scan, then exit

Environment variables:
    SCHEDULER_ENABLED=true                  # Enable/disable scheduler
    DATABASE_URL=sqlite:///./social_listening.db  # Database connection
"""
import os
import sys
import time
import signal
import logging
import argparse
from datetime import datetime, timezone

# Setup logging before imports
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('worker')

# Ensure pydantic compatibility
try:
    from app.fix_pydantic_all import fix_pydantic_all
    fix_pydantic_all()
except ImportError:
    pass

from app.core.database import engine, Base, SessionLocal
from app.models import *  # Import all models to register them
from app.services.scheduler_service import (
    scan_all_due_sources,
    start_scheduler,
    stop_scheduler,
    get_scheduler_status
)


# Graceful shutdown
_shutdown_requested = False


def signal_handler(signum, frame):
    global _shutdown_requested
    logger.info(f"Received signal {signum}. Shutting down gracefully...")
    _shutdown_requested = True


def ensure_tables():
    """Ensure all database tables exist"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified")
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        sys.exit(1)


def update_heartbeat():
    """Update worker heartbeat in database"""
    try:
        from app.models.system_settings import WorkerStatus
        from sqlalchemy.sql import func
        db = SessionLocal()
        status = db.query(WorkerStatus).first()
        if not status:
            status = WorkerStatus(id=1, running_jobs=0)
            db.add(status)
        else:
            status.last_heartbeat = func.now()
            status.last_error = None
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to update heartbeat: {e}")


def run_once():
    """Run a single scan cycle and exit"""
    logger.info("=" * 60)
    logger.info("RSS Worker - Single scan mode")
    logger.info("=" * 60)

    ensure_tables()

    logger.info("Running single scan cycle...")
    scan_all_due_sources()
    logger.info("Single scan completed. Exiting.")


def run_loop(interval_minutes: int):
    """Run the worker in continuous loop mode"""
    logger.info("=" * 60)
    logger.info(f"RSS Worker - Continuous mode (interval: {interval_minutes} min)")
    # Mask the database URL password
    db_url = os.getenv('DATABASE_URL', 'default')
    masked_db_url = db_url
    if '@' in db_url and '://' in db_url:
        parts = db_url.split('@')
        creds = parts[0].split('://')
        if len(creds) == 2 and ':' in creds[1]:
            user = creds[1].split(':')[0]
            masked_db_url = f"{creds[0]}://{user}:***@{parts[1]}"
            
    logger.info(f"Database: {masked_db_url}")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    ensure_tables()

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start scheduler
    start_scheduler(interval_minutes=interval_minutes)

    status = get_scheduler_status()
    logger.info(f"Scheduler status: running={status['running']}, jobs={len(status['jobs'])}")

    if not status['running']:
        logger.error("Scheduler failed to start. Check SCHEDULER_ENABLED env var.")
        sys.exit(1)

    logger.info("Worker is running. Press Ctrl+C to stop.")

    # Keep the main thread alive and update heartbeat
    last_heartbeat_time = 0
    try:
        while not _shutdown_requested:
            current_time = time.time()
            if current_time - last_heartbeat_time > 30:
                update_heartbeat()
                last_heartbeat_time = current_time
            time.sleep(1)
    except KeyboardInterrupt:
        pass

    # Cleanup
    logger.info("Stopping scheduler...")
    stop_scheduler()
    logger.info("Worker stopped.")


def main():
    parser = argparse.ArgumentParser(description='Social Listening RSS Worker')
    parser.add_argument(
        '--interval', type=int, default=10,
        help='Scan interval in minutes (default: 10)'
    )
    parser.add_argument(
        '--once', action='store_true',
        help='Run a single scan and exit'
    )
    args = parser.parse_args()

    if args.once:
        run_once()
    else:
        run_loop(args.interval)


if __name__ == '__main__':
    main()
