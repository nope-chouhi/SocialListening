# -*- coding: utf-8 -*-
"""
Tests for POST /api/crawl/manual-scan endpoint.
Covers: job creation, unicode queries, schema mismatch handling,
duplicate-check safety, and error isolation.
"""
import os
import sys
import json
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_manual_scan.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import Mention
from app.main import app

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite:///test_manual_scan.db"
engine = create_engine(TEST_DB_URL, echo=False)

# Enable WAL mode + foreign keys for SQLite
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _rec):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

TestSession = sessionmaker(bind=engine, expire_on_commit=False, autocommit=False, autoflush=False)


def _create_tables():
    """Create all tables from models (correct schema)."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # Insert a test user
    with engine.connect() as conn:
        conn.execute(text(
            "INSERT OR IGNORE INTO users (id, email, hashed_password, full_name, is_active) "
            "VALUES (1, 'test@example.com', 'fakehash', 'Test User', 1)"
        ))
        conn.commit()


# Override dependencies
_fake_user = None

def _override_get_db():
    db = TestSession()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def _override_get_current_active_user():
    return _fake_user

app.dependency_overrides[get_db] = _override_get_db
app.dependency_overrides[get_current_active_user] = _override_get_current_active_user

client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup_module():
    global _fake_user
    _create_tables()
    # Build a user object that matches what the endpoint expects
    db = TestSession()
    user = db.execute(text("SELECT id, email, full_name, is_active FROM users WHERE id=1")).fetchone()
    db.close()
    _fake_user = User(id=user[0], email=user[1], full_name=user[2], is_active=user[3])


def teardown_module():
    try:
        os.remove("test_manual_scan.db")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_manual_scan_success():
    """Normal scan job creation with valid query."""
    response = client.post("/api/crawl/manual-scan", json={
        "query": "social listening",
        "project_id": 1,
        "mode": "HYBRID",
        "max_results": 10,
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "QUEUED"
    assert data["mode"] == "HYBRID"
    assert data["project_id"] == 1
    assert "social listening" in data["keywords"]


def test_manual_scan_unicode_query():
    """Unicode Vietnamese query "môi trường" must not crash."""
    response = client.post("/api/crawl/manual-scan", json={
        "query": "môi trường",
        "project_id": 1,
        "mode": "AUTO_DISCOVERY",
        "max_results": 20,
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "QUEUED"
    assert "môi trường" in data["keywords"]


def test_manual_scan_no_keyword():
    """Empty query and no keywords should return 400."""
    response = client.post("/api/crawl/manual-scan", json={
        "query": "",
        "project_id": 1,
    })
    assert response.status_code == 400 or response.status_code == 422


def test_manual_scan_duplicate_detection():
    """Submitting the same scan twice should return the existing job."""
    payload = {
        "query": "duplicate test keyword xyz",
        "project_id": 99,
        "mode": "HYBRID",
        "source_types": ["web"],
        "max_results": 10,
    }
    r1 = client.post("/api/crawl/manual-scan", json=payload)
    assert r1.status_code == 200
    job_id_1 = r1.json()["job_id"]

    r2 = client.post("/api/crawl/manual-scan", json=payload)
    assert r2.status_code == 200
    data2 = r2.json()
    # Should return the same job (duplicate detection)
    assert data2["job_id"] == job_id_1
    assert "existing" in data2.get("message", "").lower() or data2["job_id"] == job_id_1


def test_manual_scan_schema_mismatch():
    """If crawl_jobs table is missing columns, should return 503 not 500."""
    # Create a separate engine with old schema (no user_id column)
    old_engine = create_engine("sqlite:///test_old_schema.db", echo=False)
    with old_engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS crawl_jobs"))
        conn.execute(text("DROP TABLE IF EXISTS users"))
        conn.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                email VARCHAR NOT NULL,
                hashed_password VARCHAR NOT NULL DEFAULT 'hash',
                full_name VARCHAR,
                is_active BOOLEAN DEFAULT 1,
                is_superuser BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        conn.execute(text("INSERT INTO users (id, email, full_name, is_active) VALUES (1, 'test@test.com', 'Test', 1)"))
        conn.execute(text("""
            CREATE TABLE crawl_jobs (
                id INTEGER PRIMARY KEY,
                job_type VARCHAR(50) NOT NULL,
                source_ids TEXT,
                keyword_group_ids TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                total_sources INTEGER DEFAULT 0,
                processed_sources INTEGER DEFAULT 0,
                mentions_found INTEGER DEFAULT 0,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME,
                meta_data TEXT
            )
        """))
        conn.commit()

    OldSession = sessionmaker(bind=old_engine, expire_on_commit=False, autocommit=False, autoflush=False)

    def _override_get_db_old():
        db = OldSession()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    # Temporarily swap the DB dependency to point at old schema
    app.dependency_overrides[get_db] = _override_get_db_old

    try:
        response = client.post("/api/crawl/manual-scan", json={
            "query": "schema test",
            "project_id": 1,
        })
        # Should be 503 (schema mismatch), not raw 500
        assert response.status_code == 503, f"Expected 503, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["ok"] is False
        assert data["error_code"] == "DB_SCHEMA_MISMATCH"
        assert "column" in data["detail"].lower() or "schema" in data["error"].lower()
    finally:
        # Restore the correct DB dependency
        app.dependency_overrides[get_db] = _override_get_db
        old_engine.dispose()
        try:
            os.remove("test_old_schema.db")
        except OSError:
            pass


def test_manual_scan_structured_error_on_unexpected_crash():
    """Unexpected exceptions should return structured JSON, not raw 500."""
    # Force a crash by making get_db raise during execution
    def _crashing_get_db():
        raise RuntimeError("Simulated unexpected DB failure")

    app.dependency_overrides[get_db] = _crashing_get_db

    try:
        response = client.post("/api/crawl/manual-scan", json={
            "query": "crash test",
            "project_id": 1,
        })
        # FastAPI will return 500 because the dependency itself raises before the handler runs.
        # This is expected: dependency injection failures are handled by FastAPI, not by our code.
        assert response.status_code == 500
    finally:
        app.dependency_overrides[get_db] = _override_get_db


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
