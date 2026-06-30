"""
AI Chat endpoint — uses the configured AI model from ai_model_config table.
Replaces the previous simulated/hardcoded response logic.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.ai_config import AIModelConfig

import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ai_config(db: Session, user_id: int) -> Optional[AIModelConfig]:
    """Retrieve the AI model configuration from DB for the specific user."""
    try:
        return db.execute(
            select(AIModelConfig).where(AIModelConfig.user_id == user_id)
        ).scalar_one_or_none()
    except Exception:
        db.rollback()
        return None


def _build_system_prompt(db: Session, current_user: User, config: Optional[AIModelConfig] = None) -> str:
    """Build a system prompt with project context for the AI assistant."""
    total_mentions = db.execute(select(func.count(Mention.id))).scalar() or 0
    neg_count = db.execute(
        select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%negative%'))
    ).scalar() or 0
    pos_count = db.execute(
        select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%positive%'))
    ).scalar() or 0

    # Use custom system_prompt from config if available
    custom_prompt = ""
    if config and getattr(config, 'system_prompt', None):
        custom_prompt = config.system_prompt + "\n\n"

    default_prompt = f"""Bạn là AI Brand Assistant của hệ thống Social Listening "Nope".
Bạn giúp phân tích dữ liệu thương hiệu, mentions, cảnh báo, đối thủ và influencer.
Trả lời bằng tiếng Việt. Trả lời chuyên nghiệp, ngắn gọn, có số liệu nếu có.

Dữ liệu hiện tại của người dùng:
- Tổng mentions: {total_mentions}
- Mentions tiêu cực: {neg_count}
- Mentions tích cực: {pos_count}
- Tên người dùng: {current_user.email}

Nếu người dùng hỏi về dữ liệu cụ thể mà bạn không có, hãy hướng dẫn họ sử dụng các trang Mentions, Reports, hoặc Dashboard trên hệ thống.
Không bịa đặt số liệu. Chỉ dùng dữ liệu thật được cung cấp ở trên."""

    return custom_prompt + default_prompt


def _call_ai_provider(config: AIModelConfig, messages: List[Dict[str, str]], system_prompt: str) -> str:
    """Call the configured AI provider with the given messages."""
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    if config.provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=config.api_key)
        model = genai.GenerativeModel(config.model_name or "gemini-2.5-flash")

        # Gemini uses a different format — convert messages to a single prompt
        prompt_parts = []
        for msg in full_messages:
            role_label = "System" if msg["role"] == "system" else ("User" if msg["role"] == "user" else "Assistant")
            prompt_parts.append(f"{role_label}: {msg['content']}")
        prompt_parts.append("Assistant:")

        response = model.generate_content("\n\n".join(prompt_parts))
        return response.text.strip()

    elif config.provider == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=config.api_key)
        response = client.chat.completions.create(
            model=config.model_name or "gpt-4o-mini",
            messages=full_messages,
            max_tokens=config.max_tokens or 2048,
            temperature=config.temperature or 0.7,
            timeout=30
        )
        return response.choices[0].message.content.strip()

    elif config.provider == "custom":
        from openai import OpenAI
        client = OpenAI(
            api_key=config.api_key,
            base_url=(config.base_url or "").rstrip("/")
        )
        response = client.chat.completions.create(
            model=config.model_name or "default",
            messages=full_messages,
            max_tokens=config.max_tokens or 2048,
            temperature=config.temperature or 0.7,
            timeout=30
        )
        return response.choices[0].message.content.strip()

    else:
        raise ValueError(f"Unknown AI provider: {config.provider}")


@router.post("/chat")
def chat_with_brand_assistant(
    messages: List[Dict[str, str]] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Real AI Brand Assistant endpoint.
    Uses the configured AI model from the ai_model_config table.
    """
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    # Get AI configuration
    config = _get_ai_config(db, current_user.id)

    if not config or not config.is_enabled or not config.api_key:
        raise HTTPException(
            status_code=503,
            detail="AI chưa được cấu hình. Vui lòng liên hệ quản trị viên để thiết lập model AI trong phần Cài đặt."
        )

    # Build system prompt with project context
    system_prompt = _build_system_prompt(db, current_user, config)

    try:
        response_text = _call_ai_provider(config, messages, system_prompt)
    except Exception as e:
        logger.error(f"AI chat error ({config.provider}/{config.model_name}): {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=f"Lỗi khi gọi AI ({config.provider}): {str(e)}"
        )

    return {
        "role": "assistant",
        "content": response_text
    }


@router.get("/chat/config")
def get_chat_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the current AI chat configuration status.
    Available to all authenticated users (not admin-only).
    """
    config = _get_ai_config(db, current_user.id)

    if not config:
        return {
            "is_configured": False,
            "is_enabled": False,
            "provider": None,
            "model_name": None,
        }

    return {
        "is_configured": bool(config.api_key),
        "is_enabled": config.is_enabled,
        "provider": config.provider,
        "model_name": config.model_name,
    }
