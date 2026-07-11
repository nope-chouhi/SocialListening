from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.core.database import get_db
from app.core.tenant import apply_tenant_filter
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.incident import Incident, IncidentStatus
from app.models.source import Source
from app.models.keyword import Keyword, KeywordGroup

router = APIRouter()


def _normalize_trend_bucket_value(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            try:
                return datetime.combine(date.fromisoformat(normalized), datetime.min.time())
            except ValueError as exc:
                raise ValueError(f"Unsupported trend bucket value: {value!r}") from exc
    raise ValueError(f"Unsupported trend bucket value type: {type(value).__name__}")


from fastapi.concurrency import run_in_threadpool
from app.services.cache_service import cache_service

@router.get("/summary")
async def get_dashboard_summary(
    time_range: str = Query("30d", alias="range", pattern="^(today|7d|30d)$"),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard summary metrics (cached)"""
    import logging
    logger = logging.getLogger(__name__)
    
    cache_key = f"dashboard:summary:user:{current_user.id}:project:{project_id or 'all'}:range:{time_range}"
    
    # Try getting from cache
    try:
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            return cached_data
    except Exception as e:
        logger.warning(f"Cache get error: {e}")
        
    # Execute sync code in threadpool to avoid blocking event loop
    result = await run_in_threadpool(_get_dashboard_summary_sync, time_range, project_id, db, current_user)
    
    # Save to cache asynchronously without blocking
    try:
        await cache_service.set(cache_key, result)
    except Exception as e:
        logger.warning(f"Cache set error: {e}")
        
    return result

def _get_dashboard_summary_sync(
    time_range: str,
    project_id: Optional[int],
    db: Session,
    current_user: User
):
    """Get dashboard summary metrics"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.now(timezone.utc)
        if time_range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "7d":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=30)
            
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Total mentions
        try:
            base_query = apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)
            base_query = base_query.where(Mention.collected_at >= start_date)
            if project_id:
                base_query = base_query.where(Mention.project_id == project_id)
            total_mentions = db.execute(base_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying total mentions: {e}")
            total_mentions = 0
            
        try:
            base_query = apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(Mention.collected_at >= today_start)
            if project_id:
                base_query = base_query.where(Mention.project_id == project_id)
            mentions_today = db.execute(base_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying mentions today: {e}")
            mentions_today = 0
        
        # Negative mentions
        try:
            from app.models.mention import SentimentScore
            query = select(func.count(AIAnalysis.id)).join(Mention, AIAnalysis.mention_id == Mention.id)
            query = apply_tenant_filter(query, Mention, current_user)
            if project_id:
                query = query.where(Mention.project_id == project_id)
            
            negative_mentions = db.execute(
                query.where(
                    and_(
                        AIAnalysis.sentiment.in_(['negative']),
                        AIAnalysis.analyzed_at >= start_date
                    )
                )
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying negative mentions: {e}")
            negative_mentions = 0
        
        # Alerts
        try:
            alerts_query = apply_tenant_filter(select(func.count(Alert.id)), Alert, current_user).where(Alert.status != 'resolved')
            alerts_query = alerts_query.where(Alert.created_at >= start_date)
            total_alerts = db.execute(alerts_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying total alerts: {e}")
            total_alerts = 0
        
        # Incidents
        try:
            incidents_query = apply_tenant_filter(select(func.count(Incident.id)), Incident, current_user).where(Incident.status != 'closed')
            incidents_query = incidents_query.where(Incident.created_at >= start_date)
            total_incidents = db.execute(incidents_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying total incidents: {e}")
            total_incidents = 0
        
        # Sources
        try:
            sources_query = apply_tenant_filter(select(func.count(Source.id)), Source, current_user).where(Source.is_active == True)
            total_sources = db.execute(sources_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying active sources: {e}")
            total_sources = 0
        
        # Latest mentions with AI analysis
        latest_mentions_data = []
        try:
            latest_mentions_query = apply_tenant_filter(select(Mention), Mention, current_user)
            if project_id:
                latest_mentions_query = latest_mentions_query.where(Mention.project_id == project_id)
            latest_mentions_query = latest_mentions_query.order_by(Mention.collected_at.desc()).limit(10)
            latest_mentions = db.execute(latest_mentions_query).scalars().all()
            
            # Pre-fetch analysis and sources to avoid N+1
            mention_ids = [m.id for m in latest_mentions]
            source_ids = list(set([m.source_id for m in latest_mentions if m.source_id]))
            
            analyses_dict = {}
            if mention_ids:
                analyses = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))).scalars().all()
                for a in analyses:
                    analyses_dict[a.mention_id] = a
                    
            sources_dict = {}
            if source_ids:
                sources = db.execute(select(Source).where(Source.id.in_(source_ids))).scalars().all()
                for s in sources:
                    sources_dict[s.id] = s
            
            for m in latest_mentions:
                analysis = analyses_dict.get(m.id)
                source = sources_dict.get(m.source_id)
                
                latest_mentions_data.append({
                    "id": m.id,
                    "title": m.title,
                    "content": m.content[:200] if m.content else "",
                    "url": m.url,
                    "source_name": source.name if source else "Unknown",
                    "source_type": source.source_type if source else "website",
                    "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                    "matched_keywords": m.matched_keywords,
                    "sentiment": (analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment) if analysis else None,
                    "risk_score": analysis.risk_score if analysis else None,
                    "crisis_level": analysis.crisis_level if analysis else None,
                    "ai_provider": analysis.ai_provider if analysis else None,
                })
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying latest mentions: {e}")
            latest_mentions_data = []
        
        # Latest alerts
        latest_alerts_data = []
        try:
            latest_alerts_query = apply_tenant_filter(select(Alert), Alert, current_user).order_by(Alert.created_at.desc()).limit(10)
            latest_alerts = db.execute(latest_alerts_query).scalars().all()
            
            for a in latest_alerts:
                latest_alerts_data.append({
                    "id": a.id,
                    "title": a.title,
                    "mention_id": a.mention_id,
                    "severity": a.severity.value if hasattr(a.severity, 'value') else a.severity,
                    "status": a.status.value if hasattr(a.status, 'value') else a.status,
                    "message": a.message,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                })
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying latest alerts: {e}")
            latest_alerts_data = []
        # Discovery stats
        discovered_sources_count = 0
        candidate_sources_count = 0
        approved_sources_count = 0
        try:
            from app.models.discovery import DiscoveredSource, DiscoveredSourceStatus
            discovered_sources_count = db.execute(select(func.count(DiscoveredSource.id))).scalar() or 0
            candidate_sources_count = db.execute(
                select(func.count(DiscoveredSource.id)).where(DiscoveredSource.status == DiscoveredSourceStatus.CANDIDATE)
            ).scalar() or 0
            approved_sources_count = db.execute(
                select(func.count(DiscoveredSource.id)).where(DiscoveredSource.status == DiscoveredSourceStatus.APPROVED)
            ).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.warning(f"Discovery stats query failed (table may not exist yet): {e}")
            
        # AI failed count
        try:
            ai_failed_query = apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(
                and_(Mention.collected_at >= start_date, Mention.verification_status == "failed")
            )
            if project_id:
                ai_failed_query = ai_failed_query.where(Mention.project_id == project_id)
            ai_failed_count = db.execute(ai_failed_query).scalar() or 0
        except Exception as e:
            db.rollback()
            logger.error(f"Error querying ai failed count: {e}")
            ai_failed_count = 0
        
        return {
            "total_mentions": total_mentions,
            "mentions_today": mentions_today,
            "negative_mentions": negative_mentions,
            "alerts_count": total_alerts,
            "incidents_count": total_incidents,
            "active_sources": total_sources,
            "discovered_sources_count": discovered_sources_count,
            "candidate_sources_count": candidate_sources_count,
            "approved_sources_count": approved_sources_count,
            "ai_failed_count": ai_failed_count,
            "latest_mentions": latest_mentions_data,
            "latest_alerts": latest_alerts_data
        }
    except Exception as e:
        logger.error(f"Critical error in get_dashboard_summary: {e}")
        return {
            "total_mentions": 0,
            "mentions_today": 0,
            "negative_mentions": 0,
            "alerts_count": 0,
            "incidents_count": 0,
            "active_sources": 0,
            "discovered_sources_count": 0,
            "candidate_sources_count": 0,
            "approved_sources_count": 0,
            "ai_failed_count": 0,
            "latest_mentions": [],
            "latest_alerts": []
        }


@router.get("/latest-mentions")
def get_latest_mentions(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get latest mentions"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        latest_mentions_query = apply_tenant_filter(select(Mention), Mention, current_user).order_by(Mention.collected_at.desc()).limit(limit)
        latest_mentions = db.execute(latest_mentions_query).scalars().all()
        
        latest_mentions_data = []
        
        # Pre-fetch analysis and sources to avoid N+1
        mention_ids = [m.id for m in latest_mentions]
        source_ids = list(set([m.source_id for m in latest_mentions if m.source_id]))
        
        analyses_dict = {}
        if mention_ids:
            analyses = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))).scalars().all()
            for a in analyses:
                analyses_dict[a.mention_id] = a
                
        sources_dict = {}
        if source_ids:
            sources = db.execute(select(Source).where(Source.id.in_(source_ids))).scalars().all()
            for s in sources:
                sources_dict[s.id] = s
                
        for m in latest_mentions:
            analysis = analyses_dict.get(m.id)
            source = sources_dict.get(m.source_id)
            
            latest_mentions_data.append({
                "id": m.id,
                "title": m.title,
                "content": m.content[:200] if m.content else "",
                "url": m.url,
                "source_name": source.name if source else "Unknown",
                "source_type": source.source_type if source else "website",
                "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                "matched_keywords": m.matched_keywords,
                "sentiment": (analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment) if analysis else None,
                "risk_score": analysis.risk_score if analysis else None,
                "crisis_level": analysis.crisis_level if analysis else None,
                "ai_provider": analysis.ai_provider if analysis else None,
            })
        
        return {
            "items": latest_mentions_data
        }
    except Exception as e:
        logger.error(f"Error in get_latest_mentions: {e}")
        return {
            "items": []
        }


@router.get("/latest-alerts")
def get_latest_alerts(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get latest alerts"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        latest_alerts_query = apply_tenant_filter(select(Alert), Alert, current_user).order_by(Alert.created_at.desc()).limit(limit)
        latest_alerts = db.execute(latest_alerts_query).scalars().all()
        
        latest_alerts_data = []
        for a in latest_alerts:
            latest_alerts_data.append({
                "id": a.id,
                "title": a.title,
                "mention_id": a.mention_id,
                "severity": a.severity.value if hasattr(a.severity, 'value') else a.severity,
                "status": a.status.value if hasattr(a.status, 'value') else a.status,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })
        
        return {
            "items": latest_alerts_data
        }
    except Exception as e:
        logger.error(f"Error in get_latest_alerts: {e}")
        return {
            "items": []
        }


@router.get("/trends")
def get_dashboard_trends(
    time_range: str = Query("7d", alias="range", pattern="^(today|7d|30d|90d|180d)$"),
    granularity: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get trend data for charts"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.now(timezone.utc)
        
        if time_range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            days = 1
        elif time_range == "7d":
            start_date = now - timedelta(days=7)
            days = 7
        elif time_range == "90d":
            start_date = now - timedelta(days=90)
            days = 90
        elif time_range == "180d":
            start_date = now - timedelta(days=180)
            days = 180
        else:
            start_date = now - timedelta(days=30)
            days = 30
        
        # Build period buckets based on granularity
        items_dict = {}

        if granularity == "weekly":
            # Build week buckets (Sunday as anchor)
            from datetime import date
            week_start = start_date
            while week_start <= now:
                week_end = week_start + timedelta(days=7)
                bucket_key = week_start.strftime("%Y-W%U")
                items_dict[bucket_key] = {
                    "date": week_start.strftime("%d/%m"),
                    "date_key": bucket_key,
                    "total_mentions": 0,
                    "negative_mentions": 0,
                    "alerts": 0,
                    "incidents": 0
                }
                week_start = week_end
        elif granularity == "monthly":
            # Build month buckets
            cursor = start_date.replace(day=1)
            while cursor <= now:
                bucket_key = cursor.strftime("%Y-%m")
                items_dict[bucket_key] = {
                    "date": cursor.strftime("%b %Y"),
                    "date_key": bucket_key,
                    "total_mentions": 0,
                    "negative_mentions": 0,
                    "alerts": 0,
                    "incidents": 0
                }
                # Next month
                if cursor.month == 12:
                    cursor = cursor.replace(year=cursor.year + 1, month=1, day=1)
                else:
                    cursor = cursor.replace(month=cursor.month + 1, day=1)
        else:
            # daily
            for i in range(days):
                day_start = start_date + timedelta(days=i)
                date_str = day_start.strftime("%Y-%m-%d")
                items_dict[date_str] = {
                    "date": date_str,
                    "date_key": date_str,
                    "total_mentions": 0,
                    "negative_mentions": 0,
                    "alerts": 0,
                    "incidents": 0
                }

        def get_bucket_key(dt: datetime) -> Optional[str]:
            """Return the bucket key for a given datetime, based on granularity."""
            if granularity == "weekly":
                return dt.strftime("%Y-W%U")
            elif granularity == "monthly":
                return dt.strftime("%Y-%m")
            else:
                return dt.strftime("%Y-%m-%d")

        # 1. Total mentions by date
        try:
            date_col = func.date(Mention.collected_at)
            query = select(date_col.label("d"), func.count(Mention.id))
            query = apply_tenant_filter(query, Mention, current_user)
            query = query.where(Mention.collected_at >= start_date)
            if project_id:
                query = query.where(Mention.project_id == project_id)
            query = query.group_by(date_col)
            
            for row in db.execute(query):
                dt = _normalize_trend_bucket_value(row.d)
                if dt is None:
                    continue
                key = get_bucket_key(dt)
                if key in items_dict:
                    items_dict[key]["total_mentions"] += row[1]
        except Exception as e:
            db.rollback()
            logger.error(f"Error mentions trend: {e}")

        # 2. Negative mentions by date
        try:
            from app.models.mention import SentimentScore
            date_col = func.date(AIAnalysis.analyzed_at)
            query = select(date_col.label("d"), func.count(AIAnalysis.id)).join(Mention, AIAnalysis.mention_id == Mention.id)
            query = apply_tenant_filter(query, Mention, current_user)
            if project_id:
                query = query.where(Mention.project_id == project_id)
            
            query = query.where(
                and_(
                    AIAnalysis.analyzed_at >= start_date,
                    AIAnalysis.sentiment.in_(['negative'])
                )
            ).group_by(date_col)
            
            for row in db.execute(query):
                dt = _normalize_trend_bucket_value(row.d)
                if dt is None:
                    continue
                key = get_bucket_key(dt)
                if key in items_dict:
                    items_dict[key]["negative_mentions"] += row[1]
        except Exception as e:
            db.rollback()
            logger.error(f"Error negative mentions trend: {e}")

        # 3. Alerts by date
        try:
            date_col = func.date(Alert.created_at)
            query = select(date_col.label("d"), func.count(Alert.id))
            query = apply_tenant_filter(query, Alert, current_user)
            query = query.where(Alert.created_at >= start_date).group_by(date_col)
            
            for row in db.execute(query):
                dt = _normalize_trend_bucket_value(row.d)
                if dt is None:
                    continue
                key = get_bucket_key(dt)
                if key in items_dict:
                    items_dict[key]["alerts"] += row[1]
        except Exception as e:
            db.rollback()
            logger.error(f"Error alerts trend: {e}")

        # 4. Incidents by date
        try:
            date_col = func.date(Incident.created_at)
            query = select(date_col.label("d"), func.count(Incident.id))
            query = apply_tenant_filter(query, Incident, current_user)
            query = query.where(Incident.created_at >= start_date).group_by(date_col)
            
            for row in db.execute(query):
                dt = _normalize_trend_bucket_value(row.d)
                if dt is None:
                    continue
                key = get_bucket_key(dt)
                if key in items_dict:
                    items_dict[key]["incidents"] += row[1]
        except Exception as e:
            db.rollback()
            logger.error(f"Error incidents trend: {e}")

        items = list(items_dict.values())
        items.sort(key=lambda x: x["date_key"])
        # Remove internal date_key from output
        for item in items:
            item.pop("date_key", None)
            
        return {
            "range": time_range,
            "granularity": granularity,
            "items": items
        }
    except Exception as e:
        logger.error(f"Error in get_dashboard_trends: {e}")
        return {
            "range": time_range,
            "items": []
        }


@router.get("/sentiment-summary")
def get_sentiment_summary(
    time_range: str = Query("7d", alias="range", pattern="^(today|7d|30d)$"),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get sentiment distribution for pie chart"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.now(timezone.utc)
        
        if time_range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "7d":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=30)
        
        from app.models.mention import SentimentScore
        
        # Build base filter for mentions
        mention_filter = [Mention.collected_at >= start_date, Mention.is_muted == False]
        if project_id:
            mention_filter.append(Mention.project_id == project_id)
        
        # Get total mentions in this period
        try:
            total_mentions = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(*mention_filter))
            ).scalar() or 0
        except:
            total_mentions = 0
        
        # Build filter for AI analysis - need to join with mentions to filter by project_id
        ai_filter = [AIAnalysis.analyzed_at >= start_date]
        if project_id:
            # Subquery to get mention IDs for this project
            project_mention_ids = db.execute(
                select(Mention.id).where(and_(*mention_filter))
            ).scalars().all()
            if project_mention_ids:
                ai_filter.append(AIAnalysis.mention_id.in_(project_mention_ids))
            else:
                # No mentions for this project, so no AI analysis
                ai_filter.append(AIAnalysis.mention_id == -1)  # Force empty result
        
        try:
            positive = db.execute(
                select(func.count(AIAnalysis.id)).where(and_(*ai_filter, AIAnalysis.sentiment == SentimentScore.POSITIVE))
            ).scalar() or 0
        except Exception:
            positive = 0
            
        try:
            neutral = db.execute(
                select(func.count(AIAnalysis.id)).where(and_(*ai_filter, AIAnalysis.sentiment == SentimentScore.NEUTRAL))
            ).scalar() or 0
        except Exception:
            neutral = 0
            
        try:
            negative = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        *ai_filter,
                        AIAnalysis.sentiment.in_(['negative'])
                    )
                )
            ).scalar() or 0
        except Exception:
            db.rollback()
            negative = 0
            
        # The remainder are unknown/pending
        analyzed_total = positive + neutral + negative
        unknown = max(0, total_mentions - analyzed_total)
        
        return {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "unknown": unknown,
            "total": total_mentions
        }
    except Exception as e:
        logger.error(f"Error in get_sentiment_summary: {e}")
        return {
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "total": 0
        }


