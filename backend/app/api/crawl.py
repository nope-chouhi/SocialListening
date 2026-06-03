from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime, timezone
import hashlib
import requests
from bs4 import BeautifulSoup
import feedparser
from pydantic import BaseModel

from app.core.database import get_db, SessionLocal
from app.core.tenant import apply_tenant_filter
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source, SourceType
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.services.ai_service import analyze_mention
from app.schemas.crawl import (
    CrawlJobCreate, CrawlJobResponse, CrawlJobListResponse,
    ScanScheduleCreate, ScanScheduleUpdate, ScanScheduleResponse, ScanCapabilitiesResponse
)

router = APIRouter()

class ManualScanRequest(BaseModel):
    keyword_group_ids: Optional[List[int]] = []
    keywords: Optional[List[str]] = []
    source_ids: Optional[List[int]] = []
    url: Optional[str] = None
    mode: Optional[str] = "HYBRID"
    project_id: Optional[int] = None
    max_results: Optional[int] = 50

def _run_discovery_bg(job_id: int):
    db = SessionLocal()
    try:
        from app.services.discovery_service import run_discovery_job
        run_discovery_job(db, job_id)
    except Exception as e:
        print(f"Discovery background task failed: {e}")
    finally:
        db.close()

@router.get("/capabilities", response_model=ScanCapabilitiesResponse)
def get_capabilities():
    from app.core.config import settings
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    
    return {
        "web_search": {
            "enabled": True,
            "provider": "serpapi",
            "configured": has_serpapi,
            "status": "READY" if has_serpapi else "CONFIG_REQUIRED",
            "message": None if has_serpapi else "Chưa cấu hình Web Search provider"
        },
        "auto_discovery": {
            "enabled": True,
            "configured": has_serpapi,
            "status": "READY" if has_serpapi else "CONFIG_REQUIRED",
            "message": None if has_serpapi else "Chưa cấu hình SerpAPI"
        }
    }

class DebugDiscoveryRequest(BaseModel):
    keyword: str

