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
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, text
from contextlib import contextmanager

from app.core.database import SessionLocal
from app.models.source import Source, CrawlFrequency
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.core.config import settings

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
        is_supported = (source.source_type or '').lower() in ['rss', 'website', 'facebook_page', 'instagram_business']
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


@contextmanager
def scheduler_lock(db: Session, lock_id: int, lock_name: str):
    """
    Context manager for acquiring a Postgres advisory lock with SQLite fallback.
    Yields True if lock acquired, False otherwise.
    """
    is_pg = db.bind.dialect.name == 'postgresql'
    lock_acquired = False
    
    if is_pg:
        try:
            res = db.execute(text(f"SELECT pg_try_advisory_lock({lock_id})")).scalar()
            lock_acquired = bool(res)
        except Exception as e:
            logger.error(f"Error acquiring PG lock {lock_id}: {e}")
            lock_acquired = False
    else:
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).with_for_update().first()
            if status:
                now = datetime.now(timezone.utc)
                if status.is_locked and status.locked_at and (now - status.locked_at.replace(tzinfo=timezone.utc)).total_seconds() < 1800:
                    lock_acquired = False
                else:
                    status.is_locked = True
                    status.locked_at = now
                    db.commit()
                    lock_acquired = True
        except Exception as e:
            db.rollback()
            logger.error(f"Error acquiring SQLite lock: {e}")
            lock_acquired = False
            
    if not lock_acquired:
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).first()
            if status:
                status.skipped_due_to_lock_count = (status.skipped_due_to_lock_count or 0) + 1
                db.commit()
        except:
            db.rollback()
        logger.info(f"[Worker] Lock {lock_id} ({lock_name}) already held, skipping tick.")
        yield False
        return

    try:
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).first()
            if status:
                status.last_started_at = datetime.now(timezone.utc)
                status.running_jobs = (status.running_jobs or 0) + 1
                db.commit()
        except:
            db.rollback()
            
        yield True
    finally:
        if is_pg:
            try:
                db.execute(text(f"SELECT pg_advisory_unlock({lock_id})"))
                db.commit()
            except Exception as e:
                logger.error(f"Error releasing PG lock {lock_id}: {e}")
        else:
            try:
                from app.models.system_settings import WorkerStatus
                status = db.query(WorkerStatus).first()
                if status:
                    status.is_locked = False
                    status.locked_at = None
                    db.commit()
            except:
                db.rollback()
                
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).first()
            if status:
                status.last_finished_at = datetime.now(timezone.utc)
                status.running_jobs = max(0, (status.running_jobs or 1) - 1)
                db.commit()
        except:
            db.rollback()

def scan_all_due_sources():
    """
    Main scheduler loop function for RSS/Web sources.
    Finds all due sources and triggers scans.
    """
    global _last_heartbeat, _last_error

    db = get_db()
    try:
        with scheduler_lock(db, 1001, "scan_all_due_sources") as acquired:
            if not acquired:
                return

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
        
        # Update metrics
        try:
            from app.models.system_settings import WorkerStatus
            status = db.query(WorkerStatus).first()
            if status:
                status.last_success_at = datetime.now(timezone.utc)
                status.last_scan_count = scans_triggered
                db.commit()
        except:
            db.rollback()

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

