from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
import pytest

mock_db = MagicMock()

def override_get_user():
    user = User(id=1, email="test@example.com", is_active=True, is_superuser=False)
    return user

def override_get_superuser():
    user = User(id=999, email="admin@example.com", is_active=True, is_superuser=True)
    return user

def override_get_db():
    yield mock_db

@pytest.fixture(autouse=True, scope="module")
def setup_overrides():
    app.dependency_overrides[get_current_active_user] = override_get_user
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

client = TestClient(app)

def test_verifiable_mentions_in_main_list():
    """
    Test that the main mentions list query includes verifiable_filter checks.
    """
    mock_db.execute.reset_mock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    mock_db.execute.return_value.scalar.return_value = 0
    
    response = client.get("/api/mentions")
    assert response.status_code == 200
    
    calls = mock_db.execute.call_args_list
    assert len(calls) >= 2
    
    for call in calls:
        query_str = str(call[0][0].compile(compile_kwargs={"literal_binds": True}))
        # The query MUST contain checks for url, canonical_url, original_url, permalink, source_url
        assert "url IS NOT NULL" in query_str or "mentions.url IS NOT NULL" in query_str
        assert "original_url IS NOT NULL" in query_str or "mentions.original_url IS NOT NULL" in query_str

def test_verifiable_mentions_in_source_filter_count():
    """
    Test that the source filter summary query includes verifiable_filter checks.
    """
    mock_db.execute.reset_mock()
    mock_db.execute.return_value.all.return_value = []
    
    response = client.get("/api/mentions/summary")
    assert response.status_code == 200
    
    calls = mock_db.execute.call_args_list
    assert len(calls) >= 1
    
    query_str = str(calls[0][0][0].compile(compile_kwargs={"literal_binds": True}))
    assert "url IS NOT NULL" in query_str or "mentions.url IS NOT NULL" in query_str
    assert "original_url IS NOT NULL" in query_str or "mentions.original_url IS NOT NULL" in query_str

def test_detail_admin_delete_actions_bypass_filter():
    """
    Test that getting a specific mention by ID bypasses the verifiable filter
    (e.g., admin or direct detail access shouldn't be blocked if unverifiable).
    """
    mock_db.execute.reset_mock()
    
    from app.models.mention import Mention
    from app.models.source import Source
    fake_mention = Mention(id=1, project_id=1, title="Test", content="Test content", url=None, original_url=None)
    
    def mock_execute(stmt):
        mock_result = MagicMock()
        if "mentions" in str(stmt).lower():
            mock_result.scalar_one_or_none.return_value = fake_mention
        else:
            mock_result.scalar_one_or_none.return_value = None
        return mock_result
        
    mock_db.execute.side_effect = mock_execute
    
    response = client.get("/api/mentions/1")
    assert response.status_code == 200
    
    calls = mock_db.execute.call_args_list
    assert len(calls) >= 1
    query_str = str(calls[0][0][0].compile(compile_kwargs={"literal_binds": True}))
    
    # Detail queries should NOT have the verifiable IS NOT NULL checks
    assert "url IS NOT NULL" not in query_str and "mentions.url IS NOT NULL" not in query_str
