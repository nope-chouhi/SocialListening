from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert, AlertStatus, AlertSeverity
from app.models.incident import Incident, IncidentStatus, IncidentLog
from app.services.ai_service import analyze_mention
from app.services.notification_service import notify_high_risk_mention
import os
from math import ceil

router = APIRouter()


@router.get("")
def list_mentions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_id: Optional[int] = None,
    sentiment: Optional[str] = None,
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    search_query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List mentions with filtering and pagination"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        from sqlalchemy import or_
        query = select(Mention)

        if source_id:
            query = query.where(Mention.source_id == source_id)

        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Mention.title.ilike(search_pattern),
                    Mention.content.ilike(search_pattern)
                )
            )

        try:
            total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
        except Exception as e:
            logger.error(f"Error querying total mentions count: {e}")
            total = 0

        offset = (page - 1) * page_size
        query = query.order_by(Mention.collected_at.desc()).offset(offset).limit(page_size)

        try:
            mentions = db.execute(query).scalars().all()
        except Exception as e:
            logger.error(f"Error querying mentions page: {e}")
            raise HTTPException(status_code=500, detail="Lỗi khi truy vấn dữ liệu mentions")

        result_items = []
        for m in mentions:
            try:
                analysis = db.execute(
                    select(AIAnalysis).where(AIAnalysis.mention_id == m.id)
                ).scalar_one_or_none()
            except Exception:
                analysis = None

            result_items.append({
                "id": m.id,
                "source_id": m.source_id,
                "title": m.title,
                "content": m.content,
                "url": m.url,
                "author": m.author,
                "published_at": m.published_at.isoformat() if m.published_at else None,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None,
                "matched_keywords": m.matched_keywords,
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

        return {
            "items": result_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Critical error in list_mentions: {e}")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải danh sách mentions")


@router.get("/{mention_id}")
def get_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a mention by ID with AI analysis"""
    mention = db.execute(
        select(Mention).where(Mention.id == mention_id)
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
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    # Check if analysis already exists
    existing = db.execute(
        select(AIAnalysis).where(AIAnalysis.mention_id == mention_id)
    ).scalar_one_or_none()

    analysis_result = analyze_mention(mention.content, mention.title)
    
    # Get AI provider name for tracking
    ai_provider = os.getenv("AI_PROVIDER", "dummy").lower()
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
        select(Mention).where(Mention.id == mention_id)
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

    alert_title = title or f"Alert tá»« mention: {mention.title or mention.url}"
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
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    incident_title = title or f"Sá»± cá»‘ tá»« mention: {mention.title or mention.url}"
    incident = Incident(
        mention_id=mention_id,
        owner_id=current_user.id,
        title=incident_title,
        description=description or f"Sá»± cá»‘ Ä‘Æ°á»£c táº¡o tá»« mention: {mention.url}",
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
        notes=f"Sá»± cá»‘ Ä‘Æ°á»£c táº¡o tá»« mention #{mention_id}"
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
        select(Mention).where(Mention.id == mention_id)
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
        select(Mention).where(Mention.id == mention_id)
    ).scalar_one_or_none()

    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")

    db.delete(mention)
    db.commit()