def run_scheduled_discovery_scans():
    """
    Scheduled job to automatically run Auto Discovery on active projects.
    """
    db = get_db()
    try:
        with scheduler_lock(db, 1003, "run_scheduled_discovery_scans") as acquired:
            if not acquired:
                return

            from app.models.keyword import KeywordGroup, Keyword
            from app.services.discovery_service import create_discovery_job, run_discovery_job
            from app.models.system_settings import WorkerStatus
            
            # Find projects (KeywordGroups) that have active keywords
            # and haven't had a discovery job in the last 24h.
            active_groups = db.execute(
                select(KeywordGroup).where(KeywordGroup.is_active == True)
            ).scalars().all()
            
            now = datetime.now(timezone.utc)
            triggered_count = 0
            
            for group in active_groups:
                has_keywords = db.execute(select(Keyword).where(Keyword.group_id == group.id, Keyword.is_active == True)).first()
                if not has_keywords:
                    continue
                    
                # Check last discovery job
                from app.models.discovery import DiscoveryJob
                last_job = db.execute(
                    select(DiscoveryJob)
                    .where(DiscoveryJob.keyword_group_id == group.id)
                    .order_by(DiscoveryJob.created_at.desc())
                    .limit(1)
                ).scalar_one_or_none()
                
                if last_job and last_job.created_at:
                    last_job_time = last_job.created_at.replace(tzinfo=timezone.utc) if last_job.created_at.tzinfo is None else last_job.created_at
                    if (now - last_job_time).total_seconds() < 86400: # 24 hours
                        continue
                        
                logger.info(f"[AutoDiscovery] Triggering scheduled discovery for project: {group.name}")
                try:
                    # Create job mimicking manual creation
                    req_dict = {
                        "keyword_group_id": group.id,
                        "project_id": group.project_id,
                        "limit": 20,
                        "date_range": "last_24_hours"
                    }
                    job = create_discovery_job(db, group.created_by_user_id, req_dict)
                    db.commit()
                    
                    # Run job
                    run_discovery_job(db, job.id)
                    triggered_count += 1
                except Exception as e:
                    logger.error(f"[AutoDiscovery] Error for project {group.id}: {e}")
                    db.rollback()
                    
            if triggered_count > 0:
                try:
                    status = db.query(WorkerStatus).first()
                    if status:
                        status.last_success_at = now
                        status.last_scan_count = (status.last_scan_count or 0) + triggered_count
                        db.commit()
                except:
                    db.rollback()
                    
    except Exception as e:
        logger.error(f"[AutoDiscovery] ❌ Error in run_scheduled_discovery_scans: {e}")
    finally:
        db.close()

def update_heartbeat_job():
    """Update heartbeat in DB every minute so worker appears 'running'."""
    global _last_heartbeat
    _last_heartbeat = datetime.now(timezone.utc)
    db = get_db()
    try:
        from app.models.system_settings import WorkerStatus
        from sqlalchemy.sql import func
        status = db.query(WorkerStatus).first()
        if not status:
            status = WorkerStatus(id=1, running_jobs=0)
            db.add(status)
        else:
            status.last_heartbeat = func.now()
        db.commit()
    except Exception as e:
        logger.error(f"[Worker Heartbeat] Failed: {e}")
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
        return True

    # If starting as embedded, we don't check SCHEDULER_ENABLED env, we assume caller verified ENABLE_EMBEDDED_SCHEDULER
    if not is_embedded:
        scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
        if not scheduler_enabled:
            logger.info("Scheduler disabled by environment variable SCHEDULER_ENABLED=false")
            return False

    _is_embedded_mode = is_embedded

    try:
        # Use SCAN_INTERVAL_MINUTES from settings, default 15
        interval_minutes = settings.SCAN_INTERVAL_MINUTES
        actual_interval = interval_minutes
        
        # Add heartbeat job every 1 minute
        scheduler.add_job(
            update_heartbeat_job,
            IntervalTrigger(minutes=1),
            id='heartbeat_job',
            name='Update Heartbeat',
            replace_existing=True
        )

        scheduler.add_job(
            scan_all_due_sources,
            IntervalTrigger(minutes=actual_interval),
            id='scan_due_sources',
            name='Scan Due Sources',
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30)  # First run 30s after start
        )

        # Social platform crawl (Twitter/Reddit/News)
        from app.core.config import settings as app_settings
        if app_settings.SOCIAL_CRAWL_ENABLED:
            from app.services.social_crawl_job import run_social_crawl_sync
            social_interval = app_settings.SCAN_INTERVAL_MINUTES
            scheduler.add_job(
                run_social_crawl_sync,
                IntervalTrigger(minutes=social_interval),
                id='social_crawl',
                name='Social Platform Crawl',
                replace_existing=True,
                next_run_time=datetime.now(timezone.utc) + timedelta(seconds=60),
            )
            logger.info(f"Social crawl job scheduled every {social_interval} min")

        # Add scheduled discovery job (every 6 hours)
        if app_settings.AUTO_DISCOVERY_ENABLED:
            scheduler.add_job(
                run_scheduled_discovery_scans,
                IntervalTrigger(hours=6),
                id='scheduled_discovery',
                name='Auto Discovery Crawl',
                replace_existing=True,
                next_run_time=datetime.now(timezone.utc) + timedelta(minutes=2)
            )
            logger.info("Auto Discovery scheduled job configured (runs every 6h).")

        # Add Phase 4 Automated Scanning Scheduler
        if getattr(app_settings, "AUTO_SCAN_ENABLED", False):
            from app.jobs.scan_jobs import run_automated_scans
            auto_scan_interval = getattr(app_settings, "AUTO_SCAN_INTERVAL_MINUTES", 15)
            scheduler.add_job(
                run_automated_scans,
                IntervalTrigger(minutes=auto_scan_interval),
                id='automated_scan_job',
                name='Periodic background keyword scanning',
                replace_existing=True,
                next_run_time=datetime.now(timezone.utc) + timedelta(seconds=45)
            )
            logger.info(f"Phase 4 Automated keyword scanning scheduled every {auto_scan_interval} min")

        scheduler.start()
        scheduler_started = True

        # Sync existing ScanSchedules from DB
        try:
            sync_scan_schedules()
            sync_email_report_schedules()
        except Exception as e:
            logger.error(f"Error syncing schedules on startup: {e}")

        mode_str = "embedded" if is_embedded else "standalone"
        logger.info(f"✅ Background scheduler ({mode_str}) started (interval: {interval_minutes} min)")
        return True

    except Exception as e:
        scheduler_started = False
        logger.error(f"❌ Failed to start scheduler: {e}")
        return False


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


