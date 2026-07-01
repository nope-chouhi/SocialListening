import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db

client = TestClient(app)

def mock_get_current_active_user():
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    return user

@pytest.fixture(autouse=True)
def setup_dependencies():
    app.dependency_overrides[get_current_active_user] = mock_get_current_active_user
    yield
    app.dependency_overrides.clear()

def test_summarize_missing_ai_config():
    # Mock DB where config doesn't exist
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = None
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.post("/api/mentions/summarize", json={"project_id": 1})
    assert response.status_code == 400
    assert "Vui lòng cấu hình AI" in response.json()["detail"]

def test_summarize_no_mentions():
    # Mock DB where config exists but no mentions
    db = MagicMock()
    config = MagicMock()
    config.is_enabled = True
    config.api_key = "test"
    
    def side_effect(*args, **kwargs):
        mock_result = MagicMock()
        # First call is config
        if "AIModelConfig" in str(args[0]):
            mock_result.scalar_one_or_none.return_value = config
            return mock_result
        # Second call is mentions
        mock_result.scalars.return_value.all.return_value = []
        return mock_result
        
    db.execute.side_effect = side_effect
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.post("/api/mentions/summarize", json={"project_id": 1})
    assert response.status_code == 400
    assert "Không có mentions nào" in response.json()["detail"]

@patch('app.api.mentions._call_ai_provider')
def test_summarize_success(mock_call_ai):
    # Mock AI response
    mock_call_ai.return_value = (
        '{"summary": "Test Summary", "sentiment_insights": "Test Sentiment", "mentions_analyzed": 1}', 
        {"total_tokens": 100}
    )
    
    db = MagicMock()
    config = MagicMock()
    config.is_enabled = True
    config.api_key = "test"
    
    mention1 = MagicMock()
    mention1.title = "Test Mention"
    mention1.snippet = "Snippet"
    mention1.sentiment = "negative"
    
    def side_effect(*args, **kwargs):
        mock_result = MagicMock()
        if "AIModelConfig" in str(args[0]):
            mock_result.scalar_one_or_none.return_value = config
            return mock_result
        mock_result.scalars.return_value.all.return_value = [mention1]
        return mock_result
        
    db.execute.side_effect = side_effect
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.post("/api/mentions/summarize", json={"project_id": 1})
    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == "Test Summary"
    assert data["sentiment_insights"] == "Test Sentiment"
    assert data["mentions_analyzed"] == 1
