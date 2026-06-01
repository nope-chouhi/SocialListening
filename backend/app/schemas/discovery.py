"""
Pydantic schemas for Auto Discovery endpoints.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ─── Discovery Job ─────────────────────────────────────────────────────────────

class DiscoveryJobCreate(BaseModel):
    keyword_group_id: Optional[int] = None
    keywords: List[str] = Field(..., min_items=1)
    exclude_keywords: List[str] = []
    language: str = "vi"
    country: str = "vn"
    limit: int = Field(20, ge=1, le=100)
    date_range: str = "last_30_days"


class DiscoveryJobResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    keyword_group_id: Optional[int] = None
    status: str
    query_keywords: Optional[List[str]] = None
    exclude_keywords: Optional[List[str]] = None
    language: str = "vi"
    country: str = "vn"
    date_range: str = "last_30_days"
    limit: int = 20
    providers_used_json: Optional[List[str]] = None
    urls_found: int = 0
    pages_scanned: int = 0
    mentions_created: int = 0
    candidate_sources_created: int = 0
    candidate_sources_updated: int = 0
    rss_feeds_detected: int = 0
    valid_rss_feeds: int = 0
    duplicates_skipped: int = 0
    blocked_domains_skipped: int = 0
    failed_items: int = 0
    error_message: Optional[str] = None
    created_by_user_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class DiscoveryJobListResponse(BaseModel):
    items: List[DiscoveryJobResponse]
    total: int


class DiscoveryJobStartResponse(BaseModel):
    success: bool
    job_id: int
    status: str
    message: str


# ─── Discovered Source ─────────────────────────────────────────────────────────

class DiscoveredSourceResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    discovery_job_id: Optional[int] = None
    source_name: Optional[str] = None
    domain: str
    homepage_url: Optional[str] = None
    url: Optional[str] = None
    source_type: Optional[str] = None
    platform: Optional[str] = None
    recommended_monitoring_type: Optional[str] = None
    rss_feed_url: Optional[str] = None
    rss_valid: bool = False
    rss_last_checked_at: Optional[datetime] = None
    rss_error: Optional[str] = None
    sample_url: Optional[str] = None
    sample_mentions_count: int = 0
    matched_keywords_json: Optional[List[str]] = None
    relevance_score: float = 0.0
    relevance_reason: Optional[str] = None
    status: str = "candidate"
    blocked_reason: Optional[str] = None
    approved_source_id: Optional[int] = None
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class DiscoveredSourceListResponse(BaseModel):
    items: List[DiscoveredSourceResponse]
    total: int


class ApproveSourceRequest(BaseModel):
    name: Optional[str] = None  # Override source name if desired


class BlockSourceRequest(BaseModel):
    reason: Optional[str] = None


# ─── Connector Status ──────────────────────────────────────────────────────────

class ConnectorStatusResponse(BaseModel):
    name: str
    key: str
    status: str  # active, config_required, not_integrated
    status_label: str  # Vietnamese
    description: Optional[str] = None
