"""
AI Chat endpoint — uses the configured AI model from ai_model_config table.
Replaces the previous simulated/hardcoded response logic.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis
from app.models.ai_config import AIModelConfig, AIChatSession, AIChatMessage, AIUsageLog
from app.schemas.ai_chat import AIChatSessionCreate, AIChatSessionResponse, AIChatSessionDetailResponse, AIChatMessageResponse, AIUsageSummary

import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ai_config(db: Session) -> Optional[AIModelConfig]:
    """Retrieve the AI model configuration from DB."""
    return db.execute(
        select(AIModelConfig).where(AIModelConfig.id == 1)
    ).scalar_one_or_none()


def _build_system_prompt(db: Session, current_user: User) -> str:
    """Build a system prompt with project context for the AI assistant."""
    # Tenant/Project scoping: In MVP, we use the user's organization context if available
    # For now, we count total verified mentions to avoid dumping unverifiable ones
    total_mentions = db.execute(
        select(func.count(Mention.id)).where(Mention.url.isnot(None))
    ).scalar() or 0
    
    neg_count = db.execute(
        select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%negative%'))
    ).scalar() or 0
    pos_count = db.execute(
        select(func.count(AIAnalysis.id)).where(AIAnalysis.sentiment.like('%positive%'))
    ).scalar() or 0

    return f"""Bạn là AI Brand Assistant của hệ thống Social Listening "Nope".
Bạn giúp phân tích dữ liệu thương hiệu, mentions, cảnh báo, đối thủ và influencer.
Trả lời bằng tiếng Việt. Trả lời chuyên nghiệp, ngắn gọn, có số liệu nếu có.

Dữ liệu hiện tại của người dùng:
- Tổng mentions (đã xác thực URL): {total_mentions}
- Mentions tiêu cực: {neg_count}
- Mentions tích cực: {pos_count}
- Tên người dùng: {current_user.email}

Nếu người dùng hỏi về dữ liệu cụ thể mà bạn không có, hãy hướng dẫn họ sử dụng các trang Mentions, Reports, hoặc Dashboard trên hệ thống.
Không bịa đặt số liệu. Chỉ dùng dữ liệu thật được cung cấp ở trên."""


def _call_ai_provider(config: AIModelConfig, messages: List[Dict[str, str]], system_prompt: str) -> Tuple[str, Dict[str, Any]]:
    """
    Call the configured AI provider with the given messages.
    Returns: (response_text, usage_dict)
    """
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    usage = {
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None
    }

    if config.provider == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=config.api_key)
        model = genai.GenerativeModel(config.model_name or "gemini-2.5-flash")

        prompt_parts = []
        for msg in full_messages:
            role_label = "System" if msg["role"] == "system" else ("User" if msg["role"] == "user" else "Assistant")
            prompt_parts.append(f"{role_label}: {msg['content']}")
        prompt_parts.append("Assistant:")

        response = model.generate_content("\n\n".join(prompt_parts))
        
        # Parse usage for Gemini if available
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            usage["prompt_tokens"] = response.usage_metadata.prompt_token_count
            usage["completion_tokens"] = response.usage_metadata.candidates_token_count
            usage["total_tokens"] = response.usage_metadata.total_token_count

        return response.text.strip(), usage

    elif config.provider == "openai" or config.provider == "custom":
        from openai import OpenAI
        client_kwargs = {"api_key": config.api_key}
        if config.provider == "custom":
            client_kwargs["base_url"] = (config.base_url or "").rstrip("/")
            
        client = OpenAI(**client_kwargs)
        response = client.chat.completions.create(
            model=config.model_name or ("gpt-4o-mini" if config.provider == "openai" else "default"),
            messages=full_messages,
            max_tokens=config.max_tokens or 2048,
            temperature=config.temperature or 0.7,
            timeout=30
        )
        
        # Parse usage for OpenAI
        if hasattr(response, 'usage') and response.usage:
            usage["prompt_tokens"] = response.usage.prompt_tokens
            usage["completion_tokens"] = response.usage.completion_tokens
            usage["total_tokens"] = response.usage.total_tokens
            
        return response.choices[0].message.content.strip(), usage

    else:
        raise ValueError(f"Unknown AI provider: {config.provider}")


def _log_usage(db: Session, config: AIModelConfig, current_user: User, 
               session_id: Optional[int], message_id: Optional[int], 
               usage: Dict[str, Any], success: bool = True, error_message: str = None):
    """Log AI token usage."""
    # Try to find org context
    org_id = None
    if hasattr(current_user, "organization_id"):
        org_id = current_user.organization_id
        
    log = AIUsageLog(
        organization_id=org_id,
        user_id=current_user.id,
        session_id=session_id,
        message_id=message_id,
        model_config_id=config.id,
        provider=config.provider,
        model=config.model_name,
        request_type="chat",
        input_tokens=usage.get("prompt_tokens"),
        output_tokens=usage.get("completion_tokens"),
        total_tokens=usage.get("total_tokens"),
        success=success,
        error_message=error_message
    )
    db.add(log)
    db.commit()


# ─── Session Management ────────────────────────────────────────────────────────

@router.get("/sessions", response_model=List[AIChatSessionResponse])
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all chat sessions for the current user."""
    sessions = db.execute(
        select(AIChatSession)
        .where(AIChatSession.user_id == current_user.id)
        .order_by(desc(AIChatSession.updated_at))
    ).scalars().all()
    return sessions


