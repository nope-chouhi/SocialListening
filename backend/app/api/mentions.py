from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text, and_, or_, desc, asc, case
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import csv
import io

from app.core.database import get_db
from app.core.tenant import apply_tenant_filter
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.models.incident import Incident, IncidentStatus, IncidentLog
from app.services.ai_service import analyze_mention as service_analyze_mention
from app.services.notification_service import notify_high_risk_mention
import os
from math import ceil

import time
import json
import hashlib

_MENTIONS_SEARCH_CACHE = {}

router = APIRouter()


@router.get("/summary")
def get_mentions_summary(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get mentions summary for a project"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.models.mention import SentimentScore
        
        # Build base filter
        base_filter = [Mention.is_muted == False, Mention.is_deleted == False]
        if project_id:
            base_filter.append(Mention.project_id == project_id)
        
        # Total mentions
        try:
            total = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter))
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying total mentions: {e}")
            total = 0
        
        # Sentiment counts
        try:
            positive = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter, Mention.sentiment == 'positive'))
            ).scalar() or 0
            
            neutral = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter, Mention.sentiment == 'neutral'))
            ).scalar() or 0
            
            negative = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter, Mention.sentiment == 'negative'))
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying sentiment counts: {e}")
            positive = 0
            neutral = 0
            negative = 0
        
        # By source type
        try:
            source_type_counts = {}
            source_types = ['web', 'news', 'blog', 'rss', 'youtube', 'facebook', 'instagram', 'twitter', 'tiktok']
            for st in source_types:
                count = db.execute(
                    apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter, Mention.source_type == st))
                ).scalar() or 0
                if count > 0:
                    source_type_counts[st] = count
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying source type counts: {e}")
            source_type_counts = {}
        
        # By day (last 7 days)
        try:
            now = datetime.now(timezone.utc)
            by_day = []
            for i in range(7):
                day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                count = db.execute(
                    apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*base_filter, Mention.collected_at >= day_start, Mention.collected_at < day_end))
                ).scalar() or 0
                if count > 0:
                    by_day.append({
                        "date": day_start.strftime("%Y-%m-%d"),
                        "count": count
                    })
            by_day.reverse()
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying by_day counts: {e}")
            by_day = []
        
        return {
            "total": total,
            "positive": positive,
            "negative": negative,
            "neutral": neutral,
            "duplicate": 0,  # TODO: implement duplicate detection
            "by_day": by_day,
            "by_source_type": source_type_counts
        }
    except Exception as e:
        logger.error(f"Critical error in get_mentions_summary: {e}")
        return {
            "total": 0,
            "positive": 0,
            "negative": 0,
            "neutral": 0,
            "duplicate": 0,
            "by_day": [],
            "by_source_type": {}
        }


