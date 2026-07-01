import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User

mock_superuser = User(id=1, email="admin@example.com", is_active=True, is_superuser=True)

def override_get_user():
    return mock_superuser

mock_db = MagicMock()
def override_get_db():
    yield mock_db

import pytest

@pytest.fixture(autouse=True, scope="module")
def setup_overrides():
    app.dependency_overrides[get_current_active_user] = override_get_user
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

client = TestClient(app)

def test_source_type_web_does_not_join_source():
    """
    Regression test: Ensure that filtering by source_type='web' 
    DOES NOT perform an INNER JOIN on the Source table, 
    because doing so drops mentions where source_id IS NULL.
    """
    mock_db.execute.reset_mock()
    
    # Mock return values for scalars().all() and scalar() 
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    mock_db.execute.return_value.scalar.return_value = 0
    
    response = client.get("/api/mentions?source_type=web")
    assert response.status_code == 200
    
    # Analyze the queries executed. There should be a count query and an items query.
    # The queries should NOT contain an INNER JOIN with the "sources" table.
    calls = mock_db.execute.call_args_list
    assert len(calls) >= 2, "Should execute at least count and fetch queries"
    
    for call in calls:
        query_obj = call[0][0]
        # Compile query to a string for inspection
        query_str = str(query_obj).lower()
        
        # We ensure it doesn't do "JOIN sources" or "INNER JOIN sources"
        # Outer joins with AIAnalysis are fine, but NOT with sources.
        assert "join sources" not in query_str, "Query should not INNER JOIN the Source table"
