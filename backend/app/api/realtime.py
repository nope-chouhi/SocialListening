"""
Real-time WebSocket and metrics API.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.services.realtime_manager import realtime_manager

logger = logging.getLogger(__name__)
router = APIRouter()


def _verify_ws_token(token: Optional[str]) -> bool:
    if not token:
        return False
    try:
        jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return True
    except JWTError:
        return False


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket for real-time mention updates. Pass JWT as ?token="""
    if not _verify_ws_token(token):
        await websocket.close(code=4001)
        return

    await realtime_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; client may send ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event":"pong","data":{}}')
    except WebSocketDisconnect:
        pass
    finally:
        await realtime_manager.disconnect(websocket)


@router.get("/metrics")
def get_realtime_metrics(
    project_id: Optional[int] = Query(None),
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Real-time dashboard metrics: volume buckets (5 min), sentiment %, reach, interactions.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    bucket_minutes = 5
    num_buckets = min(int(hours * 60 / bucket_minutes), 288)

    base_filter = [Mention.collected_at >= start, Mention.is_muted == False]
    if project_id:
        base_filter.append(Mention.project_id == project_id)

    # Quick stats
    total = db.execute(
        select(func.count(Mention.id)).where(and_(*base_filter))
    ).scalar() or 0

    reach = db.execute(
        select(func.coalesce(func.sum(Mention.reach_estimate), 0)).where(and_(*base_filter))
    ).scalar() or 0

    interactions = db.execute(
        select(
            func.coalesce(
                func.sum(
                    func.coalesce(Mention.likes_count, 0)
                    + func.coalesce(Mention.comments_count, 0)
                    + func.coalesce(Mention.shares_count, 0)
                ),
                0,
            )
        ).where(and_(*base_filter))
    ).scalar() or 0

    # Sentiment from Mention.sentiment (simple) or AIAnalysis
    pos = db.execute(
        select(func.count(Mention.id)).where(
            and_(*base_filter, Mention.sentiment == "positive")
        )
    ).scalar() or 0
    neg = db.execute(
        select(func.count(Mention.id)).where(
            and_(*base_filter, Mention.sentiment == "negative")
        )
    ).scalar() or 0
    neu = db.execute(
        select(func.count(Mention.id)).where(
            and_(
                *base_filter,
                (Mention.sentiment == "neutral") | (Mention.sentiment.is_(None)),
            )
        )
    ).scalar() or 0

    analyzed = pos + neg + neu
    if analyzed == 0:
        # Fallback to AIAnalysis counts in period
        try:
            pos = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start,
                        AIAnalysis.sentiment == SentimentScore.POSITIVE,
                    )
                )
            ).scalar() or 0
            neg = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start,
                        AIAnalysis.sentiment == "negative",
                    )
                )
            ).scalar() or 0
            neu = db.execute(
                select(func.count(AIAnalysis.id)).where(
                    and_(
                        AIAnalysis.analyzed_at >= start,
                        AIAnalysis.sentiment == SentimentScore.NEUTRAL,
                    )
                )
            ).scalar() or 0
            analyzed = pos + neg + neu
        except Exception:
            pass

    sentiment_score_pct = round((pos / analyzed * 100) if analyzed else 50, 1)

    # Volume buckets — last N × 5 minutes
    volume = []
    for i in range(num_buckets - 1, -1, -1):
        bucket_end = now - timedelta(minutes=i * bucket_minutes)
        bucket_start = bucket_end - timedelta(minutes=bucket_minutes)
        count = db.execute(
            select(func.count(Mention.id)).where(
                and_(
                    *base_filter,
                    Mention.collected_at >= bucket_start,
                    Mention.collected_at < bucket_end,
                )
            )
        ).scalar() or 0
        reach_bucket = db.execute(
            select(func.coalesce(func.sum(Mention.reach_estimate), 0)).where(
                and_(
                    *base_filter,
                    Mention.collected_at >= bucket_start,
                    Mention.collected_at < bucket_end,
                )
            )
        ).scalar() or 0
        inter_bucket = db.execute(
            select(
                func.coalesce(
                    func.sum(func.coalesce(Mention.likes_count, 0)),
                    0,
                )
            ).where(
                and_(
                    *base_filter,
                    Mention.collected_at >= bucket_start,
                    Mention.collected_at < bucket_end,
                )
            )
        ).scalar() or 0
        volume.append({
            "time": bucket_start.isoformat(),
            "mentions": count,
            "reach": int(reach_bucket or 0),
            "interactions": int(inter_bucket or 0),
        })

    return {
        "total_mentions": total,
        "reach": int(reach or 0),
        "interactions": int(interactions or 0),
        "sentiment_score_pct": sentiment_score_pct,
        "sentiment_breakdown": {
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "positive_pct": round(pos / analyzed * 100, 1) if analyzed else 0,
            "negative_pct": round(neg / analyzed * 100, 1) if analyzed else 0,
            "neutral_pct": round(neu / analyzed * 100, 1) if analyzed else 0,
        },
        "volume": volume[-72:],  # cap ~6h of 5-min buckets for payload size
        "updated_at": now.isoformat(),
    }