@router.get("")
def list_mentions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_id: Optional[int] = None,
    source_type: Optional[str] = None,
    source_types: Optional[List[str]] = Query(None),
    sentiment: Optional[str] = None,
    sentiments: Optional[List[str]] = Query(None),
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    search_query: Optional[str] = None,
    q: Optional[str] = Query(None),
    author: Optional[str] = None,
    domain: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    job_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    is_muted: Optional[bool] = Query(None),
    min_influence_score: Optional[float] = Query(None),
    sort_by: Optional[str] = Query("newest", pattern="^(newest|oldest|risk_high|risk_low|influence_high|engagement_high)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List mentions with filtering and pagination"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        # Cache implementation
        cache_key = None
        if q and not job_id:
            try:
                # Create a deterministic key based on search parameters
                params_str = f"{project_id}_{q}_{source_types}_{sentiment}_{date_from}_{date_to}_{page}_{page_size}_{sort_by}"
                cache_key = f"mentions_search:{hashlib.md5(params_str.encode()).hexdigest()}"
                
                # Check redis first
                try:
                    from app.core.config import settings
                    import redis
                    if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
                        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                        cached_val = r.get(cache_key)
                        if cached_val:
                            return json.loads(cached_val)
                except Exception:
                    pass
                
                # Fallback to in-memory cache
                if cache_key in _MENTIONS_SEARCH_CACHE:
                    timestamp, cached_val = _MENTIONS_SEARCH_CACHE[cache_key]
                    if time.time() - timestamp < 60: # 60 seconds TTL
                        return cached_val
            except Exception as e:
                logger.error(f"Cache check error: {e}")

        from sqlalchemy import or_
        from app.models.source import Source

        query = apply_tenant_filter(select(Mention), Mention, current_user)
        has_ai_filter = min_risk_score is not None
        need_source_join = bool(source_type or source_types or domain)
        need_ai_join = has_ai_filter or sort_by in ("risk_high", "risk_low")

        if source_id:
            query = query.where(Mention.source_id == source_id)
            
        if need_source_join:
            query = query.join(Source, Source.id == Mention.source_id)
            if source_type:
                st_list = [s.strip() for s in source_type.split(",")]
                query = query.where(Source.source_type.in_(st_list))
            elif source_types:
                query = query.where(Source.source_type.in_(source_types))
            if domain:
                query = query.where(Source.url.ilike(f"%{domain}%"))

        # Mentions filtering directly
        if project_id:
            query = query.where(Mention.project_id == project_id)
        if job_id:
            query = query.where(Mention.job_id == job_id)
        if keyword:
            query = query.where(Mention.keyword_text.ilike(f"%{keyword}%"))
        if is_muted is not None:
            query = query.where(Mention.is_muted == is_muted)
        else:
            query = query.where(Mention.is_muted == False)
        if min_influence_score is not None:
            query = query.where(Mention.influence_score >= min_influence_score)
        
        # In case source_type is directly on mention (new model)
        if source_type and not need_source_join:
            st_list = [s.strip() for s in source_type.split(",")]
            query = query.where(Mention.source_type.in_(st_list))
        elif source_types and not need_source_join:
            query = query.where(Mention.source_type.in_(source_types))
        if domain and not need_source_join:
            query = query.where(Mention.domain.ilike(f"%{domain}%"))
        if sentiment:
            sentiments_list = [s.strip() for s in sentiment.split(",")]
            query = query.where(Mention.sentiment.in_(sentiments_list))
        elif sentiments:
            query = query.where(Mention.sentiment.in_(sentiments))

        if author:
            query = query.where(Mention.author.ilike(f"%{author}%"))
            
        if date_from and not job_id:
            query = query.where(Mention.collected_at >= date_from)
            
        if date_to and not job_id:
            query = query.where(Mention.collected_at <= date_to)

        if search_query and not job_id:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Mention.title.ilike(search_pattern),
                    Mention.content.ilike(search_pattern),
                    Mention.author.ilike(search_pattern),
                    Mention.url.ilike(search_pattern)
                )
            )

        if q and not job_id:
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    Mention.title.ilike(search_term),
                    Mention.snippet.ilike(search_term),
                    Mention.content.ilike(search_term),
                    Mention.url.ilike(search_term),
                    Mention.domain.ilike(search_term),
                    Mention.keyword_text.ilike(search_term),
                )
            )

        if need_ai_join:
            if has_ai_filter:
                query = query.join(AIAnalysis, AIAnalysis.mention_id == Mention.id)
            else:
                query = query.outerjoin(AIAnalysis, AIAnalysis.mention_id == Mention.id)
                
            if min_risk_score is not None:
                query = query.where(AIAnalysis.risk_score >= min_risk_score)

        # Count query - build a separate simpler count query to avoid issues with complex joins
        try:
            # Build base count query with same filters but without joins for counting
            count_base = apply_tenant_filter(select(Mention), Mention, current_user)
            
            # Apply the same filters to count query
            if source_id:
                count_base = count_base.where(Mention.source_id == source_id)
            if project_id:
                count_base = count_base.where(Mention.project_id == project_id)
            if job_id:
                count_base = count_base.where(Mention.job_id == job_id)
            if keyword:
                count_base = count_base.where(Mention.keyword_text.ilike(f"%{keyword}%"))
            if is_muted is not None:
                count_base = count_base.where(Mention.is_muted == is_muted)
            else:
                count_base = count_base.where(Mention.is_muted == False)
            if min_influence_score is not None:
                count_base = count_base.where(Mention.influence_score >= min_influence_score)
            
            # Direct mention filters
            if source_type:
                st_list = [s.strip() for s in source_type.split(",")]
                count_base = count_base.where(Mention.source_type.in_(st_list))
            if source_types:
                count_base = count_base.where(Mention.source_type.in_(source_types))
            if domain:
                count_base = count_base.where(Mention.domain.ilike(f"%{domain}%"))
            if sentiment:
                sentiments_list = [s.strip() for s in sentiment.split(",")]
                count_base = count_base.where(Mention.sentiment.in_(sentiments_list))
            elif sentiments:
                count_base = count_base.where(Mention.sentiment.in_(sentiments))
            
            if author:
                count_base = count_base.where(Mention.author.ilike(f"%{author}%"))
            if date_from:
                count_base = count_base.where(Mention.collected_at >= date_from)
            if date_to:
                count_base = count_base.where(Mention.collected_at <= date_to)
            
            if search_query and not job_id:
                search_pattern = f"%{search_query}%"
                count_base = count_base.where(
                    or_(
                        Mention.title.ilike(search_pattern),
                        Mention.content.ilike(search_pattern),
                        Mention.author.ilike(search_pattern),
                        Mention.url.ilike(search_pattern)
                    )
                )

            if q and not job_id:
                search_term = f"%{q}%"
                count_base = count_base.where(
                    or_(
                        Mention.title.ilike(search_term),
                        Mention.snippet.ilike(search_term),
                        Mention.content.ilike(search_term),
                        Mention.url.ilike(search_term),
                        Mention.domain.ilike(search_term),
                        Mention.keyword_text.ilike(search_term),
                    )
                )
            
            # Execute count
            total = db.execute(select(func.count()).select_from(count_base.subquery())).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying total mentions count: {e}")
            # Fallback: try a simpler count without complex filters
            try:
                total = db.execute(
                    apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(Mention.is_muted == False)
                ).scalar() or 0
            except Exception as fallback_error:
                db.rollback()
                logger.error(f"Fallback count also failed: {fallback_error}")
                total = 0

        from sqlalchemy import nullslast
        offset = (page - 1) * page_size

        # Sorting
        if sort_by == "oldest":
            query = query.order_by(Mention.collected_at.asc(), Mention.id.asc())
        elif sort_by == "risk_high":
            query = query.order_by(nullslast(AIAnalysis.risk_score.desc()), Mention.id.desc())
        elif sort_by == "risk_low":
            query = query.order_by(nullslast(AIAnalysis.risk_score.asc()), Mention.id.asc())
        elif sort_by == "influence_high":
            query = query.order_by(nullslast(Mention.influence_score.desc()), Mention.id.desc())
        elif sort_by == "engagement_high":
            query = query.order_by(nullslast(Mention.collected_at.desc()), Mention.id.desc())
        else:
            query = query.order_by(nullslast(Mention.collected_at.desc()), Mention.id.desc())

        query = query.offset(offset).limit(page_size)

        try:
            mentions = db.execute(query).scalars().all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying mentions page: {e}")
            raise HTTPException(status_code=500, detail=f"Lỗi khi truy vấn dữ liệu mentions: {str(e)}")

        # Pre-load sources for this batch
        source_ids = list(set(m.source_id for m in mentions if m.source_id))
        sources_map = {}
        if source_ids:
            try:
                source_rows = db.execute(
                    select(Source).where(Source.id.in_(source_ids))
                ).scalars().all()
                sources_map = {s.id: s for s in source_rows}
            except Exception:
                pass

        result_items = []
        for m in mentions:
            try:
                analysis = db.execute(
                    select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                ).scalar_one_or_none()
            except Exception:
                analysis = None

            src = sources_map.get(m.source_id)

            result_items.append({
                "id": m.id,
                "project_id": m.project_id,
                "source_id": m.source_id,
                "job_id": m.job_id,
                "source_name": src.name if src else "Unknown",
                "source_type": m.source_type or (src.source_type.value if src and hasattr(src.source_type, 'value') else (src.source_type if src else "web")),
                "platform": m.platform,
                "domain": m.domain,
                "title": m.title or m.domain or m.url or "Không có tiêu đề",
                "content": m.content,
                "snippet": m.snippet or "Không có đoạn trích",
                "url": m.url,
                "sentiment": m.sentiment or (analysis.sentiment.value if analysis and hasattr(analysis.sentiment, 'value') else (analysis.sentiment if analysis else "neutral")),
                "sentiment_confidence": m.sentiment_confidence,
                "influence_score": m.influence_score,
                "tags_json": m.tags_json or [],
                "is_muted": m.is_muted,
                "add_to_report": m.add_to_report,
                "author": m.author or "Unknown",
                "published_at": m.published_at.isoformat() if m.published_at else (m.collected_at.isoformat() if m.collected_at else None),
                "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                "is_reviewed": m.is_reviewed,
                "matched_keywords": m.matched_keywords or [],
                "metadata": m.meta_data or {},
                "ai_analysis": {
                    "sentiment": analysis.sentiment.value if analysis and hasattr(analysis.sentiment, 'value') else (analysis.sentiment if analysis else None),
                    "risk_score": analysis.risk_score if analysis else None,
                    "crisis_level": analysis.crisis_level if analysis else None,
                    "summary_vi": analysis.summary_vi if analysis else None,
                    "suggested_action": analysis.suggested_action if analysis else None,
                    "ai_provider": analysis.ai_provider if analysis else None
                } if analysis else None
            })

        total_pages = ceil(total / page_size) if total > 0 else 1

        response_data = {
            "items": result_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
        
        if cache_key:
            try:
                # Save to redis
                try:
                    from app.core.config import settings
                    import redis
                    if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
                        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                        r.setex(cache_key, 60, json.dumps(response_data))
                except Exception:
                    pass
                
                # Save to in-memory cache
                _MENTIONS_SEARCH_CACHE[cache_key] = (time.time(), response_data)
            except Exception as e:
                logger.error(f"Cache set error: {e}")

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Critical error in list_mentions: {e}")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải danh sách mentions")


