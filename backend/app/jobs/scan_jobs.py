import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.keyword import Keyword, KeywordGroup
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.services.scan_service import execute_scan
from app.services.scheduler_service import scheduler_lock

logger = logging.getLogger(__name__)

def run_automated_scans():
    if not getattr(settings, "AUTO_SCAN_ENABLED", True):
        logger.info("Auto scan is disabled via settings.")
        return

    db = SessionLocal()
    try:
        with scheduler_lock(db, 1004, "run_automated_scans") as acquired:
            if not acquired:
                return

            logger.info("Starting automated keyword scan job...")
            
            # Get active keyword groups
            groups = db.execute(
                select(KeywordGroup).where(KeywordGroup.is_active == True)
            ).scalars().all()
        
            project_keywords = {}
            for group in groups:
                keywords = db.execute(
                    select(Keyword).where(
                        Keyword.group_id == group.id,
                        Keyword.is_active == True,
                        Keyword.is_excluded == False
                    )
                ).scalars().all()
                
                if not keywords:
                    continue
                    
                pid = group.project_id
                if pid not in project_keywords:
                    project_keywords[pid] = []
                    
                for kw in keywords:
                    kw_lower = kw.keyword.strip().lower()
                    if kw_lower and kw_lower not in project_keywords[pid]:
                        project_keywords[pid].append(kw_lower)
            
            for project_id, keywords in project_keywords.items():
                if not keywords:
                    continue
                    
                logger.info(f"Auto-scanning project {project_id} with {len(keywords)} keywords.")
                
                # Check if there's already a running job for this project to prevent spam
                # We can check CrawlJob table
                from sqlalchemy import or_, and_
                running_job = db.execute(
                    select(CrawlJob).where(
                        CrawlJob.status.in_([CrawlJobStatus.PENDING, CrawlJobStatus.RUNNING]),
                        CrawlJob.job_type == 'auto_scan'
                    )
                ).scalars().first()
                
                if running_job:
                    meta = running_job.meta_data or {}
                    if meta.get("project_id") == project_id:
                        logger.info(f"Skipping auto-scan for project {project_id}: Job {running_job.id} already running.")
                        continue
    
                job = CrawlJob(
                    job_type='auto_scan',
                    status=CrawlJobStatus.PENDING,
                    total_sources=0,
                    processed_sources=0,
                    mentions_found=0,
                    started_at=datetime.now(timezone.utc),
                    meta_data={
                        "query": "",
                        "query_key": "|".join(sorted(keywords)),
                        "project_id": project_id,
                        "mode": "AUTO_DISCOVERY",
                        "keywords": keywords,
                        "provider": "none",
                        "source_types": ["web", "youtube", "social", "rss"],
                        "expand_keywords": False,
                        "auto_triggered": True,
                        "reason": "scheduled_auto_scan"
                    }
                )
                db.add(job)
                db.commit()
                db.refresh(job)
                
                try:
                    execute_scan(
                        job_id=job.id,
                        project_id=project_id,
                        keyword_texts=keywords,
                        mode="AUTO_DISCOVERY",
                        max_results=10, # Keep results limited for frequent auto scans
                        source_types=["web", "youtube", "social", "rss"]
                    )
                except Exception as e:
                    logger.error(f"Error executing auto scan for project {project_id}: {e}")
                    
            logger.info("Automated keyword scan job completed.")
    except Exception as e:
        logger.error(f"Failed to run automated scan job: {e}")
    finally:
        db.close()