@router.get("/hot-keywords")
def get_hot_keywords(
    time_range: str = Query("7d", alias="range", pattern="^(today|7d|30d)$"),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get hot keywords based on mention frequency"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.now(timezone.utc)
        
        if time_range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_range == "7d":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=30)
        
        # Get all keywords
        try:
            all_keywords = db.execute(
                apply_tenant_filter(select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id), KeywordGroup, current_user) if 'KeywordGroup' in globals() or 'KeywordGroup' in locals() else apply_tenant_filter(select(Keyword), None, current_user).where(Keyword.is_active == True)
            ).scalars().all()
        except Exception:
            all_keywords = []
        
        # Get recent mentions
        try:
            mentions_query = apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.collected_at >= start_date)
            if project_id:
                mentions_query = mentions_query.where(Mention.project_id == project_id)
            recent_mentions = db.execute(mentions_query).scalars().all()
        except Exception:
            recent_mentions = []
        
        # Count keyword occurrences
        keyword_counts = {}
        
        # Pre-fetch AIAnalysis for all recent mentions to prevent N+1 queries in loops
        analysis_dict = {}
        if recent_mentions:
            mention_ids = [m.id for m in recent_mentions]
            # Chunking list to avoid very large IN clauses
            chunk_size = 1000
            for i in range(0, len(mention_ids), chunk_size):
                chunk = mention_ids[i:i + chunk_size]
                try:
                    analyses = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(chunk))).scalars().all()
                    for a in analyses:
                        analysis_dict[a.mention_id] = a
                except Exception as e:
                    db.rollback()
                    logger.error(f"Error fetching AI analysis batch: {e}")

        for kw in all_keywords:
            count = 0
            negative_count = 0
            risk_scores = []
            
            for m in recent_mentions:
                matched = False
                if m.matched_keywords and isinstance(m.matched_keywords, list):
                    for mk in m.matched_keywords:
                        if mk.get('keyword_id') == kw.id or mk.get('keyword', '').lower() == kw.keyword.lower():
                            matched = True
                            break
                else:
                    content_lower = ((m.title or '') + ' ' + (m.content or '')).lower()
                    if kw.keyword.lower() in content_lower:
                        matched = True
                        
                if matched:
                    count += 1
                    # Use pre-fetched analysis
                    analysis = analysis_dict.get(m.id)
                    if analysis:
                        sentiment_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
                        if sentiment_val in ['negative']:
                            negative_count += 1
                        if analysis.risk_score is not None:
                            risk_scores.append(analysis.risk_score)
            
            if count > 0:
                keyword_counts[kw.keyword] = {
                    "keyword": kw.keyword,
                    "count": count,
                    "negative_count": negative_count,
                    "risk_score_avg": round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0
                }
        
        # Sort by count descending, take top 10
        sorted_keywords = sorted(keyword_counts.values(), key=lambda x: x['count'], reverse=True)[:10]
        
        return {
            "items": sorted_keywords
        }
    except Exception as e:
        logger.error(f"Error in get_hot_keywords: {e}")
        return {
            "items": []
        }


