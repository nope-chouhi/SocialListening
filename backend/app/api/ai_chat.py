from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis

import time
import json
import random

router = APIRouter()

@router.post("/chat")
def chat_with_brand_assistant(
    messages: List[Dict[str, str]] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Simulated AI Brand Assistant endpoint.
    Expects messages: [{"role": "user", "content": "..."}]
    """
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
        
    last_message = messages[-1].get("content", "").lower()
    
    # Simple simulated logic based on keywords
    response_text = ""
    
    if "chào" in last_message or "hello" in last_message or "hi" in last_message:
        response_text = "Chào bạn! Mình là AI Brand Assistant của hệ thống Social Listening. Mình có thể phân tích dữ liệu Mentions, Cảnh báo, Đối thủ và Influencer. Bạn cần hỗ trợ gì hôm nay?"
        
    elif "giúp" in last_message or "help" in last_message:
        response_text = "Mình sẵn sàng giúp đỡ. Bạn có thể yêu cầu:\n- Tổng quan tình hình\n- Phân tích tiêu cực\n- Đánh giá Influencer\n- Tình hình đối thủ"
        
    elif "tổng quan" in last_message or "summary" in last_message or "tình hình" in last_message:
        # Fetch some real stats to make it look authentic
        total = db.execute(select(func.count(Mention.id))).scalar() or 0
        neg = db.execute(select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%negative%'))).scalar() or 0
        response_text = f"Dựa trên dữ liệu hiện tại, tôi thấy thương hiệu của bạn đang có tổng cộng {total} lượt nhắc đến (mentions). Trong đó, có {neg} lượt nhắc đến mang sắc thái tiêu cực cần lưu ý. Bạn có muốn tôi phân tích sâu hơn về các mention tiêu cực này không?"
        
    elif "tiêu cực" in last_message or "khủng hoảng" in last_message or "negative" in last_message:
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
            response_text = "Dưới đây là một số mention tiêu cực đáng chú ý gần đây:\n\n"
            for m, a in neg_mentions:
                title = m.title if m.title else "Bình luận"
                response_text += f"- **{title}** (Rủi ro: {a.risk_score}/100): {a.summary_vi or m.content[:100]}...\n"
            response_text += "\nKhuyến nghị: Đội CSKH nên phản hồi ngay lập tức để xoa dịu."
            
    elif "đối thủ" in last_message or "competitor" in last_message:
        response_text = "Theo dữ liệu SoV (Share of Voice), thương hiệu của bạn đang giữ khoảng 45% thị phần thảo luận so với Đối thủ A (30%) và Đối thủ B (25%). Điểm tích cực là sentiment của bạn cao hơn đối thủ 15%."
        
    elif "influencer" in last_message or "kol" in last_message:
        response_text = "Trong tuần qua, các Influencer mang lại nhiều reach nhất cho bạn là:\n1. Tech Reviewer VN (Reach: 45K, Sắc thái: Tích cực)\n2. Beauty Blogger A (Reach: 32K, Sắc thái: Trung tính)\n\nHọ rất phù hợp cho chiến dịch tiếp theo."
        
    else:
        # Generic response
        fallbacks = [
            "Xin lỗi, mình chưa hiểu rõ ý bạn. Bạn có muốn xem Báo cáo tổng quan hay Kiểm tra Mentions tiêu cực không?",
            "Hiện tại mình chỉ tập trung phân tích dữ liệu Social Listening. Bạn có thể hỏi mình về: Đối thủ, Khủng hoảng, hoặc Influencers nhé.",
            "Hmm, câu hỏi này hơi ngoài vùng dữ liệu của mình. Bạn có thể thử hỏi về 'Tóm tắt tình hình' hoặc 'Thảo luận tiêu cực' xem sao?",
            "Mình là AI Brand Assistant. Bạn có thể yêu cầu mình:\n- Tóm tắt tình hình thương hiệu\n- Phân tích khủng hoảng / thảo luận tiêu cực\n- So sánh đối thủ\n- Đánh giá Influencers"
        ]
        response_text = random.choice(fallbacks)

    # Simulate network/thinking delay
    time.sleep(1.5)
    
    return {
        "role": "assistant",
        "content": response_text
    }
