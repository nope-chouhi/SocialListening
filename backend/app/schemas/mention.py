from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.mention import SentimentScore


# Mention Schemas
class MentionBase(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    snippet: Optional[str] = None
    url: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    project_id: Optional[int] = None
    keyword_id: Optional[int] = None
    keyword_text: Optional[str] = None
    job_id: Optional[int] = None
    source_type: Optional[str] = None
    platform: Optional[str] = None
    domain: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    influence_score: Optional[float] = None
    reach_estimate: Optional[int] = None
    views_count: Optional[int] = None
    comments_count: Optional[int] = None
    likes_count: Optional[int] = None
    shares_count: Optional[int] = None
    language: Optional[str] = None
    country: Optional[str] = None
    tags_json: Optional[Any] = None
    is_muted: Optional[bool] = False
    is_deleted: Optional[bool] = False
    extraction_source: Optional[str] = None
    confidence: Optional[str] = None
    source_name: Optional[str] = None
    has_original_url: Optional[bool] = None
    source_display: Optional[str] = None


class MentionCreate(MentionBase):
    source_id: Optional[int] = None
    matched_keywords: Optional[List[Dict[str, Any]]] = None
    platform_post_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None


class MentionUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None


class MentionResponse(MentionBase):
    id: int
    source_id: Optional[int] = None
    content_hash: Optional[str] = None
    matched_keywords: Optional[List[Dict[str, Any]]] = None
    platform_post_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    collected_at: datetime
    is_reviewed: Optional[bool] = False
    
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
    job_id: Optional[int] = None
    keyword_group_id: Optional[int] = None
    search_query: Optional[str] = None
    keyword_text: Optional[str] = None
    source_type: Optional[str] = None
    sentiment: Optional[str] = None
    is_muted: Optional[bool] = None
    min_influence_score: Optional[float] = None
    min_risk_score: Optional[float] = Field(None, ge=0, le=100)
    max_risk_score: Optional[float] = Field(None, ge=0, le=100)
    crisis_level: Optional[int] = Field(None, ge=1, le=5)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class MentionListResponse(BaseModel):
    items: List[MentionWithAnalysis]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkMentionsRequest(BaseModel):
    mention_ids: List[int]


class BulkReviewRequest(BulkMentionsRequest):
    is_reviewed: bool


class BulkSentimentRequest(BulkMentionsRequest):
    sentiment: str


class ChartDataPoint(BaseModel):
    date: str
    total_mentions: int
    reach: int
    sentiment_positive: int
    sentiment_neutral: int
    sentiment_negative: int


class ChartResponse(BaseModel):
    items: List[ChartDataPoint]
    granularity: str


class BulkDeleteRequest(BaseModel):
    mention_ids: List[int]

class BulkReviewRequest(BaseModel):
    mention_ids: List[int]
    is_reviewed: bool

class BulkSentimentRequest(BaseModel):
    mention_ids: List[int]
    sentiment: str

class ChartResponse(BaseModel):
    granularity: str
    items: List[dict]
