import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from datetime import datetime

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.mention import Mention

mock_superuser = User(
    id=1,
    email="admin@example.com",
    is_active=True,
    is_superuser=True
)

def override_get_superuser():
    return mock_superuser

def override_get_db():
    mock_db = MagicMock()
    
    # Mocking for charts: return some fake mentions
    fake_mention = Mention(
        id=1, 
        collected_at=datetime.utcnow(), 
        sentiment="positive", 
        influence_score=50,
        reach_estimate=500
    )
    fake_mention.ai_provider = None
    fake_mention.ai_model = None
    fake_mention.risk_score = 0.0
    fake_mention.tags_json = "{}"
    fake_mention.source = "test"
    fake_mention.author = "test"
    fake_mention.title = "test"
    fake_mention.content = "test"
    fake_mention.url = "http://test"
    fake_mention.keyword = "test"
    fake_mention.language = "en"
    fake_mention.is_reviewed = False
    fake_mention.is_muted = False
    fake_mention.is_deleted = False
    fake_mention.project_id = 1
    
    mock_db.execute.return_value.scalars.return_value.all.return_value = [fake_mention]
    mock_db.execute.return_value.scalar_one_or_none.return_value = fake_mention
    
    yield mock_db

import pytest

@pytest.fixture(autouse=True, scope="module")
def setup_overrides():
    app.dependency_overrides[get_current_active_user] = override_get_superuser
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

client = TestClient(app)

def test_bulk_delete():
    response = client.put("/api/mentions/bulk/delete", json={"mention_ids": [1, 2, 3]})
    assert response.status_code == 204

def test_bulk_review():
    response = client.put("/api/mentions/bulk/review", json={"mention_ids": [1, 2, 3], "is_reviewed": True})
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_bulk_sentiment():
    response = client.put("/api/mentions/bulk/sentiment", json={"mention_ids": [1, 2], "sentiment": "positive"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_review_toggle():
    response = client.put("/api/mentions/1/review", json={"is_reviewed": False})
    assert response.status_code == 200
    assert response.json()["is_reviewed"] == False

def test_charts_basic():
    response = client.get("/api/mentions/charts?granularity=daily")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["granularity"] == "daily"
    assert len(data["items"]) == 1
    assert data["items"][0]["total_mentions"] == 1
    assert data["items"][0]["sentiment_positive"] == 1

def test_charts_with_filters():
    response = client.get("/api/mentions/charts?granularity=monthly&sentiment=positive&min_influence_score=20")
    assert response.status_code == 200
    data = response.json()
    assert data["granularity"] == "monthly"

def test_list_mentions_with_is_reviewed_filter():
    # just testing that it doesn't 500 when passing is_reviewed
    with patch('app.api.mentions.get_db') as mock_get_db:
        mock_db = MagicMock()
        mock_db.execute.return_value.scalars.return_value.all.return_value = []
        mock_db.execute.return_value.scalar.return_value = 0
        app.dependency_overrides[get_db] = lambda: mock_db
        
        response = client.get("/api/mentions?is_reviewed=true")
        assert response.status_code == 200
        
        # Reset override
        app.dependency_overrides[get_db] = override_get_db
