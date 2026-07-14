from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class AIChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)

    @validator("message")
    def message_must_have_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be empty")
        if len(value) > 8000:
            raise ValueError("Message is too long")
        return value

    class Config:
        extra = "forbid"


class AIChatLegacyMessage(BaseModel):
    role: str
    content: str


class AIChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    provider: Optional[str] = None
    model: Optional[str] = None
    used_tools: List[str] = []
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AIChatSendResponse(BaseModel):
    user_message: AIChatMessageResponse
    assistant_message: AIChatMessageResponse
    used_tools: List[str] = []


class AIChatConfigResponse(BaseModel):
    is_configured: bool
    is_enabled: bool
    provider: Optional[str] = None
    model_name: Optional[str] = None
    capabilities: Dict[str, Any]
