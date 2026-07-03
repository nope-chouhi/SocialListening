import pytest
import json
from unittest.mock import AsyncMock, patch

from app.services.cache_service import CacheService

@pytest.fixture
def mock_redis():
    with patch("redis.asyncio.from_url") as mock:
        client = AsyncMock()
        mock.return_value = client
        yield client

@pytest.mark.asyncio
async def test_cache_service_disabled():
    with patch("app.core.config.settings.REDIS_ENABLED", False):
        service = CacheService()
        assert service.redis_client is None
        
        result = await service.get("test_key")
        assert result is None
        
        success = await service.set("test_key", {"data": 123})
        assert success is False
        
        success = await service.delete("test_key")
        assert success is False

@pytest.mark.asyncio
async def test_cache_service_missing_url():
    with patch("app.core.config.settings.REDIS_ENABLED", True):
        with patch("app.core.config.settings.REDIS_URL", ""):
            service = CacheService()
            assert service.redis_client is None

@pytest.mark.asyncio
async def test_cache_hit_and_miss(mock_redis):
    with patch("app.core.config.settings.REDIS_ENABLED", True):
        service = CacheService()
        service.redis_client = mock_redis
        
        # Miss
        mock_redis.get.return_value = None
        result = await service.get("miss_key")
        assert result is None
        mock_redis.get.assert_called_once_with("miss_key")
        
        # Hit
        mock_redis.get.reset_mock()
        mock_redis.get.return_value = '{"foo": "bar"}'
        result = await service.get("hit_key")
        assert result == {"foo": "bar"}
        mock_redis.get.assert_called_once_with("hit_key")

@pytest.mark.asyncio
async def test_cache_set(mock_redis):
    with patch("app.core.config.settings.REDIS_ENABLED", True):
        service = CacheService()
        service.redis_client = mock_redis
        
        success = await service.set("set_key", {"test": 123}, 100)
        assert success is True
        mock_redis.setex.assert_called_once_with("set_key", 100, '{"test": 123}')

@pytest.mark.asyncio
async def test_cache_error_fallback(mock_redis):
    with patch("app.core.config.settings.REDIS_ENABLED", True):
        service = CacheService()
        service.redis_client = mock_redis
        
        mock_redis.get.side_effect = Exception("Connection refused")
        
        result = await service.get("error_key")
        assert result is None
