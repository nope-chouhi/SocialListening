from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.mention import SentimentScore


# Mention Schemas
class MentionBase(BaseModel):
    title: Optional[str] = None
    content: str
    url: str
    author: Optional[str] = None
    published_at: Optional[datetime] = None


class MentionCreate(MentionBase):
    source_id: int
    matched_keywords: Optional[List[Dict[str, Any]]] = None
    platform_post_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MentionUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None


class MentionResponse(MentionBase):
    id: int
    source_id: int
    content_hash: str
    matched_keywords: Optional[List[Dict[str, Any]]]
    platform_post_id: Optional[str]
    metadata: Optional[Dict[str, Any]]
    collected_at: datetime
    
    class Config:
        orm_mode = True


class MentionWithAnalysis(MentionResponse):
    ai_analysis: Optional["AIAnalysisResponse"] = None


class AIAnalysisBase(BaseModel):
    sentiment: SentimentScore
    risk_score: float = Field(..., ge=0, le=100)
    crisis_level: int = Field(..., ge=1, le=5)
    summary_vi: Optional[str] = None
    suggested_action: Optional[str] = None
    responsible_department: Optional[str] = None
    urgency: Optional[str] = None
    response_type: Optional[str] = None
    recommended_owner: Optional[str] = None
    deadline_suggestion: Optional[str] = None
    escalation_needed: Optional[bool] = False
    why_it_matters: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0, le=100)


class AIAnalysisCreate(AIAnalysisBase):
    mention_id: int
    reasoning: Optional[str] = None
    ai_provider: str
    model_version: Optional[str] = None
    processing_time_ms: Optional[int] = None


class AIAnalysisResponse(AIAnalysisBase):
    id: int
    mention_id: int
    ai_provider: str
    model_version: Optional[str]
    processing_time_ms: Optional[int]
    analyzed_at: datetime
    
    class Config:
        orm_mode = True


# Search and Filter
class MentionFilter(BaseModel):
    source_id: Optional[int] = None
    keyword_group_id: Optional[int] = None
    sentiment: Optional[SentimentScore] = None
    min_risk_score: Optional[float] = Field(None, ge=0, le=100)
    max_risk_score: Optional[float] = Field(None, ge=0, le=100)
    crisis_level: Optional[int] = Field(None, ge=1, le=5)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search_query: Optional[str] = None


class MentionListResponse(BaseModel):
    items: List[MentionWithAnalysis]
    total: int
    page: int
    page_size: int
    total_pages: int

