"""
Tests for source type normalization and validation (Bug C hardening).

Coverage:
1. source_type=web works (HTTP 200)
2. source_type=news works (HTTP 200)
3. source_type=youtube works (HTTP 200)
4. source_type=not_a_real_source returns HTTP 400
5. Multiple source_types with one invalid returns HTTP 400
6. No source_type filter works normally (HTTP 200)

Unit tests:
- validate_source_type_alias() passes for all valid aliases
- validate_source_type_alias() raises ValueError for unknown aliases
- normalize_source_type_for_mention() maps correctly
- normalize_source_type_for_source_model() maps correctly
"""
import pytest
from sqlalchemy import Enum
from typing import Optional
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.utils.source_type import (
    VALID_SOURCE_TYPE_ALIASES,
    validate_source_type_alias,
    normalize_source_type_for_mention,
    normalize_source_type_for_source_model,
    is_web_type,
)


# ═══════════════════════════════════════════════════════════════════════
# Unit Tests — validate_source_type_alias()
# ═══════════════════════════════════════════════════════════════════════

class TestValidateSourceTypeAlias:
    """validate_source_type_alias() must accept all known aliases and reject unknowns."""

    @pytest.mark.parametrize("alias", [
        "web", "news", "youtube", "blog", "rss", "video",
        "facebook", "instagram", "twitter", "tiktok", "podcast", "manual_url",
        "WEB", "NEWS", "YouTube",  # case-insensitive
        "website", "global_search", "forum",  # enum literal values
        "facebook_page", "youtube_channel",
    ])
    def test_valid_alias_passes(self, alias):
        result = validate_source_type_alias(alias)
        assert result == alias.strip().lower()

    @pytest.mark.parametrize("bad_alias", [
        "not_a_real_source",
        "invalid",
        "hack; DROP TABLE mentions;--",
        "web_extra",
        "",  # empty after strip should not be called but guard anyway
        "   ",
        "12345",
        "UNKNOWN_TYPE",
    ])
    def test_invalid_alias_raises_value_error(self, bad_alias):
        with pytest.raises(ValueError, match="Invalid source_type"):
            validate_source_type_alias(bad_alias)

    def test_error_message_includes_accepted_values(self):
        with pytest.raises(ValueError) as exc_info:
            validate_source_type_alias("garbage_value")
        assert "Accepted values" in str(exc_info.value)
        assert "web" in str(exc_info.value)
        assert "news" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════════════
# Unit Tests — normalize_source_type_for_mention()
# ═══════════════════════════════════════════════════════════════════════

class TestNormalizeForMention:
    def test_web_maps_to_web_family(self):
        result = normalize_source_type_for_mention("web")
        assert result is not None
        assert any(v in result for v in ["web", "website"])

    def test_news_maps_to_news_family(self):
        result = normalize_source_type_for_mention("news")
        assert result is not None
        assert "news" in result

    def test_youtube_maps_to_video_family(self):
        result = normalize_source_type_for_mention("youtube")
        assert result is not None
        assert any(v in result for v in ["video", "youtube", "yt"])

    def test_rss_maps_to_rss_family(self):
        result = normalize_source_type_for_mention("rss")
        assert result is not None
        assert "rss" in result

    def test_blog_maps_to_blog_family(self):
        result = normalize_source_type_for_mention("blog")
        assert result is not None
        assert any(v in result for v in ["blog", "forum"])

    def test_none_returns_none(self):
        assert normalize_source_type_for_mention(None) is None

    def test_empty_returns_none(self):
        assert normalize_source_type_for_mention("") is None


# ═══════════════════════════════════════════════════════════════════════
# Unit Tests — normalize_source_type_for_source_model()
# ═══════════════════════════════════════════════════════════════════════

class TestNormalizeForSourceModel:
    def test_web_maps_to_enum_values(self):
        result = normalize_source_type_for_source_model("web")
        assert result is not None
        valid_enum = {
            "website", "global_search", "manual_url", "news", "rss", "forum",
            "facebook_page", "facebook_group", "facebook_profile",
            "instagram_business", "youtube_channel", "youtube_video",
        }
        assert all(v in valid_enum for v in result)

    def test_news_maps_to_news(self):
        result = normalize_source_type_for_source_model("news")
        assert result == ["news"]

    def test_youtube_maps_to_youtube_enum(self):
        result = normalize_source_type_for_source_model("youtube")
        assert result is not None
        assert all(v in ["youtube_channel", "youtube_video"] for v in result)

    def test_twitter_returns_empty_list(self):
        """twitter is a valid user alias but has no Source enum equivalent."""
        result = normalize_source_type_for_source_model("twitter")
        assert result == []

    def test_tiktok_returns_empty_list(self):
        result = normalize_source_type_for_source_model("tiktok")
        assert result == []

    def test_none_returns_none(self):
        assert normalize_source_type_for_source_model(None) is None


