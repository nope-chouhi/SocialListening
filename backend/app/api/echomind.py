from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.core.database import get_db
from app.models.echomind import EchoKeyword, EchoMention
from app.schemas.echomind import (
    EchoKeywordCreate, EchoKeywordResponse,
    EchoMentionResponse, AnalyticsSummaryResponse
)

router = APIRouter()

@router.get("/keywords", response_model=List[EchoKeywordResponse])
def get_keywords(db: Session = Depends(get_db)):
    return db.query(EchoKeyword).all()

@router.post("/keywords", response_model=EchoKeywordResponse)
def create_keyword(keyword: EchoKeywordCreate, db: Session = Depends(get_db)):
    db_obj = db.query(EchoKeyword).filter(EchoKeyword.keyword == keyword.keyword).first()
    if db_obj:
        raise HTTPException(status_code=400, detail="Keyword already exists")
    
    new_kw = EchoKeyword(keyword=keyword.keyword)
    db.add(new_kw)
    db.commit()
    db.refresh(new_kw)
    return new_kw

@router.delete("/keywords/{id}")
def delete_keyword(id: int, db: Session = Depends(get_db)):
    db_obj = db.query(EchoKeyword).filter(EchoKeyword.id == id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    db.delete(db_obj)
    # Also optionally delete related mentions? Keeping them for now.
    db.commit()
    return {"status": "ok"}

@router.get("/mentions", response_model=List[EchoMentionResponse])
def get_mentions(db: Session = Depends(get_db)):
    # In a real app we'd paginate, sort, filter. For MVP, sort by descending date.
    return db.query(EchoMention).order_by(EchoMention.created_at.desc()).limit(100).all()

@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(db: Session = Depends(get_db)):
    mentions = db.query(EchoMention).all()
    
    total = len(mentions)
    positive = sum(1 for m in mentions if m.sentiment == 'positive')
    negative = sum(1 for m in mentions if m.sentiment == 'negative')
    neutral = sum(1 for m in mentions if m.sentiment == 'neutral')
    
    avg_score = 0.0
    if total > 0:
        avg_score = sum(m.sentiment_score for m in mentions) / total
        
    timeline_dict = {}
    for m in mentions:
        date_str = m.created_at.strftime("%Y-%m-%d")
        timeline_dict[date_str] = timeline_dict.get(date_str, 0) + 1
        
    timeline = [{"time": k, "count": v} for k, v in sorted(timeline_dict.items())]
    
    return AnalyticsSummaryResponse(
        total_mentions=total,
        positive_mentions=positive,
        negative_mentions=negative,
        neutral_mentions=neutral,
        avg_sentiment_score=avg_score,
        timeline=timeline,
        sentiment_distribution=[
            {"name": "Positive", "value": positive},
            {"name": "Negative", "value": negative},
            {"name": "Neutral", "value": neutral}
        ]
    )
