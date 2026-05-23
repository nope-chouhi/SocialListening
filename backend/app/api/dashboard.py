from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, cast, Date
from datetime import datetime, timedelta
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.incident import Incident, IncidentStatus
from app.models.source import Source
from app.models.keyword import Keyword

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get dashboard summary metrics"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Total mentions
        try:
            total_mentions = db.execute(select(func.count(Mention.id))).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying total mentions: {e}")
            total_mentions = 0
            
        try:
            mentions_today = db.execute(
                select(func.count(Mention.id)).where(Mention.collected_at >= today_start)
            ).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying mentions today: {e}")
            mentions_today = 0
        
        # Negative mentions (last 30 days)
        month_start = now - timedelta(days=30)
        try:
            from app.models.mention import SentimentScore
            negative_mentions = db.execute(
                select(func.count(AIAnalysis.id))
                .where(
                    and_(
                        AIAnalysis.sentiment.in_([SentimentScore.NEGATIVE_LOW, SentimentScore.NEGATIVE_MEDIUM, SentimentScore.NEGATIVE_HIGH]),
                        AIAnalysis.analyzed_at >= month_start
                    )
                )
            ).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying negative mentions: {e}")
            negative_mentions = 0
        
        # Alerts
        try:
            total_alerts = db.execute(
                select(func.count(Alert.id)).where(Alert.status != 'resolved')
            ).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying total alerts: {e}")
            total_alerts = 0
        
        # Incidents
        try:
            total_incidents = db.execute(
                select(func.count(Incident.id)).where(Incident.status != 'closed')
            ).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying total incidents: {e}")
            total_incidents = 0
        
        # Sources
        try:
            total_sources = db.execute(
                select(func.count(Source.id)).where(Source.is_active == True)
            ).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying active sources: {e}")
            total_sources = 0
        
        # Latest mentions with AI analysis
        latest_mentions_data = []
        try:
            latest_mentions_query = select(Mention).order_by(Mention.collected_at.desc()).limit(10)
            latest_mentions = db.execute(latest_mentions_query).scalars().all()
            
            for m in latest_mentions:
                try:
                    analysis = db.execute(
                        select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                    ).scalar_one_or_none()
                except Exception:
                    analysis = None
                
                try:
                    source = db.execute(
                        select(Source).where(Source.id == m.source_id)
                    ).scalar_one_or_none()
                except Exception:
                    source = None
                
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
                })
        except Exception as e:
            logger.error(f"Error querying latest mentions: {e}")
            latest_mentions_data = []
        
        # Latest alerts
        latest_alerts_data = []
        try:
            latest_alerts_query = select(Alert).order_by(Alert.created_at.desc()).limit(10)
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
            logger.error(f"Error querying latest alerts: {e}")
            latest_alerts_data = []
        
        return {
            "total_mentions": total_mentions,
            "mentions_today": mentions_today,
            "negative_mentions": negative_mentions,
            "alerts_count": total_alerts,
            "incidents_count": total_incidents,
            "active_sources": total_sources,
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
        latest_mentions_query = select(Mention).order_by(Mention.collected_at.desc()).limit(limit)
        latest_mentions = db.execute(latest_mentions_query).scalars().all()
        
        latest_mentions_data = []
        for m in latest_mentions:
            try:
                analysis = db.execute(
                    select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                ).scalar_one_or_none()
            except Exception:
                analysis = None
            
            try:
                source = db.execute(
                    select(Source).where(Source.id == m.source_id)
                ).scalar_one_or_none()
            except Exception:
                source = None
            
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
        latest_alerts_query = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
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
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get trend data for charts"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.utcnow()
        
        if range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            days = 1
        elif range == "7d":
            start_date = now - timedelta(days=7)
            days = 7
        else:
            start_date = now - timedelta(days=30)
            days = 30
        
        items = []
        
        for i in range(days if days <= 30 else 30):
            if range == "today":
                day_start = start_date
                day_end = now
            else:
                day_start = start_date + timedelta(days=i)
                day_end = day_start + timedelta(days=1)
            
            date_str = day_start.strftime("%Y-%m-%d")
            
            # Total mentions for this day
            try:
                total_mentions = db.execute(
                    select(func.count(Mention.id)).where(
                        and_(
                            Mention.collected_at >= day_start,
                            Mention.collected_at < day_end
                        )
                    )
                ).scalar() or 0
            except Exception:
                total_mentions = 0
            
            try:
                from app.models.mention import SentimentScore
                negative_mentions = db.execute(
                    select(func.count(AIAnalysis.id)).where(
                        and_(
                            AIAnalysis.analyzed_at >= day_start,
                            AIAnalysis.analyzed_at < day_end,
                            AIAnalysis.sentiment.in_([SentimentScore.NEGATIVE_LOW, SentimentScore.NEGATIVE_MEDIUM, SentimentScore.NEGATIVE_HIGH])
                        )
                    )
                ).scalar() or 0
            except Exception:
                negative_mentions = 0
            
            # Alerts for this day
            try:
                alerts_count = db.execute(
                    select(func.count(Alert.id)).where(
                        and_(
                            Alert.created_at >= day_start,
                            Alert.created_at < day_end
                        )
                    )
                ).scalar() or 0
            except Exception:
                alerts_count = 0
            
            # Incidents for this day
            try:
                incidents_count = db.execute(
                    select(func.count(Incident.id)).where(
                        and_(
                            Incident.created_at >= day_start,
                            Incident.created_at < day_end
                        )
                    )
                ).scalar() or 0
            except Exception:
                incidents_count = 0
            
            items.append({
                "date": date_str,
                "total_mentions": total_mentions,
                "negative_mentions": negative_mentions,
                "alerts": alerts_count,
                "incidents": incidents_count
            })
            
        # Check if all counts are 0
        total_sum = sum(
            x["total_mentions"] + x["negative_mentions"] + x["alerts"] + x["incidents"]
            for x in items
        )
        if total_sum == 0:
            items = []
            
        return {
            "range": range,
            "items": items
        }
    except Exception as e:
        logger.error(f"Error in get_dashboard_trends: {e}")
        return {
            "range": range,
            "items": []
        }


@router.get("/sentiment-summary")
def get_sentiment_summary(
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get sentiment distribution for pie chart"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.utcnow()
        
        if range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif range == "7d":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=30)
        
        from app.models.mention import SentimentScore
        
        try:
            positive = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start_date,
                        AIAnalysis.sentiment == SentimentScore.POSITIVE
                    )
                )
            ).scalar() or 0
        except Exception:
            positive = 0
            
        try:
            neutral = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start_date,
                        AIAnalysis.sentiment == SentimentScore.NEUTRAL
                    )
                )
            ).scalar() or 0
        except Exception:
            neutral = 0
            
        try:
            negative = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start_date,
                        AIAnalysis.sentiment.in_([SentimentScore.NEGATIVE_LOW, SentimentScore.NEGATIVE_MEDIUM, SentimentScore.NEGATIVE_HIGH])
                    )
                )
            ).scalar() or 0
        except Exception:
            negative = 0
        
        return {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "total": positive + neutral + negative
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
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get hot keywords based on mention frequency"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        now = datetime.utcnow()
        
        if range == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif range == "7d":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=30)
        
        # Get all keywords
        try:
            all_keywords = db.execute(
                select(Keyword).where(Keyword.is_active == True)
            ).scalars().all()
        except Exception:
            all_keywords = []
        
        # Get recent mentions
        try:
            recent_mentions = db.execute(
                select(Mention).where(Mention.collected_at >= start_date)
            ).scalars().all()
        except Exception:
            recent_mentions = []
        
        # Count keyword occurrences
        keyword_counts = {}
        for kw in all_keywords:
            count = 0
            negative_count = 0
            risk_scores = []
            
            for m in recent_mentions:
                content_lower = ((m.title or '') + ' ' + (m.content or '')).lower()
                if kw.keyword.lower() in content_lower:
                    count += 1
                    # Check if this mention has negative analysis
                    try:
                        analysis = db.execute(
                            select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                        ).scalar_one_or_none()
                    except Exception:
                        analysis = None
                    if analysis:
                        sentiment_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
                        if sentiment_val in ['negative_low', 'negative_medium', 'negative_high', 'negative']:
                            negative_count += 1
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
                select(func.count(Alert.id)).where(Alert.status == 'new')
            ).scalar() or 0
        except Exception:
            new_alerts = 0
        
        try:
            open_incidents = db.execute(
                select(func.count(Incident.id)).where(
                    Incident.status.in_(['new', 'investigating', 'in_progress'])
                )
            ).scalar() or 0
        except Exception:
            open_incidents = 0
        
        try:
            unreviewed_mentions = db.execute(
                select(func.count(Mention.id)).where(Mention.is_reviewed == False)
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
