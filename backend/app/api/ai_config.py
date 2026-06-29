from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_superuser, get_current_active_user
from app.models.ai_config import AIModelConfig
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

def _mask_api_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    # Show only first 4 and last 4 characters
    return f"{key[:4]}...{key[-4:]}"

@router.get("/config")
def get_ai_config(
    db: Session = Depends(get_db),
    current_user: Optional = Depends(get_current_active_user)
):
    """Get the current AI configuration.
    Accessible to all authenticated users, but does not expose the raw API key.
    """
    config = db.execute(select(AIModelConfig).where(AIModelConfig.id == 1)).scalar_one_or_none()
    if not config:
        return {
            "is_configured": False,
            "is_enabled": False,
            "provider": None,
            "model_name": None,
            "base_url": None,
            "max_tokens": None,
            "temperature": None,
            "api_key_configured": False,
            "api_key_masked": None,
        }
    return {
        "is_configured": bool(config.api_key),
        "is_enabled": config.is_enabled,
        "provider": config.provider,
        "model_name": config.model_name,
        "base_url": config.base_url,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "api_key_configured": bool(config.api_key),
        "api_key_masked": _mask_api_key(config.api_key),
    }

class AIConfigUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    base_url: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    is_enabled: Optional[bool] = None

@router.put("/config")
def update_ai_config(
    payload: AIConfigUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional = Depends(get_current_superuser),
):
    """Admin‑only endpoint to update AI provider configuration.
    Blank `api_key` fields are ignored so the existing key is preserved.
    """
    config = db.execute(select(AIModelConfig).where(AIModelConfig.id == 1)).scalar_one_or_none()
    if not config:
        # Create a new config row if it does not exist
        config = AIModelConfig(id=1)
        db.add(config)
        db.flush()
    if payload.provider is not None:
        config.provider = payload.provider
    if payload.api_key is not None:
        if payload.api_key.strip():
            config.api_key = payload.api_key.strip()
        else:
            pass  # keep existing key
    if payload.model_name is not None:
        config.model_name = payload.model_name
    if payload.base_url is not None:
        config.base_url = payload.base_url
    if payload.max_tokens is not None:
        config.max_tokens = payload.max_tokens
    if payload.temperature is not None:
        config.temperature = payload.temperature
    if payload.is_enabled is not None:
        config.is_enabled = payload.is_enabled
    db.commit()
    return {"status": "success", "detail": "AI configuration updated"}
