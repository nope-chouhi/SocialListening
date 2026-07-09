# -*- coding: utf-8 -*-
"""Focused regression tests for legacy crawl_jobs schema mismatch handling.

These tests intentionally exercise old/local DB shapes where crawl_jobs is
missing one of the newer nullable columns used by the SQLAlchemy model. The
manual-scan endpoint should return structured 503 JSON instead of leaking a raw
500 when production/dev DB schema is behind the application model.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_manual_scan_schema_regression.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.database import get_db  # noqa: E402
from app.core.security import get_current_active_user  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


def _create_legacy_schema(engine, *, include_user_id: bool, include_scan_schedule_id: bool) -> None:
    """Create a minimal legacy DB with selected crawl_jobs columns missing."""
    optional_columns = []
    if include_user_id:
        optional_columns.append("user_id INTEGER")
    if include_scan_schedule_id:
        optional_columns.append("scan_schedule_id INTEGER")

    optional_sql = ""
    if optional_columns:
        optional_sql = "        " + ",\n        ".join(optional_columns) + ",\n"

    with engine.connect() as conn:
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
        conn.execute(text(f"""
            CREATE TABLE crawl_jobs (
                id INTEGER PRIMARY KEY,
{optional_sql}                job_type VARCHAR(50) NOT NULL,
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


@pytest.mark.parametrize(
    ("include_user_id", "include_scan_schedule_id", "missing_column"),
    [
        (False, True, "user_id"),
        (True, False, "scan_schedule_id"),
    ],
)
def test_manual_scan_returns_structured_503_for_missing_crawl_job_columns(
    tmp_path,
    include_user_id,
    include_scan_schedule_id,
    missing_column,
):
    """Missing user_id or scan_schedule_id should be reported as schema mismatch."""
    db_path = tmp_path / f"legacy_missing_{missing_column}.db"
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    _create_legacy_schema(
        engine,
        include_user_id=include_user_id,
        include_scan_schedule_id=include_scan_schedule_id,
    )
    LegacySession = sessionmaker(bind=engine, expire_on_commit=False, autocommit=False, autoflush=False)

    def _override_get_db_legacy():
        db = LegacySession()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db_legacy
    app.dependency_overrides[get_current_active_user] = lambda: User(
        id=1,
        email="test@test.com",
        full_name="Test",
        is_active=True,
    )

    try:
        response = client.post(
            "/api/crawl/manual-scan",
            json={
                "query": f"schema regression {missing_column}",
                "project_id": 1,
                "mode": "HYBRID",
                "max_results": 5,
            },
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_active_user, None)
        engine.dispose()

    assert response.status_code == 503, response.text
    data = response.json()
    assert data["ok"] is False
    assert data["error_code"] == "DB_SCHEMA_MISMATCH"
    assert missing_column in data["detail"]
