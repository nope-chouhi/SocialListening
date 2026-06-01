"""
Auto Discovery Models for Nope Social Listening Platform.
Tables created via Base.metadata.create_all() — no alembic migration required.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


# ─── Enums ─────────────────────────────────────────────────────────────────────

class DiscoveryJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL_FAILED = "partial_failed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DiscoveredSourceStatus(str, Enum):
    CANDIDATE = "candidate"
    APPROVED = "approved"
    AUTO_ADDED = "auto_added"
    REJECTED = "rejected"
    BLOCKED = "blocked"
    DUPLICATE = "duplicate"
    INVALID = "invalid"


class RecommendedMonitoringType(str, Enum):
    RSS = "rss"
    WEBSITE = "website"
    MANUAL_URL = "manual_url"
    UNSUPPORTED = "unsupported"
    BLOCKED = "blocked"


# ─── DiscoveryJob ──────────────────────────────────────────────────────────────

class DiscoveryJob(Base):
    __tablename__ = "discovery_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    keyword_group_id = Column(Integer, nullable=True, index=True)

    # Status
    status = Column(
        SQLEnum(DiscoveryJobStatus, values_callable=lambda x: [e.value for e in x]),
        default=DiscoveryJobStatus.QUEUED,
        nullable=False,
        index=True,
    )

    # Input
    query_keywords = Column(JSON)  # list of keyword strings
    exclude_keywords = Column(JSON)  # list of exclude keyword strings
    language = Column(String(10), default="vi")
    country = Column(String(10), default="vn")
    date_range = Column(String(50), default="last_30_days")
    limit = Column(Integer, default=20)

    # Providers
    providers_used_json = Column(JSON)  # e.g. ["serpapi"]

    # Results
    urls_found = Column(Integer, default=0)
    pages_scanned = Column(Integer, default=0)
    mentions_created = Column(Integer, default=0)
    candidate_sources_created = Column(Integer, default=0)
    candidate_sources_updated = Column(Integer, default=0)
    rss_feeds_detected = Column(Integer, default=0)
    valid_rss_feeds = Column(Integer, default=0)
    duplicates_skipped = Column(Integer, default=0)
    blocked_domains_skipped = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    error_message = Column(Text)

    # User
    created_by_user_id = Column(Integer, nullable=True, index=True)

    # Timestamps
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ─── DiscoveredSource ──────────────────────────────────────────────────────────

class DiscoveredSource(Base):
    __tablename__ = "discovered_sources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    discovery_job_id = Column(Integer, nullable=True, index=True)

    # Source info
    source_name = Column(String(500))
    domain = Column(String(500), nullable=False, index=True)
    homepage_url = Column(Text)
    url = Column(Text)  # best sample URL
    source_type = Column(String(50))  # news, blog, forum, website, unknown
    platform = Column(String(100))

    # Monitoring
    recommended_monitoring_type = Column(
        SQLEnum(RecommendedMonitoringType, values_callable=lambda x: [e.value for e in x]),
        default=RecommendedMonitoringType.WEBSITE,
    )

    # RSS
    rss_feed_url = Column(Text)
    rss_valid = Column(Boolean, default=False)
    rss_last_checked_at = Column(DateTime(timezone=True))
    rss_error = Column(Text)

    # Samples
    sample_url = Column(Text)
    sample_mentions_count = Column(Integer, default=0)
    matched_keywords_json = Column(JSON)  # list of matched keyword strings

    # Relevance
    relevance_score = Column(Float, default=0.0)
    relevance_reason = Column(Text)

    # Status
    status = Column(
        SQLEnum(DiscoveredSourceStatus, values_callable=lambda x: [e.value for e in x]),
        default=DiscoveredSourceStatus.CANDIDATE,
        nullable=False,
        index=True,
    )
    blocked_reason = Column(Text)
    approved_source_id = Column(Integer, nullable=True)

    # Timestamps
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ─── BlockedDomain ─────────────────────────────────────────────────────────────

class BlockedDomain(Base):
    __tablename__ = "blocked_domains"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    domain = Column(String(500), nullable=False, index=True)
    reason = Column(Text)
    blocked_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
