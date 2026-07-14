# Import only essential models to avoid circular dependencies
from app.core.database import Base

# User models
from app.models.user import User

# Keyword models  
from app.models.keyword import Keyword, KeywordGroup, KeywordType, LogicOperator

# Source models
from app.models.source import Source, SourceGroup, SourceType

# Mention models
from app.models.mention import Mention, AIAnalysis, SentimentScore

# Alert models
from app.models.alert import Alert, AlertSeverity, AlertStatus, NotificationChannel, NotificationDeliveryLog

# Incident models
from app.models.incident import (
    Incident, IncidentStatus, TakedownStatus, TakedownPlatform,
    IncidentLog, EvidenceFile, TakedownRequest, ResponseTemplate
)

# Crawl models
from app.models.crawl import CrawlJob, ScanSchedule, CrawlJobStatus

# Report models
from app.models.report import Report, ReportType, ReportStatus, ReportExport, ExportStatus

# Saved filter models
from app.models.saved_filter import SavedFilter

# Service models
from app.models.service import (
    ServiceCategory, Service, ServiceRequest, ServiceRequestLog, ServiceDeliverable,
    ServiceType, Platform, RiskLevel, ServiceRequestStatus, ApprovalStatus, Priority, DeliverableType
)

# Reputation models
from app.models.reputation import (
    ReputationCase, ReputationEvidence, ReputationAction,
    ReputationCaseType, ReputationCaseStatus,
    ReputationActionType, ReputationActionStatus
)

# RBAC models
from app.models.rbac import Role, UserRole, APIKey, BrandingSettings, AuditLog

# User settings models
from app.models.user_settings import UserPreferences, UserNotificationSettings, UserSession

# System settings models
from app.models.system_settings import OrganizationSettings, EmailSettings, SystemNotificationSettings

# Discovery models
from app.models.discovery import (
    DiscoveryJob, DiscoveryJobStatus, DiscoveredSource, DiscoveredSourceStatus,
    BlockedDomain, RecommendedMonitoringType
)

# Integration models
from app.models.integration import SocialIntegration, SocialIntegrationAccount, OAuthState

# Organization and Team models
from app.models.organization import Organization, OrganizationMember
from app.models.team import Team, TeamMember

# Billing and Plan models
from app.models.billing import Plan, OrganizationPlan, UsageEvent

__all__ = [
    "Base",
    "User",
    "Keyword", "KeywordGroup", "KeywordType", "LogicOperator",
    "Source", "SourceGroup", "SourceType",
    "Mention", "AIAnalysis", "SentimentScore",
    "Alert", "AlertSeverity", "AlertStatus", "NotificationChannel", "NotificationDeliveryLog",
    "Incident", "IncidentStatus", "TakedownStatus", "TakedownPlatform",
    "IncidentLog", "EvidenceFile", "TakedownRequest", "ResponseTemplate",
    "CrawlJob", "ScanSchedule", "CrawlJobStatus",
    "Report", "ReportType", "ReportStatus", "ReportExport", "ExportStatus",
    "SavedFilter",
    "ServiceCategory", "Service", "ServiceRequest", "ServiceRequestLog", "ServiceDeliverable",
    "ServiceType", "Platform", "RiskLevel", "ServiceRequestStatus", "ApprovalStatus", "Priority", "DeliverableType",
    "Role", "UserRole", "APIKey", "BrandingSettings", "AuditLog",
    "UserPreferences", "UserNotificationSettings", "UserSession",
    "OrganizationSettings", "EmailSettings", "SystemNotificationSettings",
    "ReputationCase", "ReputationEvidence", "ReputationAction",
    "ReputationCaseType", "ReputationCaseStatus",
    "ReputationActionType", "ReputationActionStatus",
    "DiscoveryJob", "DiscoveryJobStatus", "DiscoveredSource", "DiscoveredSourceStatus",
    "BlockedDomain", "RecommendedMonitoringType",
    "SocialIntegration", "SocialIntegrationAccount", "OAuthState",
    "SocialIntegration", "SocialIntegrationAccount", "OAuthState",
    "Organization", "OrganizationMember", "Team", "TeamMember",
    "Plan", "OrganizationPlan", "UsageEvent",
]


from app.models.source_item import SourceItem

# Webinar models
from app.models.webinar import WebinarRegistration

# AI Config models
from app.models.ai_config import AIModelConfig, AIUsageLog, AIChatMessage

