from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class AIChatMessageBase(BaseModel):
    role: str
    content: str


class AIChatMessageCreate(AIChatMessageBase):
    pass


class AIChatMessageResponse(AIChatMessageBase):
    id: int
    session_id: int
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AIChatSessionBase(BaseModel):
    title: Optional[str] = None


class AIChatSessionCreate(AIChatSessionBase):
    pass


class AIChatSessionResponse(AIChatSessionBase):
    id: int
    organization_id: Optional[int] = None
    user_id: Optional[int] = None
    model_config_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AIChatSessionDetailResponse(AIChatSessionResponse):
    messages: List[AIChatMessageResponse] = []


class AIUsageSummary(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_tokens: int
    estimated_cost: float
    provider_breakdown: Dict[str, int]  # e.g., {"gemini": 10, "openai": 5}
    model_breakdown: Dict[str, int]     # e.g., {"gemini-2.5-flash": 10, "gpt-4o-mini": 5}


class AIChatRequest(BaseModel):
    messages: List[AIChatMessageCreate]
    session_id: Optional[int] = None
