from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention
from app.models.incident import Incident
from app.services.ai_service import generate_executive_brief as ai_generate_executive_brief
from app.services.sentiment_client import analyze_sentiment
from pydantic import BaseModel

router = APIRouter()


class SentimentRequest(BaseModel):
    text: str


@router.post("/sentiment")
def analyze_text_sentiment(
    body: SentimentRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Analyze sentiment via DistilBERT microservice (or neutral fallback)."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    return analyze_sentiment(body.text)

@router.post("/generate-brief")
def generate_executive_brief_api(
    mention_ids: Optional[List[int]] = Body(None),
    incident_id: Optional[int] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate an executive brief for a list of mentions or a specific incident.
    Returns 3 formats: 3-line summary, Zalo-style brief, full brief.
    """
    if not mention_ids and not incident_id:
        raise HTTPException(status_code=400, detail="Must provide mention_ids or incident_id")
        
    content_to_analyze = ""
    
    if incident_id:
        incident = db.execute(select(Incident).where(Incident.id == incident_id)).scalar_one_or_none()
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
            
        content_to_analyze += f"Vụ việc: {incident.title}\n"
        content_to_analyze += f"Mô tả: {incident.description or 'Không có'}\n"
        content_to_analyze += f"Trạng thái: {incident.status}\n\n"
        
        if incident.mention_id:
            mention = db.execute(select(Mention).where(Mention.id == incident.mention_id)).scalar_one_or_none()
            if mention:
                content_to_analyze += f"Nội dung gốc: {mention.content}\n"
                
    elif mention_ids:
        mentions = db.execute(select(Mention).where(Mention.id.in_(mention_ids))).scalars().all()
        if not mentions:
            raise HTTPException(status_code=404, detail="No mentions found")
            
        for m in mentions:
            content_to_analyze += f"Tiêu đề: {m.title}\nNội dung: {m.content}\n\n"
            
    # Call AI Provider manager wrapper
    try:
        return ai_generate_executive_brief(content_to_analyze)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
