from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AIModelConfigResponse(BaseModel):
    """Response schema for AI model configuration."""
    id: int
    provider: str
    api_key_masked: str = ""  # Never expose full key
    model_name: str
    base_url: Optional[str] = None
    max_tokens: int
    temperature: float
    is_enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True


class AIModelConfigUpdate(BaseModel):
    """Update schema for AI model configuration."""
    provider: str = Field(..., pattern="^(gemini|openai|custom)$")
    api_key: Optional[str] = None
    model_name: str = Field(..., min_length=1, max_length=255)
    base_url: Optional[str] = None
    max_tokens: int = Field(default=2048, ge=128, le=16384)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    is_enabled: bool = True


class AIModelTestRequest(BaseModel):
    """Request schema for testing AI provider connection."""
    provider: str = Field(..., pattern="^(gemini|openai|custom)$")
    api_key: str
    model_name: str
    base_url: Optional[str] = None


class AIModelTestResponse(BaseModel):
    """Response schema for AI provider connection test."""
    success: bool
    message: str
    response_preview: Optional[str] = None
