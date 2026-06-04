from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Enum as SQLEnum, JSON, Index, Boolean
from sqlalchemy.sql import func
from enum import Enum
from app.core.database import Base


class SentimentScore(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE_LOW = "negative_low"
    NEGATIVE_MEDIUM = "negative_medium"
    NEGATIVE_HIGH = "negative_high"


class Mention(Base):
    __tablename__ = "mentions"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, index=True, nullable=True) # Added for multi-tenancy
    user_id = Column(Integer, index=True, nullable=True)
    project_id = Column(Integer, nullable=True, index=True)
    keyword_id = Column(Integer, nullable=True, index=True)
    keyword_text = Column(String(255), nullable=True)
    job_id = Column(Integer, nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    
    # Discovery Info
    source_type = Column(String(50), nullable=True)
    platform = Column(String(100), nullable=True)
    domain = Column(String(500), nullable=True, index=True)
    
    # Content
    title = Column(Text)
    content = Column(Text, nullable=True)
    snippet = Column(Text, nullable=True)
    content_hash = Column(String(64), unique=True, index=True)  # For deduplication
    url = Column(Text, nullable=True)
    author = Column(String(500))
    
    # Analytics & Metrics
    sentiment = Column(String(50), nullable=True)
    sentiment_confidence = Column(Float, nullable=True)
    influence_score = Column(Float, nullable=True)
    reach_estimate = Column(Integer, nullable=True)
    views_count = Column(Integer, nullable=True)
    comments_count = Column(Integer, nullable=True)
    likes_count = Column(Integer, nullable=True)
    shares_count = Column(Integer, nullable=True)
    
    # Demographics
    language = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    
    # Timestamps
    published_at = Column(DateTime(timezone=True), index=True)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Matched keywords
    matched_keywords = Column(JSON)  # List of matched keyword IDs and positions
    
    # Flags & Actions
    tags_json = Column(JSON, nullable=True)
    is_muted = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    add_to_report = Column(Boolean, default=False)
    extraction_source = Column(String(100), nullable=True)
    confidence = Column(String(50), nullable=True)
    
    # Metadata
    platform_post_id = Column(String(255), index=True)  # Facebook post ID, YouTube comment ID, etc.
    meta_data = Column(JSON)  # Likes, shares, comments count, etc. (renamed from metadata)
    is_reviewed = Column(Boolean, default=False)
    
    
    __table_args__ = (
        Index('idx_mention_published', 'published_at'),
        Index('idx_mention_collected', 'collected_at'),
        Index('idx_mention_source', 'source_id'),
        Index('idx_mention_job', 'job_id'),
        Index('idx_mention_domain', 'domain'),
    )


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"
    
    id = Column(Integer, primary_key=True, index=True)
    mention_id = Column(Integer, unique=True, nullable=False, index=True)
    
    # Analysis results
    sentiment = Column(SQLEnum(SentimentScore, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    risk_score = Column(Float, nullable=False, index=True)  # 0-100
    crisis_level = Column(Integer, nullable=False, index=True)  # 1-5
    
    # AI-generated content
    summary_vi = Column(Text)  # Vietnamese summary
    suggested_action = Column(String(100))  # monitor, respond, escalate, legal_review
    responsible_department = Column(String(100))  # customer_service, PR, legal, executive
    
    # Risk-to-Action Engine Extended Fields
    urgency = Column(String(50))  # low, medium, high, critical
    response_type = Column(String(100))  # monitor_only, reply_publicly, contact_privately, escalate_to_legal...
    recommended_owner = Column(String(100))  # role or title suggestion
    deadline_suggestion = Column(String(100))  # e.g., "within 2 hours", "next 24 hours"
    escalation_needed = Column(Boolean, default=False)
    why_it_matters = Column(Text)
    
    # Vietnamese Context Understanding
    vietnamese_context_label = Column(String(100))
    tone = Column(String(50))
    sarcasm_possible = Column(Boolean, default=False)
    complaint_type = Column(String(100))
    sensitive_signal = Column(Boolean, default=False)
    explanation = Column(Text)
    
    # Confidence
    confidence_score = Column(Float)  # 0-100
    reasoning = Column(Text)  # AI reasoning (not exposed to user)
    
    # Metadata
    ai_provider = Column(String(50))  # openai, gemini, anthropic, etc.
    model_version = Column(String(100))
    processing_time_ms = Column(Integer)
    
    # Timestamps
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())
    
