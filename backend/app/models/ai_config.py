from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class AIModelConfig(Base):
    """Single-row table for AI model configuration.
    Stores the active AI provider settings for the chat feature.
    Designed for future per-customer billing.
    """
    __tablename__ = "ai_model_config"

    id = Column(Integer, primary_key=True)  # Always 1
    provider = Column(String(50), nullable=False, default='gemini')  # gemini, openai, custom
    api_key = Column(Text, nullable=True)  # API key for the selected provider
    model_name = Column(String(255), nullable=False, default='gemini-2.5-flash')
    base_url = Column(Text, nullable=True)  # Only for 'custom' provider
    max_tokens = Column(Integer, nullable=False, default=2048)
    temperature = Column(Float, nullable=False, default=0.7)
    is_enabled = Column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AIUsageLog(Base):
    """Tracks token usage and estimated cost for AI API calls."""
    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    model_config_id = Column(Integer, ForeignKey('ai_model_config.id', ondelete='SET NULL'), nullable=True)

    provider = Column(String(50), nullable=False)
    model = Column(String(255), nullable=False)
    request_type = Column(String(50), nullable=False, default="sentiment_analysis")

    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)

    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
