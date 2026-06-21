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