# --- PHASE 4: AUTOMATED SCAN SCHEDULES ---

def execute_scan_schedule_job(schedule_id: int):
    """Execute a scan schedule job, logs to ScanLog and creates a CrawlJob."""
    db = get_db()
    try:
        from app.models.crawl import ScanSchedule, CrawlJob, CrawlJobStatus, ScanLog
        
        schedule = db.execute(select(ScanSchedule).where(ScanSchedule.id == schedule_id)).scalar_one_or_none()
        if not schedule or not schedule.is_active:
            logger.info(f"ScanSchedule {schedule_id} not found or inactive, skipping.")
            return
            
        logger.info(f"Starting ScanSchedule {schedule_id}: {schedule.name}")
        
        # Create a ScanLog entry
        log_entry = ScanLog(
            scan_schedule_id=schedule.id,
            level="INFO",
            message=f"Starting scheduled scan: {schedule.name}"
        )
        db.add(log_entry)
        db.commit()
        
        # Create a CrawlJob associated with this schedule
        job = CrawlJob(
            scan_schedule_id=schedule.id,
            job_type='scheduled',
            status=CrawlJobStatus.PENDING,
            source_ids=[], # Can be updated later
            keyword_group_ids=schedule.keyword_group_ids,
            total_sources=0,
            processed_sources=0,
            mentions_found=0
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Update ScanLog with job_id
        log_entry.job_id = job.id
        db.commit()
        
        # Execute the scan logic using `app.services.scan_service.execute_scan`
        from app.services.scan_service import execute_scan
        
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        
        try:
            # We map source_group_ids/keyword_group_ids to the execute_scan params
            # mode="HYBRID" uses keyword_group_ids and auto-discovers if sources not provided
            result = execute_scan(
                db=db,
                user_id=schedule.user_id,
                keyword_group_ids=schedule.keyword_group_ids or [],
                keywords=[],
                source_ids=[], # You might want to resolve source_group_ids to source_ids if needed
                mode="HYBRID",
                job_id=job.id,
                project_id=None
            )
            
            job.status = CrawlJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            job.mentions_found = result.get('created_mentions_count', 0)
            
            # Log success
            db.add(ScanLog(
                scan_schedule_id=schedule.id,
                job_id=job.id,
                level="INFO",
                message=f"Scan completed successfully. Mentions found: {job.mentions_found}"
            ))
            db.commit()
            
        except Exception as e:
            job.status = CrawlJobStatus.FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = str(e)[:2000]
            
            db.add(ScanLog(
                scan_schedule_id=schedule.id,
                job_id=job.id,
                level="ERROR",
                message=f"Scan failed: {job.error_message}"
            ))
            db.commit()
            
    except Exception as e:
        logger.error(f"❌ Error in execute_scan_schedule_job {schedule_id}: {e}")
    finally:
        db.close()


def sync_scan_schedules():
    """Sync active ScanSchedules from DB to APScheduler using CronTrigger."""
    global scheduler_started
    if not scheduler_started:
        return
        
    db = get_db()
    try:
        from app.models.crawl import ScanSchedule
        
        # Find all active schedules
        active_schedules = db.execute(
            select(ScanSchedule).where(ScanSchedule.is_active == True)
        ).scalars().all()
        
        # Get existing scan schedule jobs
        existing_jobs = [job.id for job in scheduler.get_jobs() if job.id.startswith('schedule_')]
        
        # Keep track of ones we need to keep
        keep_job_ids = []
        
        for schedule in active_schedules:
            job_id = f"schedule_{schedule.id}"
            keep_job_ids.append(job_id)
            
            try:
                # Add or update job
                scheduler.add_job(
                    execute_scan_schedule_job,
                    CronTrigger.from_crontab(schedule.cron_expression, timezone=schedule.timezone or 'Asia/Ho_Chi_Minh'),
                    args=[schedule.id],
                    id=job_id,
                    name=f"Scan Schedule {schedule.id}: {schedule.name}",
                    replace_existing=True
                )
            except Exception as e:
                logger.error(f"❌ Failed to add/update ScanSchedule {schedule.id} job: {e}")
                
        # Remove jobs that are no longer active or deleted
        for job_id in existing_jobs:
            if job_id not in keep_job_ids:
                try:
                    scheduler.remove_job(job_id)
                except Exception as e:
                    logger.warning(f"Could not remove stale job {job_id}: {e}")
                    
        logger.info(f"🔄 Synced {len(active_schedules)} active ScanSchedules to APScheduler.")
    except Exception as e:
        logger.error(f"Error syncing scan schedules: {e}")
    finally:
        db.close()


def send_daily_report_job():
    """Execute the daily email report."""
    db = get_db()
    try:
        from app.services.email_report_service import send_scheduled_report_email
        send_scheduled_report_email(db, "daily")
    except Exception as e:
        logger.error(f"Error executing daily email report job: {e}")
    finally:
        db.close()

def send_weekly_report_job():
    """Execute the weekly email report."""
    db = get_db()
    try:
        from app.services.email_report_service import send_scheduled_report_email
        send_scheduled_report_email(db, "weekly")
    except Exception as e:
        logger.error(f"Error executing weekly email report job: {e}")
    finally:
        db.close()

def sync_email_report_schedules():
    """Sync email report schedules from SystemNotificationSettings to APScheduler."""
    global scheduler_started
    if not scheduler_started:
        return
        
    db = get_db()
    try:
        from app.models.system_settings import SystemNotificationSettings
        
        sys_settings = db.execute(select(SystemNotificationSettings)).scalars().first()
        
        # Daily job
        daily_job_id = "scheduled_email_report_daily"
        if sys_settings and sys_settings.daily_report_enabled and sys_settings.report_email_recipients:
            time_str = sys_settings.daily_report_time or "09:00"
            try:
                hour, minute = map(int, time_str.split(':'))
            except Exception:
                hour, minute = 9, 0
                
            scheduler.add_job(
                send_daily_report_job,
                CronTrigger(hour=hour, minute=minute, timezone='Asia/Ho_Chi_Minh'),
                id=daily_job_id,
                name="Daily Email Report",
                replace_existing=True
            )
        else:
            if scheduler.get_job(daily_job_id):
                scheduler.remove_job(daily_job_id)
                
        # Weekly job
        weekly_job_id = "scheduled_email_report_weekly"
        if sys_settings and sys_settings.weekly_report_enabled and sys_settings.report_email_recipients:
            time_str = sys_settings.weekly_report_time or "09:00"
            day_of_week = sys_settings.weekly_report_day or 0  # 0=Monday, 6=Sunday
            # APScheduler CronTrigger day_of_week: 0-6 or mon-sun
            try:
                hour, minute = map(int, time_str.split(':'))
            except Exception:
                hour, minute = 9, 0
                
            scheduler.add_job(
                send_weekly_report_job,
                CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute, timezone='Asia/Ho_Chi_Minh'),
                id=weekly_job_id,
                name="Weekly Email Report",
                replace_existing=True
            )
        else:
            if scheduler.get_job(weekly_job_id):
                scheduler.remove_job(weekly_job_id)
                
        logger.info("🔄 Synced email report schedules to APScheduler.")
    except Exception as e:
        logger.error(f"Error syncing email report schedules: {e}")
    finally:
        db.close()
