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

def run_manual_scan_task(job_id: int, source_ids: List[int], keyword_texts: List[str], keyword_ids: List[int]):
    db = SessionLocal()
    try:
        job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
        if not job:
            return

        sources_to_scan = db.execute(select(Source).where(Source.id.in_(source_ids))).scalars().all()
        all_keywords = db.execute(select(Keyword).where(Keyword.id.in_(keyword_ids))).scalars().all()

        # Get project_id from the first keyword's group (since keywords are project-specific)
        project_id = None
        if all_keywords:
            first_keyword = all_keywords[0]
            project_id = first_keyword.group_id  # In Nope, keyword groups act as projects

        total_mentions = 0

        for source in sources_to_scan:
            try:
                mentions = crawl_source(source, keyword_texts, all_keywords, db)

                for mention_data in mentions:
                    content_hash = hashlib.sha256(mention_data['content'].encode()).hexdigest()
                    existing = db.execute(select(Mention).where(Mention.content_hash == content_hash)).scalar_one_or_none()
                    if existing:
                        continue

                    mention = Mention(
                        project_id=project_id,  # Set project_id from keyword group
                        job_id=job.id,
                        source_id=source.id,
                        title=mention_data.get('title'),
                        content=mention_data['content'],
                        content_hash=content_hash,
                        url=mention_data['url'],
                        author=mention_data.get('author'),
                        published_at=mention_data.get('published_at'),
                        matched_keywords=mention_data.get('matched_keywords', [])
                    )
                    db.add(mention)
                    db.commit()
                    db.refresh(mention)
                    
                    # Use common AI abstraction instead of forcing dummy
                    from app.core.config import settings
                    ai_provider = settings.AI_PROVIDER.lower()
                    model_version = "gpt-4" if ai_provider == "openai" else ("gemini-pro" if ai_provider == "gemini" else "keyword-v1.0")

                    try:
                        analysis_result = analyze_mention(mention.content, mention.title)
                        ai_analysis = AIAnalysis(
                            mention_id=mention.id,
                            sentiment=analysis_result['sentiment'],
                            risk_score=analysis_result['risk_score'],
                            crisis_level=analysis_result['crisis_level'],
                            summary_vi=analysis_result['summary_vi'],
                            suggested_action=analysis_result['suggested_action'],
                            responsible_department=analysis_result['responsible_department'],
                            confidence_score=analysis_result['confidence_score'],
                            ai_provider=ai_provider,
                            model_version=model_version,
                            processing_time_ms=analysis_result['processing_time_ms']
                        )
                        db.add(ai_analysis)
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        err_str = str(e)
                        if "ai_provider_not_configured" in err_str or "openai_dependency_missing" in err_str or "API key is missing" in err_str or "not configured" in err_str:
                            msg = "AI chưa cấu hình, mention đã được lưu nhưng chưa phân tích AI."
                            prov = "skipped"
                        else:
                            msg = f"Lỗi phân tích AI: {err_str}"
                            prov = "failed"
                        
                        ai_analysis = AIAnalysis(
                            mention_id=mention.id,
                            sentiment="neutral",
                            risk_score=0.0,
                            crisis_level=1,
                            summary_vi=msg,
                            suggested_action="monitor",
                            responsible_department="customer_service",
                            confidence_score=0.0,
                            ai_provider=prov,
                            model_version=model_version,
                            processing_time_ms=0
                        )
                        db.add(ai_analysis)
                        db.commit()
                        analysis_result = {'risk_score': 0}
                    
                    if analysis_result['risk_score'] >= 70:
                        severity = AlertSeverity.CRITICAL if analysis_result['risk_score'] >= 85 else AlertSeverity.HIGH
                        alert = Alert(
                            mention_id=mention.id,
                            severity=severity,
                            status=AlertStatus.NEW,
                            title=f"High risk mention detected: {mention.title or 'No title'}",
                            message=f"Risk score: {analysis_result['risk_score']}, Crisis level: {analysis_result['crisis_level']}"
                        )
                        db.add(alert)
                        db.commit()
                    
                    total_mentions += 1
                
                source.last_crawled_at = datetime.now(timezone.utc)
                source.last_success_at = datetime.now(timezone.utc)
                source.crawl_count = (source.crawl_count or 0) + 1
                source.last_error = None
                source.error_count = 0
                job.processed_sources = (job.processed_sources or 0) + 1
                db.commit()
                
            except Exception as e:
                source.last_error = str(e)
                source.error_count = (source.error_count or 0) + 1
                job.processed_sources = (job.processed_sources or 0) + 1
                db.commit()
                continue
        
        job.status = CrawlJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.mentions_found = total_mentions
        db.commit()
        
    finally:
        db.close()

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
            language="vi",
            country="vn",
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
    Manual scan: User selects keyword groups and either:
    - Selects existing sources, OR
    - Enters a custom URL to scan
    """
    
    keyword_groups = []
    if body.keyword_group_ids:
        keyword_groups = db.execute(
            select(KeywordGroup).where(KeywordGroup.id.in_(body.keyword_group_ids))
        ).scalars().all()

    all_keywords = []
    for group in keyword_groups:
        keywords_in_group = db.execute(
            select(Keyword).where(Keyword.group_id == group.id, Keyword.is_active == True)
        ).scalars().all()
        all_keywords.extend(keywords_in_group)

    keyword_texts = [kw.keyword.lower() for kw in all_keywords]
    keyword_ids = [kw.id for kw in all_keywords]

    if body.keywords:
        for kw in body.keywords:
            kw_lower = kw.lower().strip()
            if kw_lower and kw_lower not in keyword_texts:
                keyword_texts.append(kw_lower)

    if not keyword_texts:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp ít nhất một từ khóa (qua keyword_group_ids hoặc keywords)")

    mode = getattr(body, "mode", "HYBRID") or "HYBRID"
    run_discovery = mode in ("AUTO_DISCOVERY", "HYBRID")

    if run_discovery:
        from app.core.config import settings
        if not settings.SERPAPI_API_KEY:
            if mode == "AUTO_DISCOVERY":
                raise HTTPException(status_code=400, detail="CONFIG_REQUIRED: Chưa cấu hình Web Search provider (SerpAPI).")
            else:
                run_discovery = False

    sources_to_scan = []

    if body.url:
        temp_source = Source(
            name=f"Manual scan: {body.url}",
            url=body.url,
            source_type="website",
            is_active=True
        )
        db.add(temp_source)
        db.commit()
        db.refresh(temp_source)
        sources_to_scan.append(temp_source)
    elif mode == "ALL_ACTIVE_SOURCES":
        sources_to_scan = db.execute(
            select(Source).where(
                Source.is_active == True,
                Source.source_type.in_([SourceType.WEBSITE, SourceType.RSS])
            )
        ).scalars().all()
    elif mode in ("SELECTED_SOURCES", "HYBRID") and body.source_ids:
        sources_to_scan = db.execute(
            select(Source).where(
                Source.id.in_(body.source_ids),
                Source.is_active == True,
                Source.source_type.in_([SourceType.WEBSITE, SourceType.RSS])
            )
        ).scalars().all()

    if not sources_to_scan and mode == "SELECTED_SOURCES":
        raise HTTPException(status_code=400, detail="Phải cung cấp source_ids cho chế độ SELECTED_SOURCES")

    if not sources_to_scan and not run_discovery and not body.url:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn hoạt động và không thể chạy Auto Discovery")

    job_id = None
    if sources_to_scan:
        source_ids = [s.id for s in sources_to_scan]
        job = CrawlJob(
            source_ids=source_ids,
            keyword_group_ids=body.keyword_group_ids,
            job_type='manual',
            status=CrawlJobStatus.RUNNING,
            total_sources=len(sources_to_scan),
            processed_sources=0,
            mentions_found=0,
            started_at=datetime.now(timezone.utc)
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
        background_tasks.add_task(run_manual_scan_task, job.id, source_ids, keyword_texts, keyword_ids)

    if run_discovery:
        from app.services.discovery_service import create_discovery_job
        request_data = {
            "keyword_group_id": body.keyword_group_ids[0] if body.keyword_group_ids else None,
            "keywords": keyword_texts,
        }
        discovery_job = create_discovery_job(db, current_user.id, request_data)
        db.commit()
        background_tasks.add_task(_run_discovery_bg, discovery_job.id)

    msg_parts = []
    if sources_to_scan:
        msg_parts.append(f"quét {len(sources_to_scan)} nguồn")
    if run_discovery:
        msg_parts.append("tìm nguồn mới (SerpAPI)")
        
    return {
        "success": True,
        "job_id": job_id,
        "status": "running",
        "sources_queued": len(sources_to_scan),
        "message": f"Đã khởi tạo scan: {' và '.join(msg_parts)}."
    }                



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
                
                # Check if any keyword matches
                matched = []
                for i, kw_text in enumerate(keyword_texts):
                    if kw_text in full_text:
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
    
    total = db.execute(select(func.count(Mention.id))).scalar() or 0
    
    offset = (page - 1) * page_size
    mentions = db.execute(
        select(Mention)
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
                "retry_count": j.retry_count or 0,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 1
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
