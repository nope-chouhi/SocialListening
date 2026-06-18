"""
Background Scheduler Service for Automated Scanning
Uses APScheduler to run scheduled scans based on source configurations.
Supports standalone worker mode and heartbeat tracking.
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.core.database import SessionLocal
from app.models.source import Source, CrawlFrequency
from app.models.crawl import CrawlJob, CrawlJobStatus

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()
scheduler_started = False

# Worker heartbeat tracking (in-memory, also persisted to DB)
_last_heartbeat: Optional[datetime] = None
_last_error: Optional[str] = None

def ensure_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_db() -> Session:
    """Get database session"""
    return SessionLocal()


def get_frequency_interval(frequency: str) -> timedelta:
    """Convert crawl frequency to timedelta interval"""
    intervals = {
        'hourly': timedelta(hours=1),
        'daily': timedelta(days=1),
        'weekly': timedelta(weeks=1),
        'monthly': timedelta(days=30),
        'yearly': timedelta(days=365),
    }
    return intervals.get(frequency, timedelta(hours=1))


def calculate_next_crawl_time(source_or_frequency=None, **kwargs) -> Optional[datetime]:
    """
    Calculate next crawl time.

    Accepts either:
    - A Source object (used by scheduler_service)
    - Keyword args: frequency=, crawl_time=, crawl_day_of_week=, etc. (used by sources.py)

    Returns None if frequency is manual or source is inactive.
    """
    # Handle keyword-args mode (called from sources.py during creation)
    if source_or_frequency is None or isinstance(source_or_frequency, str):
        freq = source_or_frequency or kwargs.get('frequency', 'manual')
        if hasattr(freq, 'value'):
            freq = freq.value
        if freq == 'manual':
            return None
        now = datetime.now(timezone.utc)
        interval = get_frequency_interval(freq)
        return now + interval

    # Handle Source object mode (called from scheduler_service)
    source = source_or_frequency
    if not source.is_active:
        return None

    freq = source.crawl_frequency
    if hasattr(freq, 'value'):
        freq = freq.value

    if freq == 'manual':
        return None

    now = datetime.now(timezone.utc)
    interval = get_frequency_interval(freq)

    # If never crawled, next time is now
    if not source.last_crawled_at:
        return now

    # Calculate next time based on last crawl + interval
    last_crawled_at_aware = ensure_aware_utc(source.last_crawled_at)
    next_time = last_crawled_at_aware + interval

    # If next time is in the past, return now (overdue)
    if next_time < now:
        return now

    return next_time


def get_due_sources(db: Session) -> List[Source]:
    """
    Find all active sources that are due for scanning.
    A source is due if:
    - is_active == True
    - crawl_frequency != manual
    - next_crawl_at <= now OR next_crawl_at is NULL and never crawled
    """
    now = datetime.now(timezone.utc)
    sources = db.execute(
        select(Source).where(Source.is_active == True)
    ).scalars().all()

    due = []
    for source in sources:
        # Skip test sources
        is_test = 'example.com' in source.url or any(x in source.name.lower() for x in ['daily source', 'weekly source', 'monthly source', 'yearly source'])
        if is_test:
            continue
            
        # Skip unsupported sources
        is_supported = (source.source_type or '').lower() in ['rss', 'website']
        if not is_supported:
            continue

        freq = source.crawl_frequency
        if hasattr(freq, 'value'):
            freq = freq.value

        if freq == 'manual':
            continue

        # Check if overdue
        next_crawl_at_aware = ensure_aware_utc(source.next_crawl_at)
        if next_crawl_at_aware and next_crawl_at_aware <= now:
            due.append(source)
        elif not source.last_crawled_at and not source.next_crawl_at:
            # Never crawled and no next_crawl_at set
            due.append(source)
        elif not source.next_crawl_at and source.last_crawled_at:
            # Has been crawled but next_crawl_at not set - calculate
            next_time = calculate_next_crawl_time(source)
            next_time_aware = ensure_aware_utc(next_time)
            if next_time_aware and next_time_aware <= now:
                due.append(source)

    return due


def has_active_job(db: Session, source_id: int) -> bool:
    """Check if there's already a running or pending job for this source"""
    try:
        # CrawlJob.source_ids is a JSON array, check if source_id is in any active job
        active_jobs = db.execute(
            select(CrawlJob).where(
                CrawlJob.status.in_([CrawlJobStatus.PENDING, CrawlJobStatus.RUNNING])
            )
        ).scalars().all()

        now = datetime.now(timezone.utc)
        for job in active_jobs:
            is_stuck = False
            job_started_at_aware = ensure_aware_utc(job.started_at)
            job_created_at_aware = ensure_aware_utc(job.created_at)
            
            if job_started_at_aware and (now - job_started_at_aware).total_seconds() > 1800:
                is_stuck = True
            elif job_created_at_aware and not job_started_at_aware and (now - job_created_at_aware).total_seconds() > 1800:
                is_stuck = True
                
            if is_stuck:
                job.status = CrawlJobStatus.FAILED
                job.error_message = "Job timed out or stuck."
                job.completed_at = now
                try:
                    db.commit()
                except:
                    db.rollback()
                continue
                
            if job.source_ids and source_id in job.source_ids:
                return True

        return False
    except Exception:
        return False


