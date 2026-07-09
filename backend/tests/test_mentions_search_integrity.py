# -*- coding: utf-8 -*-
"""Mentions search field integrity regression tests.

Protects free-text search field mapping for mentions:

- GET /api/mentions: `q` / `search_query` match title, snippet, content only
- must not free-text ilike against URL for search term `q`
- empty/null `q` does not inject a free-text search clause
- `keyword` remains distinct (keyword_text filter)
- `apply_mention_filters()` uses q|search_query on allowed text fields only

Style matches test_mentions_regression.py / test_mentions_verifiable.py:
MagicMock DB + TestClient + compiled SQL string inspection (literal_binds).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.mentions import apply_mention_filters
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.mention import Mention
from app.models.user import User

mock_superuser = User(id=1, email="admin@example.com", is_active=True, is_superuser=True)
mock_db = MagicMock()


def _override_get_user():
    return mock_superuser


def _override_get_db():
    yield mock_db


@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[get_current_active_user] = _override_get_user
    app.dependency_overrides[get_db] = _override_get_db
    mock_db.reset_mock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    mock_db.execute.return_value.scalar.return_value = 0
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    yield
    app.dependency_overrides.clear()


client = TestClient(app, raise_server_exceptions=False)


def _compile_sql(stmt) -> str:
    """Compile SQLAlchemy statement with literal binds for assertion-friendly strings."""
    try:
        return str(stmt.compile(compile_kwargs={"literal_binds": True}))
    except Exception:
        # Fallback when some binds cannot be rendered literally
        return str(stmt)


def _executed_query_strings():
    strings = []
    for call in mock_db.execute.call_args_list:
        if not call[0]:
            continue
        query_obj = call[0][0]
        strings.append(_compile_sql(query_obj).lower())
    return strings


def _joined_sql():
    return "\n".join(_executed_query_strings())


def _free_text_url_ilike_present(sql: str) -> bool:
    """True if free-text ilike is applied against a URL column (not noise notilike).

    List path always applies url NOTILIKE filters for Google/RSS noise. Those must
    not be confused with free-text q matching URL.
    """
    # Remove notilike noise filters first so residual "ilike" on url is free-text search.
    cleaned = sql.replace("not ilike", "NOT_ILIKE").replace("notilike", "NOT_ILIKE")
    markers = (
        "mentions.url ilike",
        "mention.url ilike",
        ".url ilike",
        "original_url ilike",
        "canonical_url ilike",
        "permalink ilike",
        "source_url ilike",
    )
    return any(m in cleaned for m in markers)


# ---------------------------------------------------------------------------
# apply_mention_filters unit checks (pure SQL construction, no HTTP)
# ---------------------------------------------------------------------------


def test_apply_mention_filters_q_matches_title_content_not_url():
    """Helper: free-text q/search_query filters allowed text fields, not URL."""
    base = select(Mention)
    filtered = apply_mention_filters(base, q="brandx-unique")
    sql = _compile_sql(filtered).lower()

    assert "brandx-unique" in sql
    assert "title" in sql
    assert "content" in sql
    # apply_mention_filters also allows author/domain (not URL)
    assert not _free_text_url_ilike_present(sql)
    assert "original_url" not in sql or "original_url ilike" not in sql.replace(
        "notilike", ""
    )


def test_apply_mention_filters_empty_q_is_noop():
    """Helper: empty/None q must not inject free-text ilike."""
    base = select(Mention)
    no_q = _compile_sql(apply_mention_filters(base, q=None)).lower()
    empty_q = _compile_sql(apply_mention_filters(base, q="")).lower()
    with_q = _compile_sql(apply_mention_filters(base, q="only-when-set")).lower()

    assert "only-when-set" in with_q
    assert "only-when-set" not in no_q
    assert "only-when-set" not in empty_q
    # empty pattern must not appear as free-text title search
    assert "title ilike '%%'" not in empty_q
    assert "title ilike \"%%\"" not in empty_q


def test_apply_mention_filters_q_does_not_use_keyword_field():
    """Helper free-text q must not confuse with keyword filter fields."""
    base = select(Mention)
    q_only = _compile_sql(apply_mention_filters(base, q="free-text-token")).lower()
    assert "free-text-token" in q_only
    assert "title" in q_only
    assert "content" in q_only
    # free-text path should not require keyword equality filter
    assert "keyword =" not in q_only


def test_apply_mention_filters_keyword_attr_mismatch_is_known():
    """Document helper bug: apply_mention_filters uses Mention.keyword (missing).

    List endpoint correctly filters keyword_text. Helper used by export/tags
    still references Mention.keyword which does not exist on the model.
    App source fix is OUT OF SCOPE for this agent — do not edit app code here.
    """
    base = select(Mention)
    with pytest.raises(AttributeError, match="keyword"):
        apply_mention_filters(base, keyword="exact-kw-token")


def test_apply_mention_filters_search_query_alias():
    """Helper: search_query is interchangeable with q when q is absent."""
    base = select(Mention)
    via_alias = _compile_sql(
        apply_mention_filters(base, search_query="alias-sq-term")
    ).lower()
    # q wins when both provided
    q_wins = _compile_sql(
        apply_mention_filters(base, q="q-wins", search_query="alias-ignored")
    ).lower()

    assert "alias-sq-term" in via_alias
    assert "title" in via_alias
    assert "content" in via_alias
    assert not _free_text_url_ilike_present(via_alias)

    assert "q-wins" in q_wins
    assert "alias-ignored" not in q_wins


# ---------------------------------------------------------------------------
# HTTP list endpoint: compiled SQL integrity
# ---------------------------------------------------------------------------


def test_list_q_applies_title_snippet_content_not_url():
    """GET /api/mentions?q=... free-text must hit title/snippet/content, not URL."""
    token = "brandx-list-q"
    response = client.get(
        "/api/mentions",
        params={"q": token, "project_id": 1, "refresh": True},
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert joined, "expected SQLAlchemy execute calls for list/count"
    assert token in joined

    # Allowed free-text fields on list path
    assert "title" in joined
    assert "snippet" in joined
    assert "content" in joined
    assert not _free_text_url_ilike_present(joined)


def test_list_empty_q_does_not_add_free_text_search_clause():
    """Empty q must not inject free-text title/snippet/content ilike patterns."""
    response = client.get(
        "/api/mentions",
        params={"q": "", "project_id": 1, "refresh": True},
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert "lower(mentions.title) like lower('%%')" not in joined
    assert "lower(mentions.snippet) like lower('%%')" not in joined
    assert "lower(mentions.content) like lower('%%')" not in joined


def test_list_missing_q_still_allows_other_filters():
    """Without q, source_type/sentiment filters still applied."""
    response = client.get(
        "/api/mentions",
        params={
            "project_id": 1,
            "source_type": "news",
            "sentiment": "negative",
            "refresh": True,
        },
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert "source_type" in joined or "news" in joined
    assert "sentiment" in joined or "negative" in joined


def test_list_q_preserves_other_filters():
    """When q is set, other filters remain applied."""
    token = "crisis-token"
    response = client.get(
        "/api/mentions",
        params={
            "q": token,
            "project_id": 7,
            "source_type": "web",
            "sentiment": "negative",
            "refresh": True,
        },
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert token in joined
    assert "project_id" in joined or "7" in joined
    assert "source_type" in joined or "web" in joined
    assert "sentiment" in joined or "negative" in joined
    assert not _free_text_url_ilike_present(joined)


def test_list_keyword_param_uses_keyword_text():
    """keyword query param maps to keyword_text (distinct from free-text q)."""
    token = "exact-kw-list"
    response = client.get(
        "/api/mentions",
        params={"keyword": token, "project_id": 1, "refresh": True},
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert "keyword_text" in joined
    assert token in joined


def test_list_keyword_and_q_are_both_applied_distinctly():
    """When both keyword and q are set, both filters appear independently."""
    response = client.get(
        "/api/mentions",
        params={
            "keyword": "kw-only-token",
            "q": "free-q-token",
            "project_id": 1,
            "refresh": True,
        },
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert "keyword_text" in joined
    assert "kw-only-token" in joined
    assert "free-q-token" in joined
    assert "title" in joined
    assert "content" in joined
    assert not _free_text_url_ilike_present(joined)


def test_list_search_query_alias_matches_text_fields():
    """search_query alias free-text matches title/snippet/content, not URL."""
    token = "alias-list-term"
    response = client.get(
        "/api/mentions",
        params={"search_query": token, "project_id": 1, "refresh": True},
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert token in joined
    assert "title" in joined
    assert "content" in joined
    assert not _free_text_url_ilike_present(joined)


def test_list_q_with_job_id_skips_free_text_branch():
    """When job_id is set, free-text q branch is skipped (if q and not job_id)."""
    response = client.get(
        "/api/mentions",
        params={
            "q": "should-skip-freetext",
            "job_id": 99,
            "project_id": 1,
            "refresh": True,
        },
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert "job_id" in joined or "99" in joined
    assert "should-skip-freetext" not in joined


def test_summary_q_matches_title_snippet_content_not_url():
    """GET /api/mentions/summary?q=... uses title/snippet/content only."""
    token = "summary-q-token"
    response = client.get(
        "/api/mentions/summary",
        params={"q": token, "project_id": 1},
    )
    assert response.status_code == 200, response.text
    joined = _joined_sql()
    assert token in joined
    assert "title" in joined
    assert "snippet" in joined or "content" in joined
    assert "content" in joined
    assert not _free_text_url_ilike_present(joined)
