from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from typing import List, Dict

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.keyword import Keyword, KeywordType

router = APIRouter()

@router.get("/summary")
def get_competitors_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Share of Voice and sentiment comparison between main brand and competitors.
    """
    # Find all competitor keywords
    competitors = db.execute(
        select(Keyword).where(Keyword.keyword_type == KeywordType.COMPETITOR)
    ).scalars().all()
    
    # Also find brand keywords
    brands = db.execute(
        select(Keyword).where(Keyword.keyword_type == KeywordType.BRAND)
    ).scalars().all()
    
    # If no competitors configured, we return an empty state
    if not competitors:
        return {
            "has_competitors": False,
            "share_of_voice": [],
            "sentiment_comparison": []
        }
        
    # We will approximate mentions by checking the JSON matched_keywords
    # For a real DB with proper JSON querying we'd use jsonb operators.
    # For SQLite/MySQL cross-compatibility in SQLAlchemy, we do simple Python aggregation or string matching
    # Let's use simple wildcard matching on the content for this mock API since matched_keywords is JSON string.
    
    brand_keywords = [k.keyword for k in brands] if brands else ["nope", "social listening"]
    
    results = []
    total_mentions = 0
    
    # Brand volume
    brand_mentions = 0
    for bk in brand_keywords:
        c = db.execute(select(func.count(Mention.id)).where(Mention.content.ilike(f'%{bk}%'))).scalar() or 0
        brand_mentions += c
    
    total_mentions += brand_mentions
    
    # Sentiment for brand
    brand_positive = db.execute(
        select(func.count(AIAnalysis.id))
        .join(Mention, Mention.id == AIAnalysis.mention_id)
        .where(and_(Mention.content.ilike(f'%{brand_keywords[0]}%'), AIAnalysis.sentiment == 'positive'))
    ).scalar() or 0
    
    brand_negative = db.execute(
        select(func.count(AIAnalysis.id))
        .join(Mention, Mention.id == AIAnalysis.mention_id)
        .where(and_(Mention.content.ilike(f'%{brand_keywords[0]}%'), AIAnalysis.sentiment.like('%negative%')))
    ).scalar() or 0
        
    results.append({
        "name": "Thương hiệu của bạn",
        "is_brand": True,
        "volume": brand_mentions,
        "sentiment": {
            "positive": brand_positive,
            "negative": brand_negative,
            "neutral": max(0, brand_mentions - brand_positive - brand_negative)
        }
    })
    
    # Competitor volume
    for comp in competitors:
        c = db.execute(select(func.count(Mention.id)).where(Mention.content.ilike(f'%{comp.keyword}%'))).scalar() or 0
        total_mentions += c
        
        c_pos = db.execute(
            select(func.count(AIAnalysis.id))
            .join(Mention, Mention.id == AIAnalysis.mention_id)
            .where(and_(Mention.content.ilike(f'%{comp.keyword}%'), AIAnalysis.sentiment == 'positive'))
        ).scalar() or 0
        
        c_neg = db.execute(
            select(func.count(AIAnalysis.id))
            .join(Mention, Mention.id == AIAnalysis.mention_id)
            .where(and_(Mention.content.ilike(f'%{comp.keyword}%'), AIAnalysis.sentiment.like('%negative%')))
        ).scalar() or 0
        
        results.append({
            "name": comp.keyword,
            "is_brand": False,
            "volume": c,
            "sentiment": {
                "positive": c_pos,
                "negative": c_neg,
                "neutral": max(0, c - c_pos - c_neg)
            }
        })
        
    # Calculate Share of Voice percentages
    for r in results:
        r["share_of_voice"] = round((r["volume"] / total_mentions * 100) if total_mentions > 0 else 0, 1)
        
    return {
        "has_competitors": True,
        "total_analyzed": total_mentions,
        "data": results
    }