@router.post("/debug-auto-discovery")
def debug_auto_discovery(
    body: DebugDiscoveryRequest,
    current_user: User = Depends(get_current_active_user)
):
    from app.core.config import settings
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    if not has_serpapi:
        return {"success": False, "error": "Chưa cấu hình SERPAPI_API_KEY"}
    
    try:
        from app.services.serpapi_provider import search
        results = search(
            keywords=[body.keyword],
            language="",
            country="",
            limit=5,
            date_range="last_30_days",
        )
        return {
            "success": True,
            "auth_ok": True,
            "serpapi_configured": True,
            "result_count": len(results),
            "top_results": [
                {"title": r.get("title"), "domain": r.get("domain")}
                for r in results[:3]
            ]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/manual-scan")
def manual_scan(
    body: ManualScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Manual scan: Live pipeline for API adapters.
    """
    keyword_texts = []
    if body.keywords:
        for kw in body.keywords:
            kw_lower = kw.lower().strip()
            if kw_lower and kw_lower not in keyword_texts:
                keyword_texts.append(kw_lower)

    if not keyword_texts:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp ít nhất một từ khóa (qua keywords)")

    mode = getattr(body, "mode", "HYBRID") or "HYBRID"
    project_id = body.project_id
    max_results = body.max_results or 50

    job = CrawlJob(
        job_type='manual',
        status=CrawlJobStatus.PENDING,
        total_sources=0,
        processed_sources=0,
        mentions_found=0,
        started_at=datetime.now(timezone.utc),
        meta_data={"project_id": project_id, "mode": mode, "keywords": keyword_texts}
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_manual_scan_task, job.id, project_id, keyword_texts, mode, max_results)

    return {
        "job_id": job.id,
        "status": "QUEUED",
        "mode": mode,
        "project_id": project_id,
        "keywords": keyword_texts
    }


def run_manual_scan_task(job_id: int, project_id: int, keyword_texts: List[str], mode: str, max_results: int):
    from app.core.database import SessionLocal
    from app.models.crawl import CrawlJob, CrawlJobStatus
    from app.models.mention import Mention
    from app.core.config import settings
    import hashlib
    import time
    from urllib.parse import urlparse
    
    db = SessionLocal()
    start_time = time.time()
    
    try:
        job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
        if not job: return
        
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        
        # Check environment capabilities
        has_serpapi = bool(settings.SERPAPI_API_KEY)
        is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
        auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
        auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
        web_ready = has_serpapi and is_serpapi_provider and auto_discovery
        has_youtube = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
        
        summary = {
            "web": {
                "status": "READY" if web_ready else ("SKIPPED" if not is_serpapi_provider else "CONFIG_REQUIRED"),
                "called": False,
                "provider": getattr(settings, "WEB_SEARCH_PROVIDER", "none"),
                "raw_results_count": 0,
                "results_after_keyword_match": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not web_ready else None
            },
            "youtube": {
                "status": "READY" if has_youtube else "CONFIG_REQUIRED",
                "called": False,
                "raw_results_count": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not has_youtube else None
            },
            "adapters_ready": [],
            "serpapi_result_count": 0,
            "urls_crawled": 0,
            "new_mentions_created": 0,
            "duplicates_skipped": 0,
            "old_mentions_existing": 0,
            "errors": []
        }
        
        job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
        db.commit()

        run_discovery = mode in ("AUTO_DISCOVERY", "HYBRID")
        
        def commit_summary():
            db.commit()
            
        if run_discovery:
            # Trigger discovery job
            from app.services.discovery_service import create_discovery_job, run_discovery_job
            try:
                from app.models.user import User
                first_user = db.query(User).first()
                user_id = first_user.id if first_user else 1
                req_data = {
                    "keywords": keyword_texts,
                    "limit": max_results,
                    "language": "",
                    "country": ""
                }
                disc_job = create_discovery_job(db, user_id=user_id, request_data=req_data)
                db.commit()
                def _run_discovery_bg(d_id):
                    from app.core.database import SessionLocal
                    bg_db = SessionLocal()
                    try:
                        run_discovery_job(bg_db, d_id)
                    finally:
                        bg_db.close()
                import threading
                threading.Thread(target=_run_discovery_bg, args=(disc_job.id,)).start()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to create discovery job from scan: {e}")
            
        def is_timeout():
            return (time.time() - start_time) > 120

        # -------------- WEB ADAPTER --------------
        if web_ready:
            summary["adapters_ready"].append("web")
            summary["web"]["called"] = True
            summary["web"]["status"] = "RUNNING"
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
            try:
                if is_timeout():
                    raise TimeoutError("Scan timeout reached before Web Search")
                
                from app.services.serpapi_provider import search
                serp_results = search(
                    keywords=keyword_texts,
                    language="", country="",
                    limit=max_results, date_range=""
                )
                summary["serpapi_result_count"] += len(serp_results)
                summary["web"]["raw_results_count"] += len(serp_results)
                
                # INSERT IMMEDIATELY
                for r in serp_results:
                    url = r.get("url", "").lower().strip()
                    if not url: continue
                    title = r.get("title", "")
                    snippet = r.get("snippet", "")
                    
                    # Assign keyword (fallback to first keyword if exact match not found in snippet)
                    import unicodedata
                    matched_kw = None
                    search_text = unicodedata.normalize('NFC', (title + " " + snippet + " " + url).lower())
                    for kw in keyword_texts:
                        kw_norm = unicodedata.normalize('NFC', kw.lower())
                        if kw_norm in search_text:
                            matched_kw = kw
                            break
                    
                    if not matched_kw:
                        continue # Skip irrelevant result that doesn't contain the keyword
                    
                    summary["web"]["results_after_keyword_match"] += 1
                    content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                    
                    existing = db.execute(select(Mention).where(Mention.project_id == project_id, Mention.url == url)).scalar_one_or_none()
                    if existing:
                        summary["web"]["duplicates_skipped"] += 1
                        summary["duplicates_skipped"] += 1
                        summary["old_mentions_existing"] += 1
                        continue
                        
                    parsed_domain = urlparse(url).netloc
                    
                    mention = Mention(
                        project_id=project_id,
                        job_id=job_id,
                        keyword_text=matched_kw,
                        source_type="web",
                        platform="web",
                        domain=parsed_domain,
                        title=title[:500] if title else None,
                        snippet=snippet[:1000] if snippet else None,
                        content=snippet[:10000] if snippet else None,
                        url=url,
                        content_hash=content_hash,
                        collected_at=datetime.now(timezone.utc),
                        is_reviewed=False,
                        author="",
                        published_at=None
                    )
                    db.add(mention)
                    summary["web"]["mentions_created"] += 1
                    summary["new_mentions_created"] += 1
                db.flush()
                summary["web"]["status"] = "COMPLETED"
            except Exception as e:
                summary["errors"].append(f"WebSearch: {e}")
                summary["web"]["error"] = str(e)
                summary["web"]["status"] = "ERROR"
            
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
        # -------------- YOUTUBE ADAPTER --------------
        if has_youtube:
            summary["adapters_ready"].append("youtube")
            summary["youtube"]["called"] = True
            summary["youtube"]["status"] = "RUNNING"
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
            try:
                if is_timeout():
                    raise TimeoutError("Scan timeout reached before YouTube")
                    
                from app.services.connectors.youtube_connector import YouTubeConnector
                yt = YouTubeConnector()
                if yt.validate_config():
                    yt_res = yt.search_keywords(keywords=keyword_texts, max_results=max_results)
                    summary["youtube"]["raw_results_count"] += len(yt_res)
                    
                    for r in yt_res:
                        url = r.get("url", "").lower().strip()
                        if not url: continue
                        title = r.get("title", "")
                        snippet = r.get("content", "")
                        
                        import unicodedata
                        matched_kw = None
                        search_text = unicodedata.normalize('NFC', (title + " " + snippet + " " + url).lower())
                        for kw in keyword_texts:
                            kw_norm = unicodedata.normalize('NFC', kw.lower())
                            if kw_norm in search_text:
                                matched_kw = kw
                                break
                        
                        if not matched_kw:
                            continue # Skip irrelevant result that doesn't contain the keyword
                        
                        content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                        
                        existing = db.execute(select(Mention).where(Mention.project_id == project_id, Mention.url == url)).scalar_one_or_none()
                        if existing:
                            summary["youtube"]["duplicates_skipped"] += 1
                            summary["duplicates_skipped"] += 1
                            summary["old_mentions_existing"] += 1
                            continue
                            
                        mention = Mention(
                            project_id=project_id,
                            job_id=job_id,
                            keyword_text=matched_kw,
                            source_type="video",
                            platform="youtube",
                            domain="youtube.com",
                            title=title[:500] if title else None,
                            snippet=snippet[:1000] if snippet else None,
                            content=snippet[:10000] if snippet else None,
                            url=url,
                            content_hash=content_hash,
                            collected_at=datetime.now(timezone.utc),
                            is_reviewed=False,
                            author=r.get("author", "")[:500],
                            published_at=r.get("published_at")
                        )
                        db.add(mention)
                        summary["youtube"]["mentions_created"] += 1
                        summary["new_mentions_created"] += 1
                    db.flush()
                summary["youtube"]["status"] = "COMPLETED"
            except Exception as e:
                summary["errors"].append(f"YouTube: {e}")
                summary["youtube"]["error"] = str(e)
                summary["youtube"]["status"] = "ERROR"
                
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()

        db.commit()

        job.completed_at = datetime.now(timezone.utc)
        job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
        job.mentions_found = summary["new_mentions_created"]
        
        # Determine final status
        if is_timeout():
            job.status = CrawlJobStatus.TIMEOUT
            job.error_message = "Scan timeout: adapters did not complete within 120 seconds."
        elif len(summary["errors"]) > 0 and len(summary["adapters_ready"]) > 0 and len(summary["errors"]) == len(summary["adapters_ready"]):
            job.status = CrawlJobStatus.FAILED
            job.error_message = "All adapters failed: " + "; ".join(summary["errors"])
        elif len(summary["errors"]) > 0:
            job.status = CrawlJobStatus.PARTIAL_FAILED
        elif summary["new_mentions_created"] == 0 and summary["duplicates_skipped"] == 0:
            job.status = CrawlJobStatus.COMPLETED_NO_RESULTS
        else:
            job.status = CrawlJobStatus.COMPLETED
            
        db.commit()
    except Exception as e:
        if 'job' in locals() and job:
            job.status = CrawlJobStatus.FAILED
            job.error_message = str(e)
            try:
                db.commit()
            except:
                db.rollback()
    finally:
        db.close()



def crawl_source(source: Source, keyword_texts: List[str], keywords: List[Keyword], db: Session) -> List[dict]:
    """Crawl a source and extract mentions matching keywords"""
    mentions = []
    
    try:
        # Check if already marked invalid_rss_feed
        if source.last_error and source.last_error.startswith("invalid_rss_feed"):
            raise ValueError(source.last_error)

        is_rss = source.source_type == 'rss'
        
        # Try RSS first
        if is_rss:
            from app.services.crawl_service import validate_rss_feed
            is_rss_valid, error_code, error_msg = validate_rss_feed(source.url)
            if not is_rss_valid:
                source.last_error = f"{error_code}: {error_msg}"
                source.error_count = (source.error_count or 0) + 1
                db.commit()
                raise ValueError(f"{error_code}: {error_msg}")

            feed = feedparser.parse(source.url)
            if feed.bozo and not feed.entries:
                error_msg = str(feed.bozo_exception) if hasattr(feed, 'bozo_exception') else "XML không hợp lệ"
                raise ValueError(f"rss_fetch_failed: Lấy dữ liệu RSS feed thất bại: {error_msg}")

            for entry in feed.entries[:20]:  # Limit to 20 entries
                title = entry.get('title', '')
                content = entry.get('summary', '') or entry.get('description', '')
                full_text = f"{title} {content}".lower()
                import unicodedata
                full_text_norm = unicodedata.normalize('NFC', full_text)
                
                # Check if any keyword matches
                matched = []
                for i, kw_text in enumerate(keyword_texts):
                    kw_norm = unicodedata.normalize('NFC', kw_text.lower())
                    if kw_norm in full_text_norm:
                        matched.append({
                            'keyword_id': keywords[i].id,
                            'keyword': keywords[i].keyword
                        })
                
                if matched:
                    mentions.append({
                        'title': title,
                        'content': content[:5000],  # Limit content length
                        'url': entry.get('link', source.url),
                        'author': entry.get('author'),
                        'published_at': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') and entry.published_parsed else None,
                        'matched_keywords': matched
                    })
        
        # Try regular web scraping
        else:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            try:
                response = requests.get(source.url, headers=headers, timeout=30)
                response.raise_for_status()
            except requests.exceptions.Timeout:
                raise ValueError("timeout: Kết nối hết hạn (timeout). Vui lòng thử lại sau.")
            except Exception as e:
                raise ValueError(f"website_fetch_failed: Lấy dữ liệu trang web thất bại: {str(e)}")
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            text_lower = text.lower()
            
            # Check if any keyword matches
            matched = []
            for i, kw_text in enumerate(keyword_texts):
                if kw_text in text_lower:
                    matched.append({
                        'keyword_id': keywords[i].id,
                        'keyword': keywords[i].keyword
                    })
            
            if matched:
                # Try to extract title
                title = soup.find('title')
                title_text = title.string if title else source.name
                
                mentions.append({
                    'title': title_text,
                    'content': text[:5000],  # Limit content length
                    'url': source.url,
                    'author': None,
                    'published_at': datetime.now(timezone.utc),
                    'matched_keywords': matched
                })
    
    except Exception as e:
        print(f"Error crawling {source.url}: {str(e)}")
        raise
    
    return mentions


@router.get("/scan-history")
def get_scan_history(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get scan history (recent mentions)"""
    from math import ceil
    
    total = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)).scalar() or 0
    
    offset = (page - 1) * page_size
    mentions = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user)
        .order_by(Mention.collected_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()
    
    return {
        "items": [
            {
                "id": m.id,
                "title": m.title,
                "url": m.url,
                "source_id": m.source_id,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                "matched_keywords": m.matched_keywords
            }
            for m in mentions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 1
    }


@router.get("/scheduler/status")
def get_scheduler_status_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    """Get background scheduler status"""
    from app.services.scheduler_service import get_scheduler_status
    return get_scheduler_status()


@router.get("/worker-status")
def get_worker_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive worker status for the frontend"""
    from app.services.scheduler_service import get_worker_status
    return get_worker_status(db)


@router.get("/jobs")
def get_crawl_jobs(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get crawl job history"""
    from math import ceil
    
    query = select(CrawlJob)
    
    if status:
        query = query.where(CrawlJob.status == status)
    
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
    
    offset = (page - 1) * page_size
    jobs = db.execute(
        query.order_by(CrawlJob.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()
    
    return {
        "items": [
            {
                "id": j.id,
                "job_type": j.job_type,
                "source_ids": j.source_ids,
                "keyword_group_ids": j.keyword_group_ids,
                "status": j.status.value if hasattr(j.status, 'value') else j.status,
                "total_sources": j.total_sources or 0,
                "processed_sources": j.processed_sources or 0,
                "mentions_found": j.mentions_found or 0,
                "error_message": j.error_message,
                "project_id": (j.meta_data or {}).get("project_id"),
                "retry_count": j.retry_count or 0,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "metadata": j.meta_data or {}
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 1
    }



@router.get("/jobs/{job_id}")
def get_crawl_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    meta = job.meta_data or {}
    
    return {
        "job_id": job.id,
        "status": job.status.value if hasattr(job.status, 'value') else job.status,
        "project_id": meta.get("project_id"),
        "keywords": meta.get("keywords", []),
        "summary": meta.get("summary", {})
    }

@router.post("/jobs/{job_id}/retry")
def retry_crawl_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retry a failed crawl job"""
    job = db.execute(
        select(CrawlJob).where(CrawlJob.id == job_id)
    ).scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in (CrawlJobStatus.FAILED, CrawlJobStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Chỉ có thể retry job đã thất bại hoặc bị hủy")

    # Create a new job based on the old one
    new_job = CrawlJob(
        source_ids=job.source_ids,
        keyword_group_ids=job.keyword_group_ids,
        job_type='retry',
        status=CrawlJobStatus.PENDING,
        total_sources=job.total_sources,
        processed_sources=0,
        mentions_found=0,
        retry_count=(job.retry_count or 0) + 1,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Run the scan for each source
    if new_job.source_ids:
        new_job.status = CrawlJobStatus.RUNNING
        new_job.started_at = datetime.now(timezone.utc)
        db.commit()

        from app.services.crawl_service import crawl_source as service_crawl_source
        total_new = 0
        errors = []

        for source_id in new_job.source_ids:
            try:
                result = service_crawl_source(db, source_id, job_id=new_job.id)
                total_new += result.get('mentions_new', 0)
                new_job.processed_sources = (new_job.processed_sources or 0) + 1
            except Exception as e:
                errors.append(f"Source {source_id}: {str(e)}")
                new_job.processed_sources = (new_job.processed_sources or 0) + 1

        new_job.mentions_found = total_new
        new_job.completed_at = datetime.now(timezone.utc)
        if errors:
            new_job.status = CrawlJobStatus.FAILED
            new_job.error_message = "; ".join(errors)[:2000]
        else:
            new_job.status = CrawlJobStatus.COMPLETED
        db.commit()

    return {
        "success": True,
        "new_job_id": new_job.id,
        "status": new_job.status.value if hasattr(new_job.status, 'value') else new_job.status,
        "mentions_found": new_job.mentions_found or 0
    }


@router.post("/test-feed")
def test_rss_feed(
    url: str,
    current_user: User = Depends(get_current_active_user)
):
    """Test an RSS feed URL without saving anything"""
    from app.services.crawl_service import test_rss_feed as test_feed
    return test_feed(url)


@router.post("/debug/test-crawl")
async def test_crawl(
    keyword: str,
    platform: str = "web",
    limit: int = 5,
    db: Session = Depends(get_db)
):
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.services.social_crawler_service import social_crawler_service
        from app.services.social_crawl_job import _persist_mentions
        
        raw = await social_crawler_service.crawl_keywords([keyword], [platform])
        # Note: crawl_keywords in social_crawler_service.py doesn't seem to take `limit`, so I omitted it
        
        logger.info(f"[DEBUG] Raw results from crawler: {len(raw)}")
        
        success_count, error_count, errors, created = _persist_mentions(db, raw)
        
        return {
            "raw_count": len(raw),
            "inserted": success_count,
            "failed": error_count,
            "errors": errors[:10]
        }
    except Exception as e:
        logger.error(f"[DEBUG] test-crawl failed: {e}")
        return { "error": str(e) }
