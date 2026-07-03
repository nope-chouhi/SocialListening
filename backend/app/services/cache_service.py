import json
import logging
from typing import Any, Optional
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    _instance: Optional['CacheService'] = None
    
    def __init__(self):
        self.redis_client = None
        if settings.REDIS_ENABLED and settings.REDIS_URL:
            try:
                # Use a connection pool for lazy, reusable singleton client
                self.redis_client = redis.from_url(
                    settings.REDIS_URL, 
                    decode_responses=True,
                    socket_connect_timeout=2.0,
                    socket_timeout=2.0
                )
            except Exception as e:
                logger.error(f"Failed to initialize Redis client: {e}")
                self.redis_client = None
                
    @classmethod
    def get_instance(cls) -> 'CacheService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis_client:
            return None
            
        try:
            data = await self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            # Graceful fallback on connection/redis error
            logger.warning(f"Redis get error for {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
        if not self.redis_client:
            return False
            
        try:
            ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS
            serialized = json.dumps(value)
            await self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            # Graceful fallback
            logger.warning(f"Redis set error for {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        if not self.redis_client:
            return False
            
        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete error for {key}: {e}")
            return False
            
    async def close(self):
        if self.redis_client:
            await self.redis_client.aclose()

cache_service = CacheService.get_instance()
