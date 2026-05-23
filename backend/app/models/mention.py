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
    source_id = Column(Integer, nullable=False, index=True)
    
    # Content
    title = Column(Text)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), unique=True, index=True)  # For deduplication
    url = Column(Text, nullable=False)
    author = Column(String(500))
    
    # Timestamps
    published_at = Column(DateTime(timezone=True), index=True)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Matched keywords
    matched_keywords = Column(JSON)  # List of matched keyword IDs and positions
    
    # Metadata
    platform_post_id = Column(String(255), index=True)  # Facebook post ID, YouTube comment ID, etc.
    meta_data = Column(JSON)  # Likes, shares, comments count, etc. (renamed from metadata)
    is_reviewed = Column(Boolean, default=False)
    
    
    __table_args__ = (
        Index('idx_mention_published', 'published_at'),
        Index('idx_mention_collected', 'collected_at'),
        Index('idx_mention_source', 'source_id'),
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
    
    # Confidence
    confidence_score = Column(Float)  # 0-100
    reasoning = Column(Text)  # AI reasoning (not exposed to user)
    
    # Metadata
    ai_provider = Column(String(50))  # openai, gemini, anthropic, etc.
    model_version = Column(String(100))
    processing_time_ms = Column(Integer)
    
    # Timestamps
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())
    
