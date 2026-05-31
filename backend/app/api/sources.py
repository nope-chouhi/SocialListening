import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source, SourceGroup, SourceType, CrawlFrequency
from app.schemas.source import (
    SourceCreate, SourceUpdate, SourceResponse,
    SourceGroupCreate, SourceGroupUpdate, SourceGroupResponse, SourceGroupListResponse
)
from app.services.scheduler_service import calculate_next_crawl_time

logger = logging.getLogger(__name__)
router = APIRouter()


def _source_to_response(source: Source) -> SourceResponse:
    """Safely convert Source SQLAlchemy object to SourceResponse Pydantic model."""
    # Convert crawl_time (datetime.time) to "HH:MM" string if needed
    crawl_time_str = None
    if source.crawl_time is not None:
        try:
            crawl_time_str = source.crawl_time.strftime("%H:%M")
        except Exception:
            crawl_time_str = str(source.crawl_time)

    return SourceResponse(
        id=source.id,
        group_id=source.group_id,
        name=source.name,
        source_type=source.source_type,
        url=source.url,
        platform_id=source.platform_id,
        meta_data=source.meta_data,
        is_active=source.is_active,
        crawl_frequency=source.crawl_frequency,
        crawl_time=crawl_time_str,
        crawl_day_of_week=source.crawl_day_of_week,
        crawl_day_of_month=source.crawl_day_of_month,
        crawl_month=source.crawl_month,
        # Include schedule arrays
        schedule_hours=source.schedule_hours,
        schedule_days_of_week=source.schedule_days_of_week,
        schedule_days_of_month=source.schedule_days_of_month,
        schedule_months=source.schedule_months,
        next_crawl_at=source.next_crawl_at,
        last_crawled_at=source.last_crawled_at,
        last_success_at=source.last_success_at,
        last_error=source.last_error,
        crawl_count=source.crawl_count or 0,
        error_count=source.error_count or 0,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


# ─── Source Group Endpoints ───────────────────────────────────────────────────

@router.get("/groups", response_model=List[SourceGroupListResponse])
def list_source_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all source groups with source counts."""
    try:
        query = select(SourceGroup)
        if is_active is not None:
            query = query.where(SourceGroup.is_active == is_active)
        query = query.offset(skip).limit(limit).order_by(SourceGroup.created_at.desc())
        groups = db.execute(query).scalars().all()

        response = []
        for group in groups:
            count = db.execute(
                select(func.count(Source.id)).where(Source.group_id == group.id)
            ).scalar() or 0
            response.append(SourceGroupListResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                is_active=group.is_active,
                created_at=group.created_at,
                source_count=count,
            ))
        return response
    except Exception as e:
        logger.error(f"Error listing source groups: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tải nhóm nguồn: {str(e)}")


@router.post("/groups", response_model=SourceGroupResponse, status_code=status.HTTP_201_CREATED)
def create_source_group(
    group_data: SourceGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source group."""
    try:
        group = SourceGroup(**group_data.dict())
        db.add(group)
        db.commit()
        db.refresh(group)
        return SourceGroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            sources=[],
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating source group: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo nhóm nguồn: {str(e)}")


@router.get("/groups/{group_id}", response_model=SourceGroupResponse)
def get_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(select(SourceGroup).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    sources_in_group = db.execute(select(Source).where(Source.group_id == group_id)).scalars().all()
    return SourceGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        sources=[_source_to_response(s) for s in sources_in_group],
    )


@router.put("/groups/{group_id}", response_model=SourceGroupResponse)
def update_source_group(
    group_id: int,
    group_data: SourceGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(select(SourceGroup).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    for field, value in group_data.dict(exclude_unset=True).items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    sources_in_group = db.execute(select(Source).where(Source.group_id == group_id)).scalars().all()
    return SourceGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        sources=[_source_to_response(s) for s in sources_in_group],
    )


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    group = db.execute(select(SourceGroup).where(SourceGroup.id == group_id)).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")
    db.delete(group)
    db.commit()


# ─── Source Endpoints ─────────────────────────────────────────────────────────

@router.get("", response_model=List[SourceResponse])
def list_sources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    group_id: Optional[int] = None,
    source_type: Optional[SourceType] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all sources. Returns [] if none exist."""
    try:
        query = select(Source)
        if group_id is not None:
            query = query.where(Source.group_id == group_id)
        if source_type is not None:
            query = query.where(Source.source_type == source_type)
        if is_active is not None:
            query = query.where(Source.is_active == is_active)
        query = query.offset(skip).limit(limit).order_by(Source.created_at.desc())
        sources = db.execute(query).scalars().all()
        return [_source_to_response(s) for s in sources]
    except Exception as e:
        logger.error(f"Error listing sources: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tải danh sách nguồn: {str(e)}")


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_source(
    source_data: SourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new source."""
    try:
        if source_data.group_id:
            group = db.execute(select(SourceGroup).where(SourceGroup.id == source_data.group_id)).scalar_one_or_none()
            if not group:
                raise HTTPException(status_code=404, detail="Source group not found")

        data = source_data.dict()

        # Parse crawl_time string → datetime.time for DB column
        crawl_time_obj = None
        if data.get('crawl_time'):
            try:
                from datetime import time as dtime
                parts = data['crawl_time'].split(':')
                crawl_time_obj = dtime(int(parts[0]), int(parts[1]))
            except Exception:
                crawl_time_obj = None
        data['crawl_time'] = crawl_time_obj

        # Calculate next crawl time
        from datetime import time as dtime
        data['next_crawl_at'] = calculate_next_crawl_time(
            frequency=data['crawl_frequency'],
            crawl_time=crawl_time_obj,
            crawl_day_of_week=data.get('crawl_day_of_week'),
            crawl_day_of_month=data.get('crawl_day_of_month'),
            crawl_month=data.get('crawl_month'),
        )

        # Check for duplicate URL
        existing = db.execute(select(Source).where(Source.url == data['url'])).scalars().first()
        if existing:
            raise HTTPException(status_code=409, detail="Nguồn với URL này đã tồn tại")

        # Validate if RSS
        if data.get('source_type') == 'rss':
            from app.services.crawl_service import validate_rss_feed
            is_rss_valid, error_code, error_msg = validate_rss_feed(data['url'])
            if not is_rss_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL này không phải RSS feed hợp lệ. Hãy đổi loại nguồn sang Website hoặc nhập link RSS hợp lệ."
                )

        source = Source(**data)
        db.add(source)
        db.commit()
        db.refresh(source)
        return _source_to_response(source)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating source: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo nguồn: {str(e)}")


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return _source_to_response(source)


@router.put("/{source_id}", response_model=SourceResponse)
def update_source(
    source_id: int,
    source_data: SourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        update_dict = source_data.dict(exclude_unset=True)

        # Parse crawl_time string if provided
        if 'crawl_time' in update_dict and update_dict['crawl_time']:
            try:
                from datetime import time as dtime
                parts = update_dict['crawl_time'].split(':')
                update_dict['crawl_time'] = dtime(int(parts[0]), int(parts[1]))
            except Exception:
                update_dict['crawl_time'] = None

        if 'url' in update_dict or 'source_type' in update_dict:
            final_type = update_dict.get('source_type', source.source_type)
            final_url = update_dict.get('url', source.url)
            if final_type == 'rss':
                from app.services.crawl_service import validate_rss_feed
                is_rss_valid, error_code, error_msg = validate_rss_feed(final_url)
                if not is_rss_valid:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="URL này không phải RSS feed hợp lệ. Hãy đổi loại nguồn sang Website hoặc nhập link RSS hợp lệ."
                    )
            # Clear error when URL or source type changes and passes validation
            source.last_error = None
            source.error_count = 0

        for field, value in update_dict.items():
            setattr(source, field, value)

        # Recalculate next crawl if schedule fields changed
        schedule_fields = {'crawl_frequency', 'crawl_time', 'crawl_day_of_week', 'crawl_day_of_month', 'crawl_month'}
        if update_dict.keys() & schedule_fields:
            source.next_crawl_at = calculate_next_crawl_time(
                frequency=source.crawl_frequency,
                crawl_time=source.crawl_time,
                crawl_day_of_week=source.crawl_day_of_week,
                crawl_day_of_month=source.crawl_day_of_month,
                crawl_month=source.crawl_month,
            )

        db.commit()
        db.refresh(source)
        return _source_to_response(source)
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating source: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật nguồn: {str(e)}")


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    source = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()


@router.post("/{source_id}/test")
def test_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Test if a source URL is reachable."""
    import httpx
    source = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        resp = httpx.get(source.url, timeout=10, follow_redirects=True)
        return {"success": True, "status_code": resp.status_code, "reachable": resp.status_code < 400, "url": source.url}
    except Exception as e:
        return {"success": False, "reachable": False, "error": str(e), "url": source.url}


@router.post("/{source_id}/scan")
def scan_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Trigger a manual scan on a specific source."""
    source = db.execute(select(Source).where(Source.id == source_id)).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    from app.models.keyword import Keyword
    from app.models.mention import Mention
    from app.api.crawl import crawl_source
    import hashlib
    from datetime import datetime

    all_keywords = db.execute(select(Keyword).where(Keyword.is_active == True)).scalars().all()
    if not all_keywords:
        return {"success": False, "message": "Không có từ khóa nào được kích hoạt"}

    keyword_texts = [kw.keyword.lower() for kw in all_keywords]
    try:
        mentions_data = crawl_source(source, keyword_texts, all_keywords, db)
        new_count = 0
        for mention_data in mentions_data:
            content_hash = hashlib.sha256(mention_data['content'].encode()).hexdigest()
            existing = db.execute(select(Mention).where(Mention.content_hash == content_hash)).scalar_one_or_none()
            if existing:
                continue
            mention = Mention(
                source_id=source.id,
                title=mention_data.get('title'),
                content=mention_data['content'],
                content_hash=content_hash,
                url=mention_data['url'],
                author=mention_data.get('author'),
                published_at=mention_data.get('published_at'),
                matched_keywords=mention_data.get('matched_keywords', []),
            )
            db.add(mention)
            db.commit()
            db.refresh(mention)
            new_count += 1

        source.last_crawled_at = datetime.utcnow()
        source.crawl_count = (source.crawl_count or 0) + 1
        db.commit()
        return {"success": True, "new_mentions": new_count, "source_id": source_id}
    except Exception as e:
        db.rollback()
        source.last_error = str(e)
        source.error_count = (source.error_count or 0) + 1
        db.commit()
        raise HTTPException(status_code=500, detail=f"Lỗi quét nguồn: {str(e)}")