# ═══════════════════════════════════════════════════════════════════════
# Unit Tests — is_web_type()
# ═══════════════════════════════════════════════════════════════════════

class TestIsWebType:
    def test_web_is_web(self):
        assert is_web_type("web") is True

    def test_website_is_web(self):
        assert is_web_type("website") is True

    def test_news_is_not_web(self):
        assert is_web_type("news") is False

    def test_youtube_is_not_web(self):
        assert is_web_type("youtube") is False


# ═══════════════════════════════════════════════════════════════════════
# API Integration Tests (mocked DB)
# ═══════════════════════════════════════════════════════════════════════

mock_superuser = User(
    id=1,
    email="test@example.com",
    is_active=True,
    is_superuser=True
)


def override_get_user():
    return mock_superuser


def override_get_db():
    mock_db = MagicMock()
    
    def mock_execute(*args, **kwargs):
        res = MagicMock()
        res.scalars.return_value.all.return_value = []
        res.scalar.return_value = 0
        # Ensure that if anyone calls .scalar() it returns 0 explicitly
        res.scalar = MagicMock(return_value=0)
        return res
        
    mock_db.execute.side_effect = mock_execute
    yield mock_db


app.dependency_overrides[get_current_active_user] = override_get_user
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app, raise_server_exceptions=False)


class TestMentionsAPISourceFilter:
    """
    Test 1-6: required behaviors from the task specification.
    These use mocked DB so validation logic is tested at API level.
    """

    # ── Test 1: source_type=web works ───────────────────────────────────
    def test_source_type_web_returns_200(self):
        """source_type=web must be accepted and return HTTP 200."""
        response = client.get("/api/mentions?source_type=web")
        assert response.status_code == 200, (
            f"Expected 200 for source_type=web, got {response.status_code}: {response.text}"
        )

    # ── Test 2: source_type=news works ──────────────────────────────────
    def test_source_type_news_returns_200(self):
        """source_type=news must be accepted and return HTTP 200."""
        response = client.get("/api/mentions?source_type=news")
        assert response.status_code == 200, (
            f"Expected 200 for source_type=news, got {response.status_code}: {response.text}"
        )

    # ── Test 3: source_type=youtube works ───────────────────────────────
    def test_source_type_youtube_returns_200(self):
        """source_type=youtube must be accepted and return HTTP 200."""
        response = client.get("/api/mentions?source_type=youtube")
        assert response.status_code == 200, (
            f"Expected 200 for source_type=youtube, got {response.status_code}: {response.text}"
        )

    # ── Test 4: source_type=not_a_real_source returns HTTP 400 ──────────
    def test_invalid_source_type_returns_400(self):
        """Invalid source_type must return HTTP 400, not 200 with broader data."""
        response = client.get("/api/mentions?source_type=not_a_real_source")
        assert response.status_code == 400, (
            f"Expected 400 for invalid source_type, got {response.status_code}: {response.text}"
        )
        body = response.json()
        assert "detail" in body
        # Error should mention the invalid value
        assert "not_a_real_source" in body["detail"] or "Invalid" in body["detail"]

    def test_another_invalid_source_type_returns_400(self):
        """Additional check: completely bogus type is also rejected."""
        response = client.get("/api/mentions?source_type=hack; DROP TABLE")
        assert response.status_code == 400

    # ── Test 5: mixed valid+invalid returns HTTP 400 ─────────────────────
    def test_mixed_valid_invalid_source_types_returns_400(self):
        """A comma-separated list with one invalid value must return HTTP 400."""
        response = client.get("/api/mentions?source_type=web,not_a_real_source")
        assert response.status_code == 400, (
            f"Expected 400 for mixed valid/invalid source_type, got {response.status_code}: {response.text}"
        )
        body = response.json()
        assert "detail" in body

    def test_multiple_invalid_source_types_returns_400(self):
        """Multiple invalid values should all be reported."""
        response = client.get("/api/mentions?source_type=bad1,bad2")
        assert response.status_code == 400

    # ── Test 6: no source_type filter works normally ──────────────────────
    def test_no_source_type_filter_returns_200(self):
        """Omitting source_type must work normally."""
        response = client.get("/api/mentions")
        assert response.status_code == 200, (
            f"Expected 200 with no source_type filter, got {response.status_code}: {response.text}"
        )

    # ── Additional: other valid aliases ──────────────────────────────────
    def test_source_type_rss_returns_200(self):
        response = client.get("/api/mentions?source_type=rss")
        assert response.status_code == 200

    def test_source_type_blog_returns_200(self):
        response = client.get("/api/mentions?source_type=blog")
        assert response.status_code == 200

    def test_source_type_facebook_returns_200(self):
        response = client.get("/api/mentions?source_type=facebook")
        assert response.status_code == 200

    def test_source_type_twitter_returns_200(self):
        """twitter is valid (no Source records, returns empty) but not 400."""
        response = client.get("/api/mentions?source_type=twitter")
        assert response.status_code == 200
