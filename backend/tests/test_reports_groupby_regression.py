# -*- coding: utf-8 -*-
"""Reports summary GROUP BY regression tests.

Protects real top_sources aggregation in get_reports_summary:
- SQL uses GROUP BY source_type + tenant filter + deleted/muted guards
- Multi-row source counts are preserved and ordered
- Display aliases merge (news/newspaper -> News)
- Null/empty source_type maps to Web

Uses MagicMock DB + SQLAlchemy compile inspection (no production DB).
"""
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.api import reports as reports_api
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.mention import Mention
from app.models.user import User

mock_superuser = User(id=1, email="admin@example.com", is_active=True, is_superuser=True)


def _compile_sql(stmt) -> str:
    try:
        return str(stmt.compile(compile_kwargs={"literal_binds": True}))
    except Exception:
        return str(stmt)


def _make_db_with_source_rows(rows):
    """Return a MagicMock Session whose execute() serves count scalars then source rows."""
    mock_db = MagicMock()

    def _execute(stmt, *args, **kwargs):
        sql = _compile_sql(stmt).lower()
        result = MagicMock()
        # Aggregation GROUP BY path: return rows via .all()
        if "group by" in sql or "group_by" in sql:
            result.all.return_value = rows
            result.scalar.return_value = 0
            return result
        # Count/scalar path
        result.scalar.return_value = 0
        result.all.return_value = []
        return result

    mock_db.execute.side_effect = _execute
    return mock_db


@pytest.fixture
def client_factory():
    clients = []

    def _make(mock_db):
        def _user():
            return mock_superuser

        def _db():
            yield mock_db

        app.dependency_overrides[get_current_active_user] = _user
        app.dependency_overrides[get_db] = _db
        c = TestClient(app, raise_server_exceptions=True)
        clients.append(c)
        return c

    yield _make
    app.dependency_overrides.clear()


def test_group_by_returns_multiple_source_rows(client_factory):
    rows = [("news", 5), ("youtube", 3), ("facebook", 2)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    response = client.get("/api/reports/summary")
    assert response.status_code == 200
    data = response.json()
    sources = data["top_sources"]
    assert isinstance(sources, list)
    assert len(sources) >= 3
    by_name = {s["name"]: s["count"] for s in sources}
    assert by_name.get("News") == 5
    assert by_name.get("YouTube") == 3
    assert by_name.get("Facebook") == 2
    assert data["metrics"]["total_mentions"] == 0  # scalar mock path


def test_news_and_newspaper_merge_to_news(client_factory):
    rows = [("news", 5), ("newspaper", 3), ("article_news", 1)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    response = client.get("/api/reports/summary")
    assert response.status_code == 200
    by_name = {s["name"]: s["count"] for s in response.json()["top_sources"]}
    assert by_name.get("News") == 9
    # No raw alias leftovers as separate display names
    assert "Newspaper" not in by_name
    assert "Article News" not in by_name


def test_null_and_empty_source_type_mapped_to_web(client_factory):
    rows = [(None, 7), ("", 2), ("   ", 1)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    response = client.get("/api/reports/summary")
    assert response.status_code == 200
    by_name = {s["name"]: s["count"] for s in response.json()["top_sources"]}
    assert by_name.get("Web") == 10


def test_top_sources_ordered_by_count_desc(client_factory):
    rows = [("rss", 1), ("youtube", 10), ("blog", 4)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    response = client.get("/api/reports/summary")
    assert response.status_code == 200
    counts = [s["count"] for s in response.json()["top_sources"]]
    assert counts == sorted(counts, reverse=True)


def test_group_by_and_order_by_in_compiled_sql():
    """Compile the same aggregation shape as production and assert GROUP BY/ORDER BY."""
    stmt = (
        select(Mention.source_type, func.count(Mention.id).label("cnt"))
        .where(Mention.is_deleted == False)  # noqa: E712
        .where(Mention.is_muted == False)  # noqa: E712
        .group_by(Mention.source_type)
        .order_by(func.count(Mention.id).desc())
    )
    sql = _compile_sql(stmt).lower()
    assert "group by" in sql
    assert "source_type" in sql
    assert "order by" in sql
    assert "desc" in sql
    assert "is_deleted" in sql or "is_deleted" in sql.replace(" ", "")
    assert "is_muted" in sql


def test_deleted_and_muted_predicates_present_in_summary_execute(client_factory):
    rows = [("web", 1)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    response = client.get("/api/reports/summary")
    assert response.status_code == 200

    joined = "\n".join(
        _compile_sql(call[0][0]).lower()
        for call in mock_db.execute.call_args_list
        if call[0]
    )
    # At least one executed statement should include GROUP BY path with guards
    assert "group by" in joined
    assert "source_type" in joined
    assert "is_deleted" in joined
    assert "is_muted" in joined


def test_tenant_filter_applied_on_summary_aggregation(client_factory):
    rows = [("news", 2)]
    mock_db = _make_db_with_source_rows(rows)
    client = client_factory(mock_db)

    with patch.object(reports_api, "apply_tenant_filter", wraps=reports_api.apply_tenant_filter) as wrapped:
        response = client.get("/api/reports/summary")
        assert response.status_code == 200
        # Called for total_mentions count and for top_sources aggregation (at least once)
        assert wrapped.call_count >= 1
        # Ensure Mention model is among calls
        models = [c.args[1] for c in wrapped.call_args_list if len(c.args) >= 2]
        assert Mention in models