@router.post("/sessions", response_model=AIChatSessionResponse)
def create_chat_session(
    data: AIChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new chat session."""
    config = _get_ai_config(db)
    
    org_id = None
    if hasattr(current_user, "organization_id"):
        org_id = current_user.organization_id

    session = AIChatSession(
        user_id=current_user.id,
        organization_id=org_id,
        title=data.title or "New Chat",
        model_config_id=config.id if config else None
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions/{session_id}", response_model=AIChatSessionDetailResponse)
def get_chat_session_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a chat session with all its messages."""
    session = db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return session


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a chat session."""
    session = db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    db.delete(session)
    db.commit()
    return {"success": True}


# ─── Chat Messaging ────────────────────────────────────────────────────────────

@router.post("/chat")
def legacy_chat_endpoint(
    messages: List[Dict[str, str]] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Legacy chat endpoint for backward compatibility.
    Creates an ephemeral session and logs usage.
    """
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    config = _get_ai_config(db)
    if not config or not config.is_enabled or not config.api_key:
        raise HTTPException(status_code=503, detail="AI chưa được cấu hình.")

    system_prompt = _build_system_prompt(db, current_user)

    try:
        response_text, usage = _call_ai_provider(config, messages, system_prompt)
        _log_usage(db, config, current_user, None, None, usage, success=True)
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        _log_usage(db, config, current_user, None, None, {}, success=False, error_message=str(e))
        raise HTTPException(status_code=502, detail=f"Lỗi khi gọi AI: {str(e)}")

    return {
        "role": "assistant",
        "content": response_text
    }


@router.post("/sessions/{session_id}/messages", response_model=AIChatMessageResponse)
def send_message_to_session(
    session_id: int,
    message: Dict[str, str] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send a message to a session, persist it, and get AI response."""
    if "content" not in message:
        raise HTTPException(status_code=400, detail="Message content required")

    session = db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    config = _get_ai_config(db)
    if not config or not config.is_enabled or not config.api_key:
        raise HTTPException(status_code=503, detail="AI chưa được cấu hình.")

    # Auto-update title if it's the first message
    is_first_msg = not session.messages
    if is_first_msg and session.title == "New Chat":
        session.title = message["content"][:50] + ("..." if len(message["content"]) > 50 else "")

    # Save user message
    user_msg = AIChatMessage(
        session_id=session.id,
        role="user",
        content=message["content"]
    )
    db.add(user_msg)
    
    # Touch session
    session.updated_at = func.now()
    db.commit()

    # Build context and message history
    system_prompt = _build_system_prompt(db, current_user)
    
    history_msgs = []
    for msg in session.messages[-10:]:  # Keep last 10 messages for context
        if msg.role in ("user", "assistant"):
            history_msgs.append({"role": msg.role, "content": msg.content})

    try:
        response_text, usage = _call_ai_provider(config, history_msgs, system_prompt)
        
        # Save assistant message
        ast_msg = AIChatMessage(
            session_id=session.id,
            role="assistant",
            content=response_text
        )
        db.add(ast_msg)
        db.commit()
        db.refresh(ast_msg)
        
        # Log usage
        _log_usage(db, config, current_user, session.id, ast_msg.id, usage, success=True)
        
        return ast_msg

    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        _log_usage(db, config, current_user, session.id, None, {}, success=False, error_message=str(e))
        raise HTTPException(status_code=502, detail=f"Lỗi khi gọi AI: {str(e)}")


# ─── Config & Usage ────────────────────────────────────────────────────────────

@router.get("/chat/config")
def get_chat_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the current AI chat configuration status."""
    config = _get_ai_config(db)

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


@router.get("/usage", response_model=AIUsageSummary)
def get_ai_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get AI usage summary for the organization."""
    # Assuming org-level or user-level scoping
    query = select(AIUsageLog)
    if hasattr(current_user, "organization_id") and current_user.organization_id:
        query = query.where(AIUsageLog.organization_id == current_user.organization_id)
    else:
        query = query.where(AIUsageLog.user_id == current_user.id)
        
    logs = db.execute(query).scalars().all()
    
    total_reqs = len(logs)
    success_reqs = sum(1 for l in logs if l.success)
    failed_reqs = sum(1 for l in logs if not l.success)
    total_toks = sum((l.total_tokens or 0) for l in logs)
    total_cost = sum((l.estimated_cost or 0.0) for l in logs)
    
    providers = {}
    models = {}
    
    for l in logs:
        providers[l.provider] = providers.get(l.provider, 0) + 1
        models[l.model] = models.get(l.model, 0) + 1
        
    return AIUsageSummary(
        total_requests=total_reqs,
        successful_requests=success_reqs,
        failed_requests=failed_reqs,
        total_tokens=total_toks,
        estimated_cost=total_cost,
        provider_breakdown=providers,
        model_breakdown=models
    )