@router.get("/export")
def export_mentions_csv(
    sentiment: Optional[str] = None,
    source_type: Optional[str] = None,
    project_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(5000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Export mentions as CSV (Excel-compatible)."""
    query = apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.is_muted == False)
    if project_id:
        query = query.where(Mention.project_id == project_id)
    if sentiment:
        sentiments_list = [s.strip() for s in sentiment.split(",")]
        query = query.where(Mention.sentiment.in_(sentiments_list))
    if source_type:
        query = query.where(Mention.source_type == source_type)
    if keyword:
        query = query.where(Mention.keyword_text.ilike(f"%{keyword}%"))
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Mention.title.ilike(search_term),
                Mention.snippet.ilike(search_term),
                Mention.content.ilike(search_term),
                Mention.url.ilike(search_term),
                Mention.domain.ilike(search_term),
            )
        )
    if date_from:
        query = query.where(Mention.collected_at >= date_from)
    if date_to:
        query = query.where(Mention.collected_at <= date_to)

    query = query.order_by(Mention.collected_at.desc()).limit(limit)
    rows = db.execute(query).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "author", "platform", "source_type", "title", "content",
        "url", "sentiment", "reach", "interactions", "influence_score",
        "published_at", "collected_at", "keyword",
    ])

    for m in rows:
        interactions = (m.likes_count or 0) + (m.comments_count or 0) + (m.shares_count or 0)
        writer.writerow([
            m.id,
            m.author or "",
            m.platform or "",
            m.source_type or "",
            (m.title or "")[:500],
            (m.content or "")[:2000],
            m.url or "",
            m.sentiment or "",
            m.reach_estimate or 0,
            interactions,
            m.influence_score or 0,
            m.published_at.isoformat() if m.published_at else "",
            m.collected_at.isoformat() if m.collected_at else "",
            m.keyword_text or "",
        ])

    output.seek(0)
    filename = f"mentions_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{mention_id}")
def get_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a mention by ID with AI analysis"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    analysis = db.execute(
        select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)
    ).scalar_one_or_none()

    return {
        "id": mention.id,
        "source_id": mention.source_id,
        "title": mention.title,
        "content": mention.content,
        "url": mention.url,
        "author": mention.author,
        "published_at": mention.published_at.isoformat() if mention.published_at else None,
        "collected_at": mention.collected_at.isoformat() if mention.collected_at else None,
        "matched_keywords": mention.matched_keywords,
        "platform_post_id": mention.platform_post_id,
        "metadata": mention.meta_data,
        "ai_analysis": {
            "id": analysis.id,
            "sentiment": analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment,
            "risk_score": analysis.risk_score,
            "crisis_level": analysis.crisis_level,
            "summary_vi": analysis.summary_vi,
            "suggested_action": analysis.suggested_action,
            "responsible_department": analysis.responsible_department,
            "confidence_score": analysis.confidence_score,
            "ai_provider": analysis.ai_provider,
            "analyzed_at": analysis.analyzed_at.isoformat() if analysis.analyzed_at else None
        } if analysis else None
    }


@router.post("/{mention_id}/analyze")
def analyze_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Run AI analysis on a mention"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    # Check if analysis already exists
    existing = db.execute(
        select(AIAnalysis).where(AIAnalysis.mention_id == mention_id)
    ).scalar_one_or_none()

    try:
        analysis_result = service_analyze_mention(mention.content, mention.title)
    except Exception as e:
        err_str = str(e)
        if "ai_provider_not_configured" in err_str or "openai_dependency_missing" in err_str or "API key is missing" in err_str or "not configured" in err_str:
            raise HTTPException(
                status_code=400,
                detail="AI chưa cấu hình, mention đã được lưu nhưng chưa phân tích AI."
            )
        raise HTTPException(
            status_code=400,
            detail=f"Không thể thực hiện phân tích: {err_str}"
        )
    
    # Get AI provider name for tracking
    from app.core.config import settings
    ai_provider = settings.AI_PROVIDER.lower()
    model_version = "gpt-4" if ai_provider == "openai" else ("gemini-pro" if ai_provider == "gemini" else "keyword-v1.0")

    if existing:
        # Update existing analysis
        existing.sentiment = analysis_result['sentiment']
        existing.risk_score = analysis_result['risk_score']
        existing.crisis_level = analysis_result['crisis_level']
        existing.summary_vi = analysis_result['summary_vi']
        existing.suggested_action = analysis_result['suggested_action']
        existing.responsible_department = analysis_result['responsible_department']
        existing.confidence_score = analysis_result['confidence_score']
        existing.processing_time_ms = analysis_result['processing_time_ms']
        existing.ai_provider = ai_provider
        existing.model_version = model_version
        db.commit()
        db.refresh(existing)
        analysis = existing
    else:
        analysis = AIAnalysis(
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
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
    
    # Send notification if high risk
    if analysis_result['risk_score'] >= 70:
        try:
            notify_high_risk_mention(db, mention_id, analysis_result)
        except Exception as e:
            print(f"Failed to send notification: {e}")

    return {
        "mention_id": mention_id,
        "sentiment": analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment,
        "risk_score": analysis.risk_score,
        "crisis_level": analysis.crisis_level,
        "summary_vi": analysis.summary_vi,
        "suggested_action": analysis.suggested_action,
        "responsible_department": analysis.responsible_department,
        "confidence_score": analysis.confidence_score
    }


@router.post("/{mention_id}/create-alert", status_code=201)
def create_alert_from_mention(
    mention_id: int,
    title: Optional[str] = None,
    severity: Optional[str] = "high",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create an alert from a mention"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    # Get analysis for auto-severity
    analysis = db.execute(
        select(AIAnalysis).where(AIAnalysis.mention_id == mention_id)
    ).scalar_one_or_none()

    if not severity and analysis:
        if analysis.risk_score >= 85:
            severity = "critical"
        elif analysis.risk_score >= 70:
            severity = "high"
        elif analysis.risk_score >= 50:
            severity = "medium"
        else:
            severity = "low"

    alert_title = title or f"Alert từ mention: {mention.title or mention.url}"
    message = None
    if analysis:
        message = f"Risk score: {analysis.risk_score}, Crisis level: {analysis.crisis_level}"

    alert = Alert(
        mention_id=mention_id,
        title=alert_title,
        severity=severity or "high",
        message=message,
        status=AlertStatus.NEW
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "mention_id": alert.mention_id,
        "title": alert.title,
        "severity": alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
        "status": alert.status.value if hasattr(alert.status, 'value') else alert.status,
        "created_at": alert.created_at.isoformat() if alert.created_at else None
    }


@router.post("/{mention_id}/create-incident", status_code=201)
def create_incident_from_mention(
    mention_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create an incident from a mention"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    incident_title = title or f"Sự cố từ mention: {mention.title or mention.url}"
    incident = Incident(
        mention_id=mention_id,
        owner_id=current_user.id,
        title=incident_title,
        description=description or f"Sự cố được tạo từ mention: {mention.url}",
        status=IncidentStatus.NEW
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    log = IncidentLog(
        incident_id=incident.id,
        user_id=current_user.id,
        action="created",
        new_status=incident.status.value,
        notes=f"Sự cố được tạo từ mention #{mention_id}"
    )
    db.add(log)
    db.commit()

    return {
        "id": incident.id,
        "mention_id": incident.mention_id,
        "title": incident.title,
        "status": incident.status.value,
        "created_at": incident.created_at.isoformat() if incident.created_at else None
    }


@router.post("/{mention_id}/mark-reviewed")
def mark_mention_reviewed(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a mention as reviewed"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    mention.is_reviewed = True
    db.commit()
    db.refresh(mention)

    return {
        "id": mention.id,
        "is_reviewed": mention.is_reviewed
    }


@router.delete("/{mention_id}", status_code=204)
def delete_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a mention"""
    mention = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    db.delete(mention)
    db.commit()


class UpdateTagsRequest(BaseModel):
    tags: list[str]

@router.put("/{mention_id}/tags")
def update_mention_tags(
    mention_id: int,
    req: UpdateTagsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mention = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)).scalar_one_or_none()
    if not mention: raise HTTPException(status_code=404, detail="Mention not found")
    mention.tags_json = req.tags
    db.commit()
    db.refresh(mention)
    return {"id": mention.id, "tags": mention.tags_json}


class UpdateAddToReportRequest(BaseModel):
    add_to_report: bool


@router.put("/{mention_id}/add-to-report")
def update_mention_add_to_report(
    mention_id: int,
    req: UpdateAddToReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle add_to_report flag for a mention"""
    mention = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)).scalar_one_or_none()
    if not mention: raise HTTPException(status_code=404, detail="Mention not found")
    mention.add_to_report = req.add_to_report
    db.commit()
    db.refresh(mention)
    return {"id": mention.id, "add_to_report": mention.add_to_report}


class SummarizeRequest(BaseModel):
    mention_ids: Optional[list[int]] = None
    filters: Optional[dict] = None  # Same filter structure as list_mentions
    project_id: Optional[int] = None


@router.post("/summarize")
def summarize_current_results(
    req: SummarizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate AI summary of current filtered results"""
    from app.services.ai_service import summarize_mentions_batch
    
    # Get mentions based on request
    if req.mention_ids:
        mentions = db.execute(
            apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id.in_(req.mention_ids))
        ).scalars().all()
    else:
        # Build query from filters
        query = apply_tenant_filter(select(Mention), Mention, current_user)
        filters = req.filters or {}
        
        if filters.get("project_id"):
            query = query.where(Mention.project_id == filters["project_id"])
        elif req.project_id:
            query = query.where(Mention.project_id == req.project_id)
        
        if filters.get("sentiment"):
            query = query.where(Mention.sentiment == filters["sentiment"])
        
        if filters.get("source_type"):
            query = query.where(Mention.source_type == filters["source_type"])
        
        if filters.get("date_from"):
            query = query.where(Mention.collected_at >= filters["date_from"])
        
        if filters.get("date_to"):
            query = query.where(Mention.collected_at <= filters["date_to"])
        
        query = query.where(Mention.is_muted == False).where(Mention.is_deleted == False)
        
        mentions = db.execute(query.limit(50)).scalars().all()
    
    if not mentions:
        return {
            "summary": "Không có mentions để tóm tắt.",
            "key_insights": [],
            "sentiment_breakdown": {},
            "total_mentions": 0
        }
    
    # Prepare mention data for AI
    mention_data = []
    for m in mentions:
        mention_data.append({
            "title": m.title,
            "content": m.content or m.snippet or "",
            "url": m.url,
            "sentiment": m.sentiment,
            "source_type": m.source_type,
            "domain": m.domain,
            "published_at": m.published_at.isoformat() if m.published_at else None
        })
    
    # Call AI service for summary
    try:
        summary_result = summarize_mentions_batch(mention_data)
        
        # Calculate sentiment breakdown
        sentiment_counts = {}
        for m in mentions:
            sent = m.sentiment or "unknown"
            sentiment_counts[sent] = sentiment_counts.get(sent, 0) + 1
        
        return {
            "summary": summary_result.get("summary", ""),
            "key_insights": summary_result.get("key_insights", []),
            "sentiment_breakdown": sentiment_counts,
            "total_mentions": len(mentions),
            "mention_ids": [m.id for m in mentions]
        }
    except Exception as e:
        # Fallback to simple summary if AI fails
        return {
            "summary": f"Tìm thấy {len(mentions)} mentions. Không thể tạo AI summary do lỗi: {str(e)}",
            "key_insights": [],
            "sentiment_breakdown": {},
            "total_mentions": len(mentions),
            "mention_ids": [m.id for m in mentions]
        }

class UpdateMuteRequest(BaseModel):
    is_muted: bool

@router.put("/{mention_id}/mute")
def update_mention_mute(
    mention_id: int,
    req: UpdateMuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mention = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)).scalar_one_or_none()
    if not mention: raise HTTPException(status_code=404, detail="Mention not found")
    mention.is_muted = req.is_muted
    db.commit()
    db.refresh(mention)
    return {"id": mention.id, "is_muted": mention.is_muted}

