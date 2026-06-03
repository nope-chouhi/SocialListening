"""
Auto Discovery API routes for Nope.
Includes: Discovery jobs, Discovered sources, Connector status.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.tenant import apply_tenant_filter
from app.core.security import get_current_active_user
from app.core.config import settings
from app.models.user import User
from app.models.discovery import (
    DiscoveryJob, DiscoveryJobStatus,
    DiscoveredSource, DiscoveredSourceStatus,
    BlockedDomain, RecommendedMonitoringType,
)
from app.models.source import Source, SourceType
from app.schemas.discovery import (
    DiscoveryJobCreate, DiscoveryJobResponse, DiscoveryJobListResponse,
    DiscoveryJobStartResponse, DiscoveredSourceResponse, DiscoveredSourceListResponse,
    ApproveSourceRequest, BlockSourceRequest, ConnectorStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
#  DISCOVERY JOBS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/jobs", response_model=DiscoveryJobStartResponse)
def create_discovery_job(
    request: DiscoveryJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create and start an auto discovery job."""
    from app.services.discovery_service import create_discovery_job as create_job, run_discovery_job

    # Check if auto discovery is enabled
    if not settings.AUTO_DISCOVERY_ENABLED:
        raise HTTPException(status_code=400, detail="Auto Discovery chưa được bật.")

    # Create job
    job = create_job(db, current_user.id, request.dict())
    db.commit()

    # Run the job synchronously (no Celery)
    try:
        job = run_discovery_job(db, job.id)
    except Exception as e:
        logger.error(f"Discovery job {job.id} failed: {e}")
        job.status = DiscoveryJobStatus.FAILED
        job.error_message = "Lỗi hệ thống khi chạy tự động tìm nguồn."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    # Build message
    if job.status == DiscoveryJobStatus.COMPLETED:
        msg = job.error_message or f"Đã hoàn tất. Tìm thấy {job.urls_found} URL, tạo {job.mentions_created} mention, {job.candidate_sources_created or 0} nguồn mới."
    elif job.status == DiscoveryJobStatus.PARTIAL_FAILED:
        msg = job.error_message or f"Hoàn tất một phần. Tạo {job.mentions_created or 0} mention, {job.failed_items or 0} URL thất bại."
    elif job.status == DiscoveryJobStatus.FAILED:
        msg = job.error_message or "Tự động tìm nguồn thất bại."
    else:
        msg = job.error_message or "Đã tạo job tự động tìm nguồn. Hệ thống đang tìm và quét trong nền."

    return DiscoveryJobStartResponse(
        success=job.status in (DiscoveryJobStatus.COMPLETED, DiscoveryJobStatus.PARTIAL_FAILED),
        job_id=job.id,
        status=job.status.value if hasattr(job.status, 'value') else str(job.status),
        message=msg,
    )


@router.get("/jobs", response_model=DiscoveryJobListResponse)
def list_discovery_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List discovery jobs."""
    total = db.execute(apply_tenant_filter(select(func.count(DiscoveryJob.id)), DiscoveryJob, current_user, 'created_by_user_id')).scalar() or 0
    jobs = db.execute(
        apply_tenant_filter(select(DiscoveryJob), DiscoveryJob, current_user, 'created_by_user_id')
        .order_by(desc(DiscoveryJob.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return DiscoveryJobListResponse(
        items=[_job_to_response(j) for j in jobs],
        total=total,
    )


@router.get("/jobs/{job_id}", response_model=DiscoveryJobResponse)
def get_discovery_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get discovery job detail."""
    job = db.scalars(apply_tenant_filter(select(DiscoveryJob).where(DiscoveryJob.id == job_id), DiscoveryJob, current_user, 'created_by_user_id')).first()
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job.")
    return _job_to_response(job)


