import pytest
from unittest.mock import patch, MagicMock
from app.services.scheduler_service import scheduler_lock
from sqlalchemy.orm import Session
from datetime import datetime, timezone

def test_scheduler_lock_pg():
    # Mock db session and bind
    db_mock = MagicMock()
    db_mock.bind.dialect.name = 'postgresql'
    
    # Mock execute to return True
    scalar_mock = MagicMock(return_value=True)
    execute_mock = MagicMock(return_value=MagicMock(scalar=MagicMock(return_value=True)))
    db_mock.execute = execute_mock
    
    with scheduler_lock(db_mock, 1001, "test_pg_lock") as acquired:
        assert acquired is True
        
    # Verify pg_try_advisory_lock was called
    assert "pg_try_advisory_lock(1001)" in execute_mock.call_args_list[0][0][0].text
    # Verify unlock was called
    assert "pg_advisory_unlock(1001)" in execute_mock.call_args_list[-1][0][0].text

def test_scheduler_lock_sqlite():
    db_mock = MagicMock()
    db_mock.bind.dialect.name = 'sqlite'
    
    # Mock status object
    status_mock = MagicMock()
    status_mock.is_locked = False
    
    query_mock = MagicMock()
    query_mock.with_for_update().first.return_value = status_mock
    query_mock.first.return_value = status_mock
    db_mock.query.return_value = query_mock
    
    with scheduler_lock(db_mock, 1001, "test_sqlite_lock") as acquired:
        assert acquired is True
        assert status_mock.is_locked is True
        assert status_mock.locked_at is not None
        
    assert status_mock.is_locked is False

@patch('app.jobs.scan_jobs.scheduler_lock')
@patch('app.jobs.scan_jobs.SessionLocal')
@patch('app.jobs.scan_jobs.getattr')
def test_run_automated_scans_locked(mock_getattr, mock_session, mock_lock):
    from app.jobs.scan_jobs import run_automated_scans
    
    mock_getattr.return_value = True
    
    db_mock = MagicMock()
    mock_session.return_value = db_mock
    
    # Mock lock yielding False (meaning another worker holds the lock)
    context_manager_mock = MagicMock()
    context_manager_mock.__enter__.return_value = False
    mock_lock.return_value = context_manager_mock
    
    run_automated_scans()
    
    # Verify lock was checked
    mock_lock.assert_called_once_with(db_mock, 1004, "run_automated_scans")
    # Verify no db executes happened because we exited early
    db_mock.execute.assert_not_called()

def test_worker_status_missing_table():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.database import get_db
    from sqlalchemy.exc import ProgrammingError
    
    client = TestClient(app)
    
    db = MagicMock()
    db.query.return_value.first.side_effect = ProgrammingError("SELECT", {}, Exception("relation missing"))
    db.query.return_value.filter.return_value.count.side_effect = ProgrammingError("SELECT", {}, Exception("relation missing"))
    
    app.dependency_overrides[get_db] = lambda: db
    
    response = client.get("/api/system/worker-status")
    assert response.status_code == 200
    data = response.json()
    assert data["active_sources"] == 0
    assert data["due_sources"] == 0
    assert data["worker_mode"] == "none"
