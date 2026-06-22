try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    from pydantic import BaseSettings
    SettingsConfigDict = None
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Nope"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Frontend URL for CORS
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/social_listening"
    
    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Meilisearch (optional)
    MEILISEARCH_URL: str = "http://localhost:7700"
    MEILISEARCH_MASTER_KEY: str = "masterKey"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # AI Provider Failover Chain
    AI_PROVIDER_CHAIN: str = "gemini"
    AI_PROVIDER: Optional[str] = None  # Legacy fallback
    
    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # OpenAI (optional)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4"
    
    # Provider Settings
    AI_PROVIDER_TIMEOUT_SECONDS: int = 30
    AI_PROVIDER_COOLDOWN_SECONDS: int = 300
    AI_PROVIDER_MAX_RETRIES: int = 1
    
    ANTHROPIC_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    
    # Facebook / Meta
    FACEBOOK_ACCESS_TOKEN: str = ""
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""
    META_APP_ID: str = ""
    META_APP_SECRET: Optional[str] = None
    META_REDIRECT_URI: Optional[str] = None
    TOKEN_ENCRYPTION_KEY: Optional[str] = None
    
    # YouTube
    YOUTUBE_API_KEY: str = ""
    
    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    
    # Email
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    
    # Webhook
    WEBHOOK_NOTIFICATIONS_ENABLED: bool = False
    
    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # Zalo
    ZALO_OA_ID: str = ""
    ZALO_ACCESS_TOKEN: str = ""
    
    # Crawling
    CRAWL_RATE_LIMIT: int = 10
    CRAWL_TIMEOUT: int = 30
    CRAWL_MAX_RETRIES: int = 3
    CRAWL_USER_AGENT: str = "Mozilla/5.0 (compatible; SocialListeningBot/1.0)"

    # Social platform APIs
    TWITTER_BEARER_TOKEN: str = ""
    NEWS_API_KEY: str = ""
    SOCIAL_CRAWL_ENABLED: bool = True
    SOCIAL_CRAWL_INTERVAL_MINUTES: int = 5
    SCAN_INTERVAL_MINUTES: int = 15

    # Auto Discovery Settings
    AUTO_DISCOVERY_ENABLED: bool = True
    AUTO_DISCOVERY_INTERVAL_MINUTES: int = 15
    AUTO_DISCOVERY_MAX_RESULTS_PER_RUN: int = 20
    
    # Automated Keyword Scanning Settings
    AUTO_SCAN_ENABLED: bool = False
    AUTO_SCAN_INTERVAL_MINUTES: int = 15

    # DistilBERT sentiment microservice (Flask on port 5001)
    SENTIMENT_SERVICE_URL: str = "http://localhost:5001"
    
    # Auto Discovery / Web Search
    WEB_SEARCH_PROVIDER: str = "serpapi"  # serpapi, none
    SERPAPI_API_KEY: str = ""  # Server-side only — never expose to frontend
    AUTO_DISCOVERY_ENABLED: bool = True
    YOUTUBE_API_KEY: str = ""
    FACEBOOK_ACCESS_TOKEN: str = ""

    # Search Provider Chain (Serper → Tavily → RSS)
    SERPER_API_KEY: str = ""        # Serper.dev — skip if empty
    TAVILY_API_KEY: str = ""        # Tavily.com — skip if empty
    SEARCH_PROVIDER_ORDER: str = "serper,tavily,rss"
    SEARCH_PROVIDER_TIMEOUT_SECONDS: int = 8
    SEARCH_PROVIDER_MAX_RESULTS: int = 20
    SEARCH_PROVIDER_CACHE_TTL_SECONDS: int = 900
    
    # Screenshot
    SCREENSHOT_SERVICE_URL: str = "http://localhost:3001"
    
    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins including FRONTEND_URL"""
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://social-listening-azure.vercel.app",  # Vercel frontend
        ]
        if self.FRONTEND_URL:
            # Strip trailing slash from FRONTEND_URL to match browser Origin headers exactly
            clean_url = self.FRONTEND_URL.rstrip('/')
            if clean_url not in origins:
                origins.append(clean_url)
        return origins
    
    if SettingsConfigDict:
        model_config = SettingsConfigDict(
            env_file='.env',
            case_sensitive=True,
            extra='ignore'
        )
    else:
        class Config:
            env_file = '.env'
            case_sensitive = True
            extra = 'ignore'

settings = Settings()

# Post-init production safety checks
if settings.ENVIRONMENT == "production":
    if settings.SECRET_KEY == "your-secret-key-change-in-production" or not settings.SECRET_KEY:
        raise ValueError("CRITICAL: SECRET_KEY must be set to a secure value in production!")