def _job_to_response(job: DiscoveryJob) -> DiscoveryJobResponse:
    """Convert ORM to response schema."""
    return DiscoveryJobResponse(
        id=job.id,
        project_id=job.project_id,
        keyword_group_id=job.keyword_group_id,
        status=job.status.value if hasattr(job.status, 'value') else str(job.status),
        query_keywords=job.query_keywords,
        exclude_keywords=job.exclude_keywords,
        language=job.language or "vi",
        country=job.country or "vn",
        date_range=job.date_range or "last_30_days",
        limit=job.limit or 20,
        providers_used_json=job.providers_used_json,
        urls_found=job.urls_found or 0,
        pages_scanned=job.pages_scanned or 0,
        mentions_created=job.mentions_created or 0,
        candidate_sources_created=job.candidate_sources_created or 0,
        candidate_sources_updated=job.candidate_sources_updated or 0,
        rss_feeds_detected=job.rss_feeds_detected or 0,
        valid_rss_feeds=job.valid_rss_feeds or 0,
        duplicates_skipped=job.duplicates_skipped or 0,
        blocked_domains_skipped=job.blocked_domains_skipped or 0,
        failed_items=job.failed_items or 0,
        error_message=job.error_message,
        created_by_user_id=job.created_by_user_id,
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  DISCOVERED SOURCES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/sources", response_model=DiscoveredSourceListResponse)
def list_discovered_sources(
    status: str = Query(None),
    domain: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List discovered sources with optional filtering."""
    query = select(DiscoveredSource)

    if status:
        query = query.where(DiscoveredSource.status == status)
    if domain:
        query = query.where(DiscoveredSource.domain.ilike(f"%{domain}%"))

    total = db.execute(
        select(func.count(DiscoveredSource.id)).where(
            *([DiscoveredSource.status == status] if status else []),
            *([DiscoveredSource.domain.ilike(f"%{domain}%")] if domain else []),
        )
    ).scalar() or 0

    sources = db.execute(
        query
        .order_by(desc(DiscoveredSource.relevance_score), desc(DiscoveredSource.last_seen_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return DiscoveredSourceListResponse(
        items=[_ds_to_response(s) for s in sources],
        total=total,
    )


@router.get("/sources/{source_id}", response_model=DiscoveredSourceResponse)
def get_discovered_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get discovered source detail."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")
    return _ds_to_response(ds)


@router.post("/sources/{source_id}/approve-rss")
def approve_source_as_rss(
    source_id: int,
    body: ApproveSourceRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Approve a discovered source as RSS Feed → create active Source."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")

    if not ds.rss_valid or not ds.rss_feed_url:
        raise HTTPException(status_code=400, detail="Nguồn chưa đủ điều kiện để thêm tự động. RSS chưa hợp lệ.")

    # Check duplicate active source
    existing = db.execute(
        select(Source).where(Source.url == ds.rss_feed_url)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Nguồn này đã tồn tại.")

    # Create active source
    source_name = (body.name if body and body.name else ds.source_name) or ds.domain
    new_source = Source(
        name=source_name[:500],
        source_type=SourceType.RSS,
        url=ds.rss_feed_url,
        is_active=True,
    )
    db.add(new_source)
    db.flush()

    ds.status = DiscoveredSourceStatus.APPROVED
    ds.approved_source_id = new_source.id
    db.commit()

    return {
        "success": True,
        "message": "Đã thêm nguồn RSS để theo dõi.",
        "source_id": new_source.id,
    }


@router.post("/sources/{source_id}/approve-website")
def approve_source_as_website(
    source_id: int,
    body: ApproveSourceRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Approve a discovered source as Website → create active Source."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")

    use_url = ds.homepage_url or ds.url or f"https://{ds.domain}/"

    # Check duplicate
    existing = db.execute(
        select(Source).where(Source.url == use_url)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Nguồn này đã tồn tại.")

    source_name = (body.name if body and body.name else ds.source_name) or ds.domain
    new_source = Source(
        name=source_name[:500],
        source_type=SourceType.WEBSITE,
        url=use_url,
        is_active=True,
    )
    db.add(new_source)
    db.flush()

    ds.status = DiscoveredSourceStatus.APPROVED
    ds.approved_source_id = new_source.id
    db.commit()

    return {
        "success": True,
        "message": "Đã thêm nguồn Website để theo dõi.",
        "source_id": new_source.id,
    }


@router.post("/sources/{source_id}/reject")
def reject_discovered_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Reject a discovered source."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")

    ds.status = DiscoveredSourceStatus.REJECTED
    db.commit()

    return {"success": True, "message": "Đã từ chối nguồn."}


@router.post("/sources/{source_id}/block")
def block_discovered_source(
    source_id: int,
    body: BlockSourceRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Block a discovered source domain."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")

    reason = body.reason if body else None

    ds.status = DiscoveredSourceStatus.BLOCKED
    ds.blocked_reason = reason or "Domain đã bị chặn bởi người dùng."

    # Also block all other discovered sources from same domain
    other_ds = db.execute(
        select(DiscoveredSource).where(
            DiscoveredSource.domain == ds.domain,
            DiscoveredSource.id != ds.id,
            DiscoveredSource.status == DiscoveredSourceStatus.CANDIDATE,
        )
    ).scalars().all()
    for ods in other_ds:
        ods.status = DiscoveredSourceStatus.BLOCKED
        ods.blocked_reason = reason or "Domain đã bị chặn bởi người dùng."

    # Add to blocked domains table
    existing_block = db.execute(
        select(BlockedDomain).where(BlockedDomain.domain == ds.domain)
    ).scalar_one_or_none()
    if not existing_block:
        db.add(BlockedDomain(
            domain=ds.domain,
            reason=reason or "Người dùng chặn qua Discovered Sources.",
            blocked_by_user_id=current_user.id,
        ))

    db.commit()

    return {
        "success": True,
        "message": "Đã chặn domain. Các lần tự động tìm nguồn sau sẽ bỏ qua domain này.",
    }


@router.post("/sources/{source_id}/refresh-rss-discovery")
def refresh_rss_discovery(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Re-run RSS discovery for a discovered source."""
    ds = db.query(DiscoveredSource).get(source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Không tìm thấy nguồn.")

    try:
        from app.services.rss_discovery_service import discover_rss_feeds
        result = discover_rss_feeds(ds.domain)
        ds.rss_feed_url = result.get("rss_feed_url")
        ds.rss_valid = result.get("rss_valid", False)
        ds.rss_error = result.get("rss_error")
        ds.rss_last_checked_at = datetime.now(timezone.utc)

        if ds.rss_valid:
            ds.recommended_monitoring_type = RecommendedMonitoringType.RSS
        db.commit()

        return {
            "success": True,
            "rss_valid": ds.rss_valid,
            "rss_feed_url": ds.rss_feed_url,
            "rss_error": ds.rss_error,
            "message": "Đã phát hiện RSS hợp lệ." if ds.rss_valid else (ds.rss_error or "Không tìm thấy RSS hợp lệ."),
        }
    except Exception as e:
        logger.error(f"RSS refresh failed for {ds.domain}: {e}")
        return {
            "success": False,
            "rss_valid": False,
            "message": "Không thể kiểm tra RSS.",
        }


def _ds_to_response(ds: DiscoveredSource) -> DiscoveredSourceResponse:
    """Convert ORM to response schema."""
    return DiscoveredSourceResponse(
        id=ds.id,
        project_id=ds.project_id,
        discovery_job_id=ds.discovery_job_id,
        source_name=ds.source_name,
        domain=ds.domain,
        homepage_url=ds.homepage_url,
        url=ds.url,
        source_type=ds.source_type,
        platform=ds.platform,
        recommended_monitoring_type=ds.recommended_monitoring_type.value if hasattr(ds.recommended_monitoring_type, 'value') else str(ds.recommended_monitoring_type) if ds.recommended_monitoring_type else None,
        rss_feed_url=ds.rss_feed_url,
        rss_valid=ds.rss_valid or False,
        rss_last_checked_at=ds.rss_last_checked_at,
        rss_error=ds.rss_error,
        sample_url=ds.sample_url,
        sample_mentions_count=ds.sample_mentions_count or 0,
        matched_keywords_json=ds.matched_keywords_json,
        relevance_score=ds.relevance_score or 0.0,
        relevance_reason=ds.relevance_reason,
        status=ds.status.value if hasattr(ds.status, 'value') else str(ds.status),
        blocked_reason=ds.blocked_reason,
        approved_source_id=ds.approved_source_id,
        first_seen_at=ds.first_seen_at,
        last_seen_at=ds.last_seen_at,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  CONNECTOR STATUS (Phase 7)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/connector-status")
def get_connector_status(
    current_user: User = Depends(get_current_active_user),
):
    """Get status of all platform connectors."""
    connectors = []

    # Website / RSS — always active
    connectors.append({
        "name": "Website / RSS",
        "key": "website_rss",
        "status": "active",
        "status_label": "Hoạt động",
        "description": "Thu thập từ trang web và RSS feed.",
    })

    # Web Search / SerpAPI
    serpapi_key = settings.SERPAPI_API_KEY
    if serpapi_key and serpapi_key.strip():
        connectors.append({
            "name": "Web Search / SerpAPI",
            "key": "serpapi",
            "status": "active",
            "status_label": "Hoạt động",
            "description": "Tìm kiếm nguồn tự động qua SerpAPI.",
        })
    else:
        connectors.append({
            "name": "Web Search / SerpAPI",
            "key": "serpapi",
            "status": "config_required",
            "status_label": "Chưa cấu hình",
            "description": "Cần cấu hình SERPAPI_API_KEY để sử dụng.",
        })

    # YouTube
    yt_key = settings.YOUTUBE_API_KEY
    if yt_key and yt_key.strip():
        from app.services.connectors.youtube_connector import YouTubeConnector
        yt_conn = YouTubeConnector()
        if yt_conn.validate_config():
            connectors.append({
                "name": "YouTube",
                "key": "youtube",
                "status": "active",
                "status_label": "Hoạt động",
                "description": "Kết nối qua YouTube Data API v3 chính thức.",
                "limitations": yt_conn.get_limitations()
            })
        else:
            connectors.append({
                "name": "YouTube",
                "key": "youtube",
                "status": "config_required",
                "status_label": "Cần API key",
                "description": "Cần cấu hình YOUTUBE_API_KEY.",
            })
    else:
        connectors.append({
            "name": "YouTube",
            "key": "youtube",
            "status": "config_required",
            "status_label": "Cần cấu hình",
            "description": "Chưa có YOUTUBE_API_KEY.",
        })

    # X / Twitter
    connectors.append({
        "name": "X / Twitter",
        "key": "twitter",
        "status": "config_required",
        "status_label": "Cần API key",
        "description": "Cần cấu hình Twitter/X API v2.",
    })

    # Reddit
    connectors.append({
        "name": "Reddit",
        "key": "reddit",
        "status": "config_required",
        "status_label": "Cần cấu hình API",
        "description": "Cần cấu hình Reddit API credentials.",
    })

    # Facebook / Instagram (Meta)
    from app.services.connectors.meta_connector import MetaConnector
    from app.models.integration import IntegrationAccount
    meta_conn = MetaConnector()
    
    if not meta_conn.validate_config():
        fb_status = "config_required"
        fb_label = "Cần cấu hình Meta App"
        fb_desc = "Cần thiết lập META_APP_ID và META_APP_SECRET."
    else:
        # Check if user has connected accounts
        fb_accounts = db.execute(
            select(IntegrationAccount).where(
                IntegrationAccount.user_id == current_user.id,
                IntegrationAccount.platform.in_(["facebook", "instagram"])
            )
        ).scalars().all()
        
        if fb_accounts:
            fb_status = "limited"
            fb_label = "Đã kết nối (Giới hạn)"
            fb_desc = "Meta chỉ cho phép đọc dữ liệu trong phạm vi tài khoản/Page/Instagram Business đã kết nối và các quyền được cấp. Hệ thống không quét toàn bộ Facebook/Instagram công khai."
        else:
            fb_status = "oauth_required"
            fb_label = "Cần kết nối tài khoản Meta"
            fb_desc = "Sử dụng luồng xác thực OAuth chính thức của Meta."

    connectors.append({
        "name": "Facebook",
        "key": "facebook",
        "status": fb_status,
        "status_label": fb_label,
        "description": fb_desc,
    })
    
    connectors.append({
        "name": "Instagram",
        "key": "instagram",
        "status": fb_status,
        "status_label": fb_label,
        "description": fb_desc,
    })

    # TikTok
    connectors.append({
        "name": "TikTok",
        "key": "tiktok",
        "status": "not_integrated",
        "status_label": "Chưa tích hợp",
        "description": "TikTok API chưa được tích hợp.",
    })

    # LinkedIn
    connectors.append({
        "name": "LinkedIn",
        "key": "linkedin",
        "status": "not_integrated",
        "status_label": "Chưa tích hợp",
        "description": "LinkedIn API chưa được tích hợp.",
    })

    return {"connectors": connectors}
