import json
import logging
from typing import Dict, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.ai_config import AIChatMessage
from app.models.user import User
from app.schemas.ai_chat import (
    AIChatConfigResponse,
    AIChatLegacyMessage,
    AIChatMessageRequest,
    AIChatMessageResponse,
    AIChatSendResponse,
)
from app.services.ai_assistant_service import (
    AIChatConfigError,
    call_assistant,
    ensure_chat_config,
    get_user_ai_config,
    stream_assistant_chunks,
)

logger = logging.getLogger(__name__)
router = APIRouter()
AI_PROVIDER_ERROR_DETAIL = "AI provider call failed. Please check AI configuration or try again later."


def _to_response(message: AIChatMessage) -> AIChatMessageResponse:
    return AIChatMessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        provider=message.provider,
        model=message.model,
        used_tools=message.used_tools or [],
        error_message=message.error_message,
        created_at=message.created_at,
    )


def _chat_scope(user: User) -> List:
    org_id = getattr(user, "current_organization_id", None)
    filters = [AIChatMessage.user_id == user.id]
    if org_id is None:
        filters.append(AIChatMessage.organization_id.is_(None))
    else:
        filters.append(AIChatMessage.organization_id == org_id)
    return filters


def _history_for_provider(db: Session, user: User) -> List[Dict[str, str]]:
    rows = db.execute(
        select(AIChatMessage)
        .where(*_chat_scope(user))
        .order_by(AIChatMessage.created_at.desc(), AIChatMessage.id.desc())
        .limit(12)
    ).scalars().all()
    return [
        {"role": row.role, "content": row.content}
        for row in reversed(rows)
        if row.role in ("user", "assistant")
    ]


@router.get("/chat/history", response_model=List[AIChatMessageResponse])
def get_chat_history(
    limit: int = 80,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    limit = max(1, min(limit, 200))
    rows = db.execute(
        select(AIChatMessage)
        .where(*_chat_scope(current_user))
        .order_by(AIChatMessage.created_at.desc(), AIChatMessage.id.desc())
        .limit(limit)
    ).scalars().all()
    return [_to_response(row) for row in reversed(rows)]


@router.delete("/chat/history")
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    rows = db.execute(
        select(AIChatMessage).where(*_chat_scope(current_user))
    ).scalars().all()
    for row in rows:
        db.delete(row)
    db.commit()
    return {"status": "success", "deleted": len(rows)}


@router.post("/chat/send", response_model=AIChatSendResponse)
def send_chat_message(
    payload: AIChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        config = ensure_chat_config(get_user_ai_config(db, current_user.id))
        user_message = AIChatMessage(
            organization_id=getattr(current_user, "current_organization_id", None),
            user_id=current_user.id,
            role="user",
            content=payload.message,
        )
        db.add(user_message)
        db.flush()

        history = _history_for_provider(db, current_user)
        result = call_assistant(db, current_user, config, payload.message.strip(), history)
        assistant_message = AIChatMessage(
            organization_id=getattr(current_user, "current_organization_id", None),
            user_id=current_user.id,
            role="assistant",
            content=result.content,
            provider=result.provider,
            model=result.model,
            used_tools=result.used_tools,
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(user_message)
        db.refresh(assistant_message)
    except AIChatConfigError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.error("AI assistant chat failed: %s", exc)
        raise HTTPException(status_code=502, detail=AI_PROVIDER_ERROR_DETAIL)

    return AIChatSendResponse(
        user_message=_to_response(user_message),
        assistant_message=_to_response(assistant_message),
        used_tools=result.used_tools,
    )


@router.post("/chat/stream")
def stream_chat_message(
    payload: AIChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        config = ensure_chat_config(get_user_ai_config(db, current_user.id))
    except AIChatConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    user_message = AIChatMessage(
        organization_id=getattr(current_user, "current_organization_id", None),
        user_id=current_user.id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    history = _history_for_provider(db, current_user)

    def event_stream():
        full_text = ""
        used_tools: List[str] = []
        provider = config.provider
        model = config.model_name
        try:
            chunks, used_tools, provider, model = stream_assistant_chunks(
                db, current_user, config, payload.message.strip(), history
            )
            yield f"event: meta\ndata: {json.dumps({'used_tools': used_tools, 'provider': provider, 'model': model})}\n\n"
            for chunk in chunks:
                full_text += chunk
                yield f"event: chunk\ndata: {json.dumps({'content': chunk})}\n\n"
            assistant_message = AIChatMessage(
                organization_id=getattr(current_user, "current_organization_id", None),
                user_id=current_user.id,
                role="assistant",
                content=full_text,
                provider=provider,
                model=model,
                used_tools=used_tools,
            )
            db.add(assistant_message)
            db.commit()
            db.refresh(assistant_message)
            yield f"event: done\ndata: {json.dumps({'id': assistant_message.id})}\n\n"
        except Exception as exc:
            db.rollback()
            logger.error("AI assistant stream failed: %s", exc)
            yield f"event: error\ndata: {json.dumps({'detail': AI_PROVIDER_ERROR_DETAIL})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/chat")
def chat_with_brand_assistant(
    messages: List[AIChatLegacyMessage] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Backward-compatible stateless endpoint used by older frontend builds."""
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")
    last_user = next((m for m in reversed(messages) if m.role == "user"), None)
    if not last_user:
        raise HTTPException(status_code=400, detail="A user message is required")
    history = [{"role": m.role, "content": m.content} for m in messages[:-1] if m.role in ("user", "assistant")]
    try:
        config = ensure_chat_config(get_user_ai_config(db, current_user.id))
        result = call_assistant(db, current_user, config, last_user.content, history)
    except AIChatConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("AI chat error (%s/%s): %s", config.provider, config.model_name, exc)
        raise HTTPException(status_code=502, detail=AI_PROVIDER_ERROR_DETAIL)
    return {"role": "assistant", "content": result.content, "used_tools": result.used_tools}


@router.get("/chat/config", response_model=AIChatConfigResponse)
def get_chat_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    config = get_user_ai_config(db, current_user.id)
    if not config:
        return AIChatConfigResponse(
            is_configured=False,
            is_enabled=False,
            provider=None,
            model_name=None,
            capabilities={
                "history": True,
                "streaming": True,
                "system_data_tools": True,
                "tool_calling": "deterministic_system_context",
            },
        )
    return AIChatConfigResponse(
        is_configured=bool(config.api_key),
        is_enabled=config.is_enabled,
        provider=config.provider,
        model_name=config.model_name,
        capabilities={
            "history": True,
            "streaming": True,
            "system_data_tools": True,
            "tool_calling": "deterministic_system_context",
        },
    )
