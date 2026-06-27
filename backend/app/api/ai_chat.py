from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis

from app.services.ai_service import generate_executive_brief, analyze_mention

router = APIRouter()

@router.post("/chat")
def chat_with_brand_assistant(
    messages: List[Dict[str, str]] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    AI Brand Assistant endpoint using configured AI providers.
    Expects messages: [{"role": "user", "content": "..."}]
    """
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    
    last_message = messages[-1].get("content", "").strip()
    if not last_message:
        raise HTTPException(status_code=400, detail="Last message cannot be empty")
    
    lower_message = last_message.lower()
    
    try:
        # Use real AI for all chat interactions
        if "tổng quan" in lower_message or "summary" in lower_message or "tình hình" in lower_message:
            # Fetch real stats for context
            total = db.execute(select(func.count(Mention.id))).scalar() or 0
            neg = db.execute(select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%negative%'))).scalar() or 0
            context_prompt = f"Dựa trên dữ liệu hiện tại, thương hiệu có tổng cộng {total} mentions, trong đó có {neg} mentions tiêu cực. Hãy tóm tắt ngắn gọn tình hình thương hiệu."
            response_text = generate_executive_brief(context_prompt).get("summary_3_lines", "Không thể tóm tắt lúc này.")
            
        elif "tiêu cực" in lower_message or "khủng hoảng" in lower_message or "negative" in lower_message:
            neg_mentions = db.execute(
                select(Mention, AIAnalysis)
                .join(AIAnalysis, Mention.id == AIAnalysis.mention_id)
                .where(AIAnalysis.sentiment.like('%negative%'))
                .order_by(desc(Mention.collected_at))
                .limit(3)
            ).all()
            
            if not neg_mentions:
                response_text = "Hiện tại không có mention tiêu cực nào đáng kể. Tình hình thương hiệu đang rất ổn định!"
            else:
                context = "Dưới đây là các mention tiêu cực gần đây:\n\n"
                for m, a in neg_mentions:
                    title = m.title if m.title else "Bình luận"
                    context += f"- {title} (Rủi ro: {a.risk_score}/100): {a.summary_vi or m.content[:100]}...\n"
                context += "\nHãy phân tích và đưa ra khuyến nghị."
                response_text = generate_executive_brief(context).get("summary_3_lines", "Không thể phân tích lúc này.")
                
        elif "đối thủ" in lower_message or "competitor" in lower_message:
            context_prompt = "Dựa trên dữ liệu SoV (Share of Voice) và sentiment, hãy phân tích so sánh thương hiệu với đối thủ."
            response_text = generate_executive_brief(context_prompt).get("summary_3_lines", "Không có dữ liệu đối thủ.")
            
        elif "influencer" in lower_message or "kol" in lower_message:
            context_prompt = "Dựa trên dữ liệu influencer, hãy liệt kê và đánh giá các influencer có reach cao nhất trong tuần qua."
            response_text = generate_executive_brief(context_prompt).get("summary_3_lines", "Không có dữ liệu influencer.")
            
        else:
            # Generic response - use the last message as context for draft_response
            response_text = generate_executive_brief(last_message).get("summary_3_lines", "Xin lỗi, mình chưa hiểu rõ ý bạn.")
    
    except Exception as e:
        # Fallback to a safe message if AI fails
        response_text = f"Đã xảy ra lỗi khi xử lý yêu cầu AI: {str(e)}"
    
    return {
        "role": "assistant",
        "content": response_text
    }