def execute_scheduled_scan(source_id: int):
    """
    Execute a scheduled scan for a specific source.
    Creates a CrawlJob, runs the crawl, updates source stats.
    """
    db = get_db()
    try:
        source = db.execute(
            select(Source).where(Source.id == source_id)
        ).scalar_one_or_none()

        if not source or not source.is_active:
            logger.info(f"Source {source_id} not found or inactive, skipping")
            return

        # Check for active job
        if has_active_job(db, source_id):
            logger.info(f"Source {source_id} already has an active job, skipping")
            return

        logger.info(f"Starting scheduled scan for source: {source.name} (ID: {source_id})")

        # Create crawl job
        job = CrawlJob(
            source_ids=[source_id],
            job_type='scheduled',
            status=CrawlJobStatus.PENDING,
            total_sources=1,
            processed_sources=0,
            mentions_found=0,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Update job status to running
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        # Import here to avoid circular dependency
        from app.services.crawl_service import crawl_source

        try:
            result = crawl_source(db, source_id, job_id=job.id)

            # Update job status
            job.status = CrawlJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            job.mentions_found = result.get('mentions_found', 0)
            job.processed_sources = 1
            job.error_message = None

            # Update source statistics
            now = datetime.now(timezone.utc)
            source.last_crawled_at = now
            source.last_success_at = now
            source.crawl_count = (source.crawl_count or 0) + 1
            source.error_count = 0
            source.last_error = None

            # Calculate and set next crawl time
            source.next_crawl_at = calculate_next_crawl_time(source)

            db.commit()

            logger.info(f"✅ Scan completed for {source.name}: "
                       f"{result.get('mentions_new', 0)} new, "
                       f"{result.get('mentions_duplicate', 0)} duplicate")

        except Exception as e:
            # Update job status to failed
            job.status = CrawlJobStatus.FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = str(e)[:2000]
            job.processed_sources = 1

            # Update source error count
            source.last_crawled_at = datetime.now(timezone.utc)
            source.error_count = (source.error_count or 0) + 1
            source.last_error = str(e)[:2000]

            # Still calculate next crawl time so we retry later
            source.next_crawl_at = calculate_next_crawl_time(source)

            db.commit()
            logger.error(f"❌ Scan failed for {source.name}: {e}")

    except Exception as e:
        logger.error(f"❌ Error executing scheduled scan for source {source_id}: {e}")
    finally:
        db.close()


def scan_all_due_sources():
    """
    Main scheduler loop function.
    Finds all due sources and triggers scans.
    Called every 10 minutes by the scheduler.
    """
    global _last_heartbeat, _last_error

    db = get_db()
    try:
        _last_heartbeat = datetime.now(timezone.utc)
        logger.info(f"[Worker] Checking due sources at {_last_heartbeat.isoformat()}")

        # Update heartbeat in database for system status
        try:
            from app.models.system_settings import WorkerStatus
            from sqlalchemy.sql import func
            status = db.query(WorkerStatus).first()
            if not status:
                status = WorkerStatus(id=1, running_jobs=0)
                db.add(status)
            else:
                status.last_heartbeat = func.now()
                status.last_error = None
            db.commit()
        except Exception as heartbeat_err:
            logger.error(f"[Worker] Failed to update heartbeat in DB: {heartbeat_err}")

        due_sources = get_due_sources(db)

        if not due_sources:
            logger.info("[Worker] No sources due for scanning")
            _last_error = None
            return

        logger.info(f"[Worker] Found {len(due_sources)} due sources")

        scans_triggered = 0
        for source in due_sources:
            try:
                execute_scheduled_scan(source.id)
                scans_triggered += 1
            except Exception as e:
                logger.error(f"[Worker] Error scanning source {source.id}: {e}")

        logger.info(f"[Worker] Triggered {scans_triggered} scans")
        _last_error = None

    except Exception as e:
        _last_error = str(e)
        logger.error(f"[Worker] ❌ Error in scan_all_due_sources: {e}")
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).first()
            if status:
                status.last_error = str(e)[:2000]
                db.commit()
        except:
            pass
    finally:
        db.close()


_is_embedded_mode = False