class UpdateSentimentRequest(BaseModel):
    sentiment: str

@router.put("/{mention_id}/sentiment")
def update_mention_sentiment(
    mention_id: int,
    req: UpdateSentimentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mention = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.id == mention_id)).scalar_one_or_none()
    if not mention: raise HTTPException(status_code=404, detail="Mention not found")
    mention.sentiment = req.sentiment
    mention.sentiment_confidence = 1.0  # manual override
    db.commit()
    db.refresh(mention)
    return {"id": mention.id, "sentiment": mention.sentiment}

class MuteDomainRequest(BaseModel):
    domain: str
    project_id: int

@router.post("/mute-domain")
def mute_domain(
    req: MuteDomainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mentions = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.project_id == req.project_id, Mention.domain == req.domain)).scalars().all()
    for m in mentions:
        m.is_muted = True
    db.commit()
    return {"status": "success", "muted_mentions": len(mentions), "domain": req.domain}

class MuteAuthorRequest(BaseModel):
    author: str
    project_id: int

@router.post("/mute-author")
def mute_author(
    req: MuteAuthorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mentions = db.execute(apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.project_id == req.project_id, Mention.author == req.author)).scalars().all()
    for m in mentions:
        m.is_muted = True
    db.commit()
    return {"status": "success", "muted_mentions": len(mentions), "author": req.author}
