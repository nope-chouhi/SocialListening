import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from datetime import datetime
import io
import openpyxl

from app.main import app
from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User

# Mock Users
mock_superuser = User(
    id=1,
    email="admin@example.com",
    is_active=True,
    is_superuser=True
)

mock_normal_user = User(
    id=2,
    email="user@example.com",
    is_active=True,
    is_superuser=False
)

def override_get_superuser():
    return mock_superuser

def override_get_normal_user():
    return mock_normal_user

def override_get_db():
    mock_db = MagicMock()
    # Mocking execution to return empty results for our basic tests
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    yield mock_db

app.dependency_overrides[get_current_active_user] = override_get_superuser
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_export_mentions_csv_returns_headers_when_empty():
    response = client.get("/api/reports/mentions/export?format=csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "mention_id,project_id,keyword" in response.text
    # Should only have one line (the headers) or headers + empty line
    lines = response.text.strip().split("\r\n")
    assert len(lines) == 1

def test_export_alerts_csv_returns_headers_when_empty():
    response = client.get("/api/reports/alerts/export?format=csv")
    assert response.status_code == 200
    assert "alert_id,project_id,alert_type" in response.text
    lines = response.text.strip().split("\r\n")
    assert len(lines) == 1

def test_export_incidents_csv_returns_headers_when_empty():
    response = client.get("/api/reports/incidents/export?format=csv")
    assert response.status_code == 200
    assert "incident_id,user_id,title" in response.text
    lines = response.text.strip().split("\r\n")
    assert len(lines) == 1

def test_export_filters_applied_correctly():
    # Test date_from, date_to, project_id
    with patch("app.services.export_service.apply_tenant_filter") as mock_tenant_filter:
        # Mock the chained sqlalchemy methods
        mock_query = MagicMock()
        mock_tenant_filter.return_value = mock_query
        mock_query.where.return_value = mock_query
        
        response = client.get("/api/reports/mentions/export?format=csv&project_id=5&date_from=2023-01-01T00:00:00Z&date_to=2023-12-31T23:59:59Z")
        assert response.status_code == 200
        
        # Verify that where() was called (which implies filters were applied to query)
        assert mock_query.where.call_count >= 3

def test_export_tenant_scoping_normal_user():
    # Switch to normal user
    app.dependency_overrides[get_current_active_user] = override_get_normal_user
    
    with patch("app.services.export_service.apply_tenant_filter") as mock_tenant_filter:
        response = client.get("/api/reports/mentions/export?format=csv")
        assert response.status_code == 200
        
        # Ensure apply_tenant_filter was called with the normal user
        args, _ = mock_tenant_filter.call_args
        passed_user = args[2] # current_user is 3rd arg in apply_tenant_filter(query, model, current_user)
        assert passed_user.id == 2
        assert passed_user.is_superuser is False
        
    # Reset to superuser
    app.dependency_overrides[get_current_active_user] = override_get_superuser

def test_export_project_summary_xlsx_valid_workbook():
    response = client.get("/api/reports/project-summary/export?format=xlsx")
    assert response.status_code == 200
    
    # Load workbook from response content
    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    
    # Verify expected sheets exist
    sheet_names = wb.sheetnames
    assert "Summary" in sheet_names
    assert "Mentions" in sheet_names
    assert "Alerts" in sheet_names
    assert "Incidents" in sheet_names
    
    # Verify no fake data in Summary sheet (should be 0 since mock db returns empty list)
    ws = wb["Summary"]
    found_mentions_row = False
    for row in ws.iter_rows(values_only=True):
        if row and row[0] == "Tổng Mentions":
            assert row[1] == 0  # No fake data
            found_mentions_row = True
    assert found_mentions_row

def test_summary_data_endpoint_empty():
    response = client.get("/api/reports/summary-data")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["total_mentions"] == 0
    assert data["metrics"]["total_alerts"] == 0
    assert data["metrics"]["total_incidents"] == 0
    assert data["metrics"]["sentiment"]["positive"] == 0
    assert data["selected_mentions"] == []
    assert data["top_sources"] == []

def test_summary_data_scoping_normal_user():
    app.dependency_overrides[get_current_active_user] = override_get_normal_user
    
    with patch("app.api.reports.apply_tenant_filter") as mock_tenant_filter:
        # Return a real select statement so subquery() works
        from sqlalchemy import select
        from app.models.alert import Alert
        mock_tenant_filter.return_value = select(Alert)
        
        # Test request
        response = client.get("/api/reports/summary-data")
        assert response.status_code == 200
        
        args, _ = mock_tenant_filter.call_args
        passed_user = args[2]
        assert passed_user.id == 2
        assert passed_user.is_superuser is False
        
    app.dependency_overrides[get_current_active_user] = override_get_superuser

def test_export_unsupported_formats():
    assert client.get("/api/reports/mentions/export?format=pdf").status_code == 400
    assert client.get("/api/reports/alerts/export?format=xlsx").status_code == 400
    assert client.get("/api/reports/project-summary/export?format=csv").status_code == 400
