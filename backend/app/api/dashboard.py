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
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total mentions
    total_mentions = db.execute(select(func.count(Mention.id))).scalar() or 0
    mentions_today = db.execute(
        select(func.count(Mention.id)).where(Mention.collected_at >= today_start)
    ).scalar() or 0
    
    # Negative mentions (last 30 days)
    month_start = now - timedelta(days=30)
    negative_mentions = db.execute(
        select(func.count(AIAnalysis.id))
        .where(
            and_(
                AIAnalysis.sentiment.in_(['negative_low', 'negative_medium', 'negative_high']),
                AIAnalysis.analyzed_at >= month_start
            )
        )
    ).scalar() or 0
    
    # Alerts
    total_alerts = db.execute(
        select(func.count(Alert.id)).where(Alert.status != 'resolved')
    ).scalar() or 0
    
    # Incidents
    total_incidents = db.execute(
        select(func.count(Incident.id)).where(Incident.status != 'closed')
    ).scalar() or 0
    
    # Sources
    total_sources = db.execute(
        select(func.count(Source.id)).where(Source.is_active == True)
    ).scalar() or 0
    
    # Latest mentions with AI analysis
    latest_mentions_query = select(Mention).order_by(Mention.collected_at.desc()).limit(10)
    latest_mentions = db.execute(latest_mentions_query).scalars().all()
    
    latest_mentions_data = []
    for m in latest_mentions:
        analysis = db.execute(
            select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
        ).scalar_one_or_none()
        
        # Get source info
        source = db.execute(
            select(Source).where(Source.id == m.source_id)
        ).scalar_one_or_none()
        
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
    
    # Latest alerts
    latest_alerts_query = select(Alert).order_by(Alert.created_at.desc()).limit(10)
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
        "metrics": {
            "total_mentions": total_mentions,
            "mentions_today": mentions_today,
            "negative_mentions": negative_mentions,
            "total_alerts": total_alerts,
            "total_incidents": total_incidents,
            "total_sources": total_sources
        },
        "latest_mentions": latest_mentions_data,
        "latest_alerts": latest_alerts_data
    }


@router.get("/trends")
def get_dashboard_trends(
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get trend data for charts"""
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
        total_mentions = db.execute(
            select(func.count(Mention.id)).where(
                and_(
                    Mention.collected_at >= day_start,
                    Mention.collected_at < day_end
                )
            )
        ).scalar() or 0
        
        # Negative mentions for this day
        negative_mentions = db.execute(
            select(func.count(AIAnalysis.id)).where(
                and_(
                    AIAnalysis.analyzed_at >= day_start,
                    AIAnalysis.analyzed_at < day_end,
                    AIAnalysis.sentiment.in_(['negative_low', 'negative_medium', 'negative_high'])
                )
            )
        ).scalar() or 0
        
        # Alerts for this day
        alerts_count = db.execute(
            select(func.count(Alert.id)).where(
                and_(
                    Alert.created_at >= day_start,
                    Alert.created_at < day_end
                )
            )
        ).scalar() or 0
        
        # Incidents for this day
        incidents_count = db.execute(
            select(func.count(Incident.id)).where(
                and_(
                    Incident.created_at >= day_start,
                    Incident.created_at < day_end
                )
            )
        ).scalar() or 0
        
        items.append({
            "date": date_str,
            "total_mentions": total_mentions,
            "negative_mentions": negative_mentions,
            "alerts": alerts_count,
            "incidents": incidents_count
        })
    
    return {
        "range": range,
        "items": items
    }


@router.get("/sentiment-summary")
def get_sentiment_summary(
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get sentiment distribution for pie chart"""
    now = datetime.utcnow()
    
    if range == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range == "7d":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    positive = db.execute(
        select(func.count(AIAnalysis.id)).where(
            and_(
                AIAnalysis.analyzed_at >= start_date,
                AIAnalysis.sentiment == 'positive'
            )
        )
    ).scalar() or 0
    
    neutral = db.execute(
        select(func.count(AIAnalysis.id)).where(
            and_(
                AIAnalysis.analyzed_at >= start_date,
                AIAnalysis.sentiment == 'neutral'
            )
        )
    ).scalar() or 0
    
    negative = db.execute(
        select(func.count(AIAnalysis.id)).where(
            and_(
                AIAnalysis.analyzed_at >= start_date,
                AIAnalysis.sentiment.in_(['negative_low', 'negative_medium', 'negative_high'])
            )
        )
    ).scalar() or 0
    
    return {
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "total": positive + neutral + negative
    }


@router.get("/hot-keywords")
def get_hot_keywords(
    range: str = Query("7d", regex="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get hot keywords based on mention frequency"""
    now = datetime.utcnow()
    
    if range == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range == "7d":
        start_date = now - timedelta(days=7)
    else:
        start_date = now - timedelta(days=30)
    
    # Get all keywords
    all_keywords = db.execute(
        select(Keyword).where(Keyword.is_active == True)
    ).scalars().all()
    
    # Get recent mentions
    recent_mentions = db.execute(
        select(Mention).where(Mention.collected_at >= start_date)
    ).scalars().all()
    
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
                analysis = db.execute(
                    select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                ).scalar_one_or_none()
                if analysis:
                    if analysis.sentiment in ['negative_low', 'negative_medium', 'negative_high']:
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


@router.get("/sidebar-badges")
def get_sidebar_badges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get badge counts for sidebar"""
    new_alerts = db.execute(
        select(func.count(Alert.id)).where(Alert.status == 'new')
    ).scalar() or 0
    
    open_incidents = db.execute(
        select(func.count(Incident.id)).where(
            Incident.status.in_(['new', 'investigating', 'in_progress'])
        )
    ).scalar() or 0
    
    # Unreviewed mentions
    unreviewed_mentions = db.execute(
        select(func.count(Mention.id)).where(Mention.is_reviewed == False)
    ).scalar() or 0
    
    return {
        "new_alerts": new_alerts,
        "open_incidents": open_incidents,
        "unreviewed_mentions": unreviewed_mentions
    }
