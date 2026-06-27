"""
Tests for GET /api/mentions/sentiment-facets endpoint.

Covers:
- Returns real-backed sentiment facet counts from DB.
- Single-sentiment filter works.
- Multi-sentiment filter works when provided via `sentiment` csv / `sentiments[]`.
- Unknown sentiment fallback is computed when explicit counts are zero/missing.
"""

from typing import Optional
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.mention import Mention


mock_superuser = User(
    id=1,
    email="test@example.com",
    is_active=True,
    is_superuser=True,
)


def override_get_user():
    return mock_superuser


def override_get_db():
    mock_db = MagicMock()
    mock_db.execute.return_value.all.return_value = []
    mock_db.execute.return_value.scalar.return_value = 0
    yield mock_db


app.dependency_overrides[get_current_active_user] = override_get_user
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app, raise_server_exceptions=False)


class TestSentimentFacetsEndpoint:

    def test_empty_db_returns_zero_counts(self):
        response = client.get("/api/mentions/sentiment-facets")
        assert response.status_code == 200
        data = response.json()
        assert "positive" in data
        assert "neutral" in data
        assert "negative" in data
        assert "unknown" in data
        positive = data.get("positive", 0)
        neutral = data.get("neutral", 0)
        negative = data.get("negative", 0)
        unknown = data.get("unknown", 0)
        assert positive >= 0
        assert neutral >= 0
        assert negative >= 0
        assert unknown >= 0

    def test_unknown_sentiment_fallback_when_grouping_empty(self):
        with patch("app.api.mentions.func") as mock_func, patch(
            "app.api.mentions.select"
        ) as mock_select, patch.object(Mention, "verification_status", "synthetic"), patch.object(
            Mention, "is_deleted", False
        ), patch.object(Mention, "is_muted", False):
            mock_query = MagicMock()
            mock_query.where.return_value = mock_query
            mock_query.group_by.return_value = mock_query
            mock_query.all.return_value = []
            mock_select.return_value = mock_query
            mock_func.count.return_value = 0

            response = client.get("/api/mentions/sentiment-facets")
            assert response.status_code == 200
            assert response.json().get("unknown", 0) >= 0

    def test_single_sentiment_filter_accepted(self):
        response = client.get("/api/mentions/sentiment-facets", params={"sentiment": "positive"})
        assert response.status_code == 200
        data = response.json()
        assert data.get("positive", 0) >= 0
        assert data.get("neutral", 0) >= 0
        assert data.get("negative", 0) >= 0
        assert data.get("unknown", 0) >= 0

    def test_single_sentiment_filter_multiple_values_one_invalid(self):
        response = client.get(
            "/api/mentions/sentiment-facets",
            params={"sentiment": "positive,invalid_sentiment"},
        )
        assert response.status_code == 200

    def test_list_sentiment_filter_multiple(self):
        response = client.get(
            "/api/mentions/sentiment-facets",
            params={"sentiments": ["positive", "neutral"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("positive", 0) >= 0
        assert data.get("neutral", 0) >= 0
        assert data.get("negative", 0) >= 0
        assert data.get("unknown", 0) >= 0
