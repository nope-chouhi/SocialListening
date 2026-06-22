"""Tests for source type normalization (Bug C fix)."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.utils.source_type import (
    normalize_source_type_for_mention,
    normalize_source_type_for_source_model,
    is_web_type,
)


# --- Unit tests for the utility module ---

def test_normalize_mention_web():
    result = normalize_source_type_for_mention("web")
    assert result is not None
    assert "web" in result or "website" in result


def test_normalize_mention_news():
    result = normalize_source_type_for_mention("news")
    assert result is not None
    assert "news" in result


def test_normalize_mention_youtube():
    result = normalize_source_type_for_mention("youtube")
    assert result is not None
    # youtube should map to video family
    assert any(v in result for v in ["video", "youtube", "yt"])


def test_normalize_mention_video():
    result = normalize_source_type_for_mention("video")
    assert result is not None
    assert any(v in result for v in ["video", "youtube"])


def test_normalize_mention_rss():
    result = normalize_source_type_for_mention("rss")
    assert result is not None
    assert "rss" in result


def test_normalize_mention_blog():
    result = normalize_source_type_for_mention("blog")
    assert result is not None
    assert "blog" in result or "forum" in result


def test_normalize_mention_empty():
    assert normalize_source_type_for_mention(None) is None
    assert normalize_source_type_for_mention("") is None
    assert normalize_source_type_for_mention("  ") is None


def test_normalize_mention_unknown_passes_through():
    result = normalize_source_type_for_mention("custom_source")
    assert result == ["custom_source"]


def test_normalize_mention_csv():
    result = normalize_source_type_for_mention("web,news")
    assert result is not None
    # Should have values from both
    has_web = any(v in result for v in ["web", "website"])
    has_news = any(v in result for v in ["news"])
    assert has_web
    assert has_news


def test_normalize_source_model_web():
    result = normalize_source_type_for_source_model("web")
    assert result is not None
    # Should contain valid SourceType enum values only
    valid = {"website", "global_search", "manual_url", "news", "rss", "forum",
             "facebook_page", "facebook_group", "facebook_profile",
             "instagram_business", "youtube_channel", "youtube_video"}
    assert all(v in valid for v in result)


def test_normalize_source_model_news():
    result = normalize_source_type_for_source_model("news")
    assert result == ["news"]


def test_normalize_source_model_youtube():
    result = normalize_source_type_for_source_model("youtube")
    assert result is not None
    assert all(v in ["youtube_channel", "youtube_video"] for v in result)


def test_normalize_source_model_unknown_raises():
    with pytest.raises(ValueError, match="Unknown source type"):
        normalize_source_type_for_source_model("unknown_platform")


def test_normalize_source_model_empty():
    assert normalize_source_type_for_source_model(None) is None
    assert normalize_source_type_for_source_model("") is None


def test_is_web_type():
    assert is_web_type("web") is True
    assert is_web_type("website") is True
    assert is_web_type("news") is False
    assert is_web_type("youtube") is False


# --- Integration tests against the mentions API ---

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
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    mock_db.execute.return_value.scalar.return_value = 0
    yield mock_db


app.dependency_overrides[get_current_active_user] = override_get_user
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_source_filter_web_does_not_crash():
    """source_type=web must not crash the backend."""
    response = client.get("/api/mentions?source_type=web")
    assert response.status_code == 200


def test_source_filter_news_does_not_crash():
    """source_type=news must not crash the backend."""
    response = client.get("/api/mentions?source_type=news")
    assert response.status_code == 200


def test_source_filter_youtube_does_not_crash():
    """source_type=youtube must not crash the backend."""
    response = client.get("/api/mentions?source_type=youtube")
    assert response.status_code == 200


def test_source_filter_none_works():
    """No source_type filter must still work."""
    response = client.get("/api/mentions")
    assert response.status_code == 200


def test_source_filter_rss_does_not_crash():
    """source_type=rss must not crash."""
    response = client.get("/api/mentions?source_type=rss")
    assert response.status_code == 200


def test_source_filter_blog_does_not_crash():
    """source_type=blog must not crash."""
    response = client.get("/api/mentions?source_type=blog")
    assert response.status_code == 200