def start_scheduler(is_embedded: bool = False):
    """
    Start the background scheduler.
    Should be called once when the application starts.
    """
    global scheduler_started, _is_embedded_mode

    if scheduler_started:
        logger.info("Scheduler already started, skipping")
        return

    # If starting as embedded, we don't check SCHEDULER_ENABLED env, we assume caller verified ENABLE_EMBEDDED_SCHEDULER
    if not is_embedded:
        scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
        if not scheduler_enabled:
            logger.info("Scheduler disabled by environment variable SCHEDULER_ENABLED=false")
            return

    _is_embedded_mode = is_embedded

    try:
        # Use SCAN_INTERVAL_MINUTES from settings, default 15
        interval_minutes = settings.SCAN_INTERVAL_MINUTES
        # Use 1 minute interval for embedded mode to ensure heartbeat updates frequently
        actual_interval = 1 if is_embedded else interval_minutes
        
        scheduler.add_job(
            scan_all_due_sources,
            IntervalTrigger(minutes=actual_interval),
            id='scan_due_sources',
            name='Scan Due Sources',
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30)  # First run 30s after start
        )

        # Social platform crawl (Twitter/Reddit/News) every 5 minutes
        from app.core.config import settings as app_settings
        if app_settings.SOCIAL_CRAWL_ENABLED:
            from app.services.social_crawl_job import run_social_crawl_sync
            social_interval = app_settings.SOCIAL_CRAWL_INTERVAL_MINUTES
            scheduler.add_job(
                run_social_crawl_sync,
                IntervalTrigger(minutes=social_interval),
                id='social_crawl',
                name='Social Platform Crawl',
                replace_existing=True,
                next_run_time=datetime.now(timezone.utc) + timedelta(seconds=60),
            )
            logger.info(f"Social crawl job scheduled every {social_interval} min")

        scheduler.start()
        scheduler_started = True

        mode_str = "embedded" if is_embedded else "standalone"
        logger.info(f"✅ Background scheduler ({mode_str}) started (interval: {interval_minutes} min)")

    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {e}")


def stop_scheduler():
    """Stop the background scheduler"""
    global scheduler_started

    if not scheduler_started:
        return

    try:
        scheduler.shutdown(wait=False)
        scheduler_started = False
        logger.info("✅ Background scheduler stopped")
    except Exception as e:
        logger.error(f"❌ Error stopping scheduler: {e}")


def get_scheduler_status() -> dict:
    """Get the current status of the scheduler and worker"""
    return {
        "running": scheduler_started,
        "last_heartbeat": _last_heartbeat.isoformat() if _last_heartbeat else None,
        "last_error": _last_error,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None
            }
            for job in scheduler.get_jobs()
        ] if scheduler_started else []
    }


def get_worker_status(db: Session) -> dict:
    """
    Get comprehensive worker status for the API.
    Returns info about scheduler, active sources, due sources, running jobs.
    """
    try:
        # Count active non-manual sources
        all_sources = db.execute(
            select(Source).where(Source.is_active == True)
        ).scalars().all()

        active_sources = 0
        for s in all_sources:
            freq = s.crawl_frequency
            if hasattr(freq, 'value'):
                freq = freq.value
            if freq != 'manual':
                active_sources += 1

        due_sources = len(get_due_sources(db))

        # Count running jobs
        running_jobs = db.execute(
            select(CrawlJob).where(
                CrawlJob.status.in_([CrawlJobStatus.PENDING, CrawlJobStatus.RUNNING])
            )
        ).scalars().all()

        # Get last scan time
        last_job = db.execute(
            select(CrawlJob).where(CrawlJob.status == CrawlJobStatus.COMPLETED).order_by(CrawlJob.completed_at.desc()).limit(1)
        ).scalar_one_or_none()
        last_scan_at = last_job.completed_at.isoformat() if last_job and last_job.completed_at else None

        # Get next scan time
        next_scan_at = None
        if scheduler_started:
            for job in scheduler.get_jobs():
                if job.id == 'scan_due_sources' and job.next_run_time:
                    next_scan_at = job.next_run_time.isoformat()
                    break

        return {
            "scheduler_enabled": os.getenv("SCHEDULER_ENABLED", "true").lower() == "true",
            "worker_running": scheduler_started,
            "last_heartbeat": _last_heartbeat.isoformat() if _last_heartbeat else None,
            "last_error": _last_error,
            "active_sources": active_sources,
            "due_sources": due_sources,
            "running_jobs": len(list(running_jobs)),
            "warning": None if scheduler_started else "Worker is not running. Background RSS scanning is disabled.",
            "last_scan_at": last_scan_at,
            "next_scan_at": next_scan_at
        }
    except Exception as e:
        logger.error(f"Error getting worker status: {e}")
        return {
            "scheduler_enabled": False,
            "worker_running": scheduler_started,
            "last_heartbeat": None,
            "last_error": str(e),
            "active_sources": 0,
            "due_sources": 0,
            "running_jobs": 0,
            "warning": f"Error checking status: {e}",
            "last_scan_at": None,
            "next_scan_at": None
        }
