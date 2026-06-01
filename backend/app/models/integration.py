from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class SocialIntegration(Base):
    __tablename__ = "social_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, nullable=True)
    provider = Column(String(50), nullable=False) # 'meta'
    status = Column(String(50)) # 'active', 'limited', 'invalid'
    
    granted_scopes_json = Column(JSON, default=list)
    missing_scopes_json = Column(JSON, default=list)
    token_encrypted = Column(Text, nullable=False)
    token_expires_at = Column(DateTime(timezone=True))
    
    last_checked_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    accounts = relationship("SocialIntegrationAccount", back_populates="integration")

class SocialIntegrationAccount(Base):
    __tablename__ = "social_integration_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(Integer, ForeignKey("social_integrations.id"), nullable=False, index=True)
    provider = Column(String(50)) # 'facebook', 'instagram'
    account_type = Column(String(50)) # 'page', 'instagram_business'
    external_id = Column(String(255), nullable=False) # Page ID or IG Business ID
    name = Column(String(255))
    username = Column(String(255))
    metadata_json = Column(JSON)
    selected = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    integration = relationship("SocialIntegration", back_populates="accounts")


class OAuthState(Base):
    __tablename__ = "oauth_states"
    
    id = Column(Integer, primary_key=True, index=True)
    state_token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
