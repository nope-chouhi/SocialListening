from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.crawl import CrawlJobStatus


# Crawl Job Schemas
class CrawlJobBase(BaseModel):
    job_type: str = Field(..., pattern="^(manual|scheduled)$")
    source_ids: Optional[List[int]] = []
    keyword_group_ids: Optional[List[int]] = None
    mode: Optional[str] = "HYBRID"


class CrawlJobCreate(CrawlJobBase):
    pass


class CrawlJobResponse(CrawlJobBase):
    id: int
    status: CrawlJobStatus
    total_sources: int
    processed_sources: int
    mentions_found: int
    error_message: Optional[str]
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    metadata: Optional[Dict[str, Any]]
    
    class Config:
        orm_mode = True


class CrawlJobFilter(BaseModel):
    status: Optional[CrawlJobStatus] = None
    job_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class CrawlJobListResponse(BaseModel):
    items: List[CrawlJobResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Scan Schedule Schemas
class ScanScheduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    cron_expression: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field("Asia/Ho_Chi_Minh", min_length=1, max_length=50)
    source_group_ids: Optional[List[int]] = None
    keyword_group_ids: Optional[List[int]] = None
    is_active: bool = True


class ScanScheduleCreate(ScanScheduleBase):
    pass


class ScanScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    cron_expression: Optional[str] = Field(None, min_length=1, max_length=100)
    timezone: Optional[str] = Field(None, min_length=1, max_length=50)
    source_group_ids: Optional[List[int]] = None
    keyword_group_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None


class ScanScheduleResponse(ScanScheduleBase):
    id: int
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        orm_mode = True

class CapabilityStatus(BaseModel):
    enabled: bool
    configured: bool
    status: str
    message: Optional[str] = None

class WebSearchCapabilityStatus(CapabilityStatus):
    provider: str

class ScanCapabilitiesResponse(BaseModel):
    web_search: WebSearchCapabilityStatus
    auto_discovery: CapabilityStatus
