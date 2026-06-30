import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.database import get_db
from app.core.security import get_current_superuser, get_current_active_user, get_current_user
from app.models.ai_config import AIModelConfig

client = TestClient(app)

def mock_get_current_superuser():
    user = MagicMock()
    user.id = 1
    user.email = "admin@example.com"
    return user

def mock_get_current_active_user():
    user = MagicMock()
    user.id = 2
    user.email = "user@example.com"
    return user

@pytest.fixture(autouse=True)
def setup_dependencies():
    app.dependency_overrides[get_current_user] = mock_get_current_superuser
    app.dependency_overrides[get_current_active_user] = mock_get_current_active_user
    yield
    app.dependency_overrides.clear()

def test_model_config_read_does_not_return_raw_key():
    db = MagicMock()
    mock_config = MagicMock()
    mock_config.id = 1
    mock_config.provider = "openai"
    mock_config.model_name = "gpt-4o"
    mock_config.api_key = "sk-super-secret-key-1234567890"
    mock_config.is_enabled = True
    
    db.execute.return_value.scalar_one_or_none.return_value = mock_config
    
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.get("/api/admin/settings/ai-model")
    assert response.status_code == 200
    data = response.json()
    assert "sk-super-secret-key-1234567890" not in str(data)
    assert data["api_key_masked"] == "sk-s...7890"

def test_chat_config_public_endpoint():
    db = MagicMock()
    mock_config = MagicMock()
    mock_config.provider = "openai"
    mock_config.api_key = "sk-super-secret-key-1234567890"
    db.execute.return_value.scalar_one_or_none.return_value = mock_config
    app.dependency_overrides[get_db] = lambda: db

    response = client.get("/api/ai/chat/config")
    assert response.status_code == 200
    data = response.json()
    assert "api_key" not in data
    assert "api_key_masked" not in data
    assert "provider" in data

def test_ai_model_get_missing_table():
    db = MagicMock()
    from sqlalchemy.exc import ProgrammingError
    db.execute.side_effect = ProgrammingError("SELECT", {}, Exception("relation missing"))
    
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.get("/api/admin/settings/ai-model")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "gemini"
    assert data["is_enabled"] is False

def test_ai_model_put_masked_key():
    db = MagicMock()
    mock_config = MagicMock()
    mock_config.api_key = "real_key"
    db.execute.return_value.scalar_one_or_none.return_value = mock_config
    
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.put("/api/admin/settings/ai-model", json={
        "provider": "openai",
        "api_key": "****",
        "model_name": "gpt-4"
    })
    
    assert response.status_code == 200
    # ensure we did not overwrite the key with '****'
    assert mock_config.api_key == "real_key"
    assert mock_config.provider == "openai"
