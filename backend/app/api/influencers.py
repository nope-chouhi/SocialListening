from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, text
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention

router = APIRouter()

@router.get("/leaderboard")
def get_influencers_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get top influencers grouped by author name.
    Synthetic Influence Score based on volume.
    """
    
    # We will group mentions by author, count them, and return top 50.
    # We filter out empty authors.
    query = (
        select(
            Mention.author, 
            func.count(Mention.id).label('mentions_count')
        )
        .where(Mention.author != None)
        .where(Mention.author != "")
        .group_by(Mention.author)
        .order_by(desc('mentions_count'))
        .limit(50)
    )
    
    results = db.execute(query).all()
    
    if not results:
        # Fallback to source names if authors are missing
        from app.models.source import Source
        query2 = (
            select(
                Source.name.label('author'),
                func.count(Mention.id).label('mentions_count')
            )
            .join(Mention, Mention.source_id == Source.id)
            .group_by(Source.name)
            .order_by(desc('mentions_count'))
            .limit(50)
        )
        results = db.execute(query2).all()
        
    influencers = []
    for row in results:
        author = row.author
        count = row.mentions_count
        
        # Synthetic reach/engagement calculation based on volume
        reach = count * 12500 + (len(author) * 100)
        engagement = int(reach * 0.08)
        
        # Synthetic score (0-100)
        score = min(100, int((count * 10) + (reach / 10000)))
        
        influencers.append({
            "author": author,
            "mentions_count": count,
            "influence_score": score,
            "reach": reach,
            "engagement": engagement,
            "platform": "Multi-channel"
        })
        
    # Sort by synthetic score instead of just count
    influencers.sort(key=lambda x: x["influence_score"], reverse=True)
        
    return {
        "items": influencers
    }
