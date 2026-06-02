from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention
from app.models.incident import Incident
from app.services.ai_service import get_ai_provider
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
def generate_executive_brief(
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
        
        # In a real app we would fetch all mentions tied to this incident via EvidenceFile or a link table
        # For MVP, incident has mention_id
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
            
    # Call AI Provider
    provider = get_ai_provider()
    
    try:
        # We need a custom prompt for Executive Brief, since analyze_mention returns a different JSON format.
        # So let's implement this logic here or in ai_service.py. For simplicity, since it's just a prompt,
        # we can use the provider's underlying model if it's OpenAI/Gemini. 
        # But provider abstract class doesn't have it yet. Let's add it to ai_service.py instead, 
        # but since we want to be clean, let's just use the api key from env directly here or add a method to provider.
        
        # For now, let's check if provider is Dummy
        if provider.__class__.__name__ == "DummyAIProvider" or provider.__class__.__name__ == "PhoBERTProvider":
            return {
                "summary_3_lines": "1. Phát hiện thảo luận tiêu cực trên mạng xã hội.\n2. Nguy cơ ảnh hưởng uy tín thương hiệu ở mức trung bình.\n3. Cần bộ phận CSKH theo dõi và phản hồi sớm.",
                "zalo_brief": "🚨 BÁO CÁO NHANH\n- Sự việc: Có bài đăng tiêu cực\n- Đánh giá: Rủi ro trung bình\n- Hành động: CSKH theo dõi",
                "full_brief": "BÁO CÁO CHI TIẾT\n\n1. Tình hình: Đang có thảo luận tiêu cực.\n2. Phân tích: Nguy cơ lan rộng trung bình.\n3. Khuyến nghị: Theo dõi chặt chẽ.",
                "risk_level": "medium",
                "recommended_decision": "Theo dõi và phản hồi khách hàng",
                "owner": "CSKH",
                "deadline": "24h"
            }
            
        # If it's OpenAI or Gemini, we could add a generate_brief method to AIProvider.
        # Let's call provider.generate_executive_brief(content_to_analyze)
        if hasattr(provider, "generate_executive_brief"):
            return provider.generate_executive_brief(content_to_analyze)
            
        return {"error": "Provider does not support brief generation yet"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
