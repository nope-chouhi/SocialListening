from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.report import ReportType, ReportStatus, ExportStatus

# Report Export Schemas
class ReportExportResponse(BaseModel):
    id: int
    report_type: str
    project_id: Optional[int]
    requested_by: int
    status: ExportStatus
    file_path: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        orm_mode = True

class ReportBuilderConfig(BaseModel):
    date_range: Optional[str] = "30d"
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    sections: Optional[List[Dict[str, Any]]] = None
    accent_color: Optional[str] = "#6366f1"
    font_style: Optional[str] = "font-sans"
    font_color: Optional[str] = "#1e293b"
    theme: Optional[str] = "light"
    logo_path: Optional[str] = None

class ReportExportListResponse(BaseModel):
    items: List[ReportExportResponse]
    total: int
    page: int
    page_size: int
    total_pages: int



# Report Schemas
class ReportBase(BaseModel):
    report_type: ReportType
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime


class ReportCreate(ReportBase):
    pass


class ReportResponse(ReportBase):
    id: int
    status: ReportStatus
    data: Optional[Dict[str, Any]]
    pdf_path: Optional[str]
    excel_path: Optional[str]
    json_path: Optional[str]
    generated_by: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    email_sent: bool
    email_recipients: Optional[str]
    email_sent_at: Optional[datetime]
    
    class Config:
        orm_mode = True


class ReportFilter(BaseModel):
    report_type: Optional[ReportType] = None
    status: Optional[ReportStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReportListResponse(BaseModel):
    items: List[ReportResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Dashboard Schemas
class DashboardMetrics(BaseModel):
    total_mentions_today: int = 0
    total_mentions_week: int = 0
    total_mentions_month: int = 0
    open_incidents: int = 0
    overdue_incidents: int = 0
    critical_alerts: int = 0
    high_alerts: int = 0
    avg_risk_score: float = 0.0


class SentimentDistribution(BaseModel):
    positive: int = 0
    neutral: int = 0
    negative_low: int = 0
    negative_medium: int = 0
    negative_high: int = 0


class RiskDistribution(BaseModel):
    low: int = 0  # 0-25
    medium: int = 0  # 26-50
    high: int = 0  # 51-75
    critical: int = 0  # 76-100


class TopRiskySource(BaseModel):
    source_id: int
    source_name: str
    mention_count: int
    avg_risk_score: float


class TopRiskyMention(BaseModel):
    mention_id: int
    title: Optional[str]
    content_snippet: str
    risk_score: float
    crisis_level: int
    published_at: Optional[datetime]


class MentionTrend(BaseModel):
    date: str
    count: int
    positive: int = 0
    neutral: int = 0
    negative: int = 0


class DashboardResponse(BaseModel):
    metrics: DashboardMetrics
    sentiment_distribution: SentimentDistribution
    risk_distribution: RiskDistribution
    mention_trends: List[MentionTrend]
    top_risky_sources: List[TopRiskySource]
    top_risky_mentions: List[TopRiskyMention]


# System Settings Schemas
class SystemSettingBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=255)
    value: str
    value_type: str = Field("string", pattern="^(string|int|float|bool|json)$")
    description: Optional[str] = None
    is_public: bool = False


class SystemSettingCreate(SystemSettingBase):
    pass


class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


class SystemSettingResponse(SystemSettingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