@router.get("/sidebar-badges")
def get_sidebar_badges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get badge counts for sidebar"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        try:
            new_alerts = db.execute(
                apply_tenant_filter(select(func.count(Alert.id)), Alert, current_user).where(Alert.status == 'new')
            ).scalar() or 0
        except Exception:
            new_alerts = 0
        
        try:
            open_incidents = db.execute(
                apply_tenant_filter(select(func.count(Incident.id)), Incident, current_user).where(
                    Incident.status.in_(['new', 'investigating', 'in_progress'])
                )
            ).scalar() or 0
        except Exception:
            open_incidents = 0
        
        try:
            unreviewed_mentions = db.execute(
                apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(Mention.is_reviewed == False)
            ).scalar() or 0
        except Exception:
            unreviewed_mentions = 0
        
        return {
            "new_alerts": new_alerts,
            "open_incidents": open_incidents,
            "unreviewed_mentions": unreviewed_mentions
        }
    except Exception as e:
        logger.error(f"Error in get_sidebar_badges: {e}")
        return {
            "new_alerts": 0,
            "open_incidents": 0,
            "unreviewed_mentions": 0
        }

@router.get("/overview")
def get_dashboard_overview(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.project import Project
    from app.models.crawl import CrawlJob
    from app.models.source_item import SourceItem
    from app.core.config import settings
    
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}
        
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    d7_start = now - timedelta(days=7)
    d30_start = now - timedelta(days=30)
    
    # Totals
    mentions_total = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(Mention.project_id == project_id)).scalar() or 0
    mentions_today = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(Mention.project_id == project_id, Mention.collected_at >= today_start))).scalar() or 0
    mentions_7d = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(Mention.project_id == project_id, Mention.collected_at >= d7_start))).scalar() or 0
    mentions_30d = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user).where(and_(Mention.project_id == project_id, Mention.collected_at >= d30_start))).scalar() or 0
    
    # Fetch recent jobs to avoid full table scan on JSON field
    recent_all_jobs = db.execute(
        select(CrawlJob).order_by(CrawlJob.id.desc()).limit(200)
    ).scalars().all()
    
    project_jobs = [j for j in recent_all_jobs if j.meta_data and str(j.meta_data.get('project_id')) == str(project_id)]
    last_job = next((j for j in project_jobs if j.status == 'completed'), None)
    new_mentions_last_scan = last_job.mentions_found if last_job else 0
    
    # Actually wait, source_items_total doesn't have project_id, it's global
    source_items_total = db.execute(select(func.count(SourceItem.id))).scalar() or 0
    
    # Sources breakdown
    sources_data = db.execute(
        select(Mention.source_type, func.count(Mention.id))
        .where(Mention.project_id == project_id)
        .group_by(Mention.source_type)
    ).all()
    sources_dict = {row[0]: row[1] for row in sources_data if row[0]}
    
    # Sentiment
    from app.models.mention import SentimentScore
    sentiment_data = {"positive": 0, "neutral": 0, "negative": 0}
    try:
        # Simplistic mapping if available
        pass
    except:
        pass

    # Capability Check
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
    auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
    auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
    web_ready = has_serpapi and is_serpapi_provider and auto_discovery
    
    has_youtube = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
    
    rss_count = db.execute(apply_tenant_filter(select(func.count(Source.id)), Source, current_user).where(Source.source_type == "rss")).scalar() or 0

    collectors = {
        "web": {"status": "READY" if web_ready else "CONFIG_REQUIRED"},
        "youtube": {"status": "READY" if has_youtube else "CONFIG_REQUIRED"},
        "rss": {"status": "READY" if rss_count > 0 else "NO_SOURCES"},
        "facebook": {"status": "CONNECT_REQUIRED"},
        "instagram": {"status": "CONNECT_REQUIRED"},
        "tiktok": {"status": "CONNECTOR_REQUIRED"},
        "twitter": {"status": "CONFIG_REQUIRED"}
    }
    
    recent_mentions = db.execute(
        apply_tenant_filter(select(Mention), Mention, current_user).where(Mention.project_id == project_id).order_by(Mention.collected_at.desc()).limit(5)
    ).scalars().all()
    
    recent_jobs_limited = project_jobs[:5]
    
    return {
        "project": {"id": project.id, "name": project.name},
        "totals": {
            "mentions_total": mentions_total,
            "mentions_today": mentions_today,
            "mentions_7d": mentions_7d,
            "mentions_30d": mentions_30d,
            "new_mentions_last_scan": new_mentions_last_scan,
            "source_items_total": source_items_total
        },
        "sentiment": sentiment_data,
        "sources": sources_dict,
        "collectors": collectors,
        "recent_mentions": [
            {
                "id": m.id,
                "title": m.title,
                "domain": m.domain,
                "sentiment": m.sentiment,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None
            } for m in recent_mentions
        ],
        "recent_jobs": [
            {
                "id": j.id,
                "status": j.status,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "mentions_found": j.mentions_found
            } for j in recent_jobs_limited
        ],
        "alerts": []
    }

