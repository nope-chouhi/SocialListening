import os
import sys
import tempfile
import gc
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="ai-chat-api-"))
TEST_DB_PATH = TEST_DB_DIR / "ai_chat.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "ai-chat-api-test-secret"
os.environ["ENVIRONMENT"] = "test"
os.environ["RUN_MIGRATIONS_ON_STARTUP"] = "false"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ENABLE_EMBEDDED_SCHEDULER"] = "false"
os.environ["AUTO_SCAN_ENABLED"] = "false"
os.environ["AUTO_DISCOVERY_ENABLED"] = "false"
os.environ["SOCIAL_CRAWL_ENABLED"] = "false"
os.environ["SMTP_ENABLED"] = "false"
os.environ["WEBHOOK_NOTIFICATIONS_ENABLED"] = "false"
os.environ["GEMINI_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.api import ai_chat
from app.core.database import Base, get_db
from app.core.security import get_current_active_user
from app.main import app
from app.models.ai_config import AIChatMessage, AIModelConfig
from app.models.organization import Organization
from app.models.user import User
from app.services.ai_assistant_service import AssistantResult

engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _rec):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user(user_id=1, org_id=1, email="analyst@example.com"):
    return SimpleNamespace(
        id=user_id,
        email=email,
        current_organization_id=org_id,
        is_active=True,
        is_superuser=False,
    )


def _override_user(user):
    def _inner():
        return user

    return _inner


@pytest.fixture(autouse=True)
def db_setup(monkeypatch):
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.add_all([Organization(id=1, name="Org One", slug="org-one"), Organization(id=2, name="Org Two", slug="org-two")])
        db.add_all(
            [
                User(id=1, email="analyst@example.com", hashed_password="x", is_active=True, current_organization_id=1),
                User(id=2, email="other@example.com", hashed_password="x", is_active=True, current_organization_id=1),
            ]
        )
        db.commit()
    finally:
        db.close()

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def teardown_module():
    engine.dispose()
    gc.collect()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except PermissionError:
            pass
    if TEST_DB_DIR.exists():
        try:
            TEST_DB_DIR.rmdir()
        except OSError:
            pass


def _client_for(user=None):
    if user is not None:
        app.dependency_overrides[get_current_active_user] = _override_user(user)
    else:
        app.dependency_overrides.pop(get_current_active_user, None)
    return TestClient(app, raise_server_exceptions=False)


def _db_session():
    return TestingSessionLocal()


def _add_config(user_id=1, enabled=True, api_key="test-key"):
    db = _db_session()
    try:
        config = AIModelConfig(
            user_id=user_id,
            provider="openai",
            api_key=api_key,
            model_name="gpt-4o-mini",
            is_enabled=enabled,
        )
        db.add(config)
        db.commit()
        return config.id
    finally:
        db.close()


def _add_message(user_id, org_id, role, content, created_at, provider=None, model=None):
    db = _db_session()
    try:
        row = AIChatMessage(
            user_id=user_id,
            organization_id=org_id,
            role=role,
            content=content,
            provider=provider,
            model=model,
            created_at=created_at,
        )
        db.add(row)
        db.commit()
        return row.id
    finally:
        db.close()


def _messages():
    db = _db_session()
    try:
        return db.execute(select(AIChatMessage).order_by(AIChatMessage.id)).scalars().all()
    finally:
        db.close()


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("get", "/api/ai/chat/history"),
        ("post", "/api/ai/chat/send"),
        ("delete", "/api/ai/chat/history"),
        ("post", "/api/ai/chat/stream"),
    ],
)
def test_chat_endpoints_reject_unauthenticated_requests(method, url):
    client = _client_for(None)
    if method == "post":
        response = client.post(url, json={"message": "hello"})
    elif method == "delete":
        response = client.delete(url)
    else:
        response = client.get(url)
    assert response.status_code == 401


def test_history_is_owned_ordered_limited_and_tenant_scoped():
    now = datetime.utcnow()
    _add_message(1, 1, "user", "old own org1", now - timedelta(minutes=4))
    _add_message(1, 1, "assistant", "new own org1", now - timedelta(minutes=3))
    _add_message(1, 2, "user", "cross tenant", now - timedelta(minutes=2))
    _add_message(2, 1, "user", "cross user", now - timedelta(minutes=1))

    client = _client_for(_user(user_id=1, org_id=1))
    response = client.get("/api/ai/chat/history?limit=1")

    assert response.status_code == 200, response.text
    body = response.json()
    assert [row["content"] for row in body] == ["new own org1"]
    assert "cross tenant" not in response.text
    assert "cross user" not in response.text


def test_clear_history_deletes_only_current_user_current_tenant_scope():
    now = datetime.utcnow()
    _add_message(1, 1, "user", "delete me", now)
    _add_message(1, 2, "user", "keep tenant", now)
    _add_message(2, 1, "user", "keep user", now)

    client = _client_for(_user(user_id=1, org_id=1))
    response = client.delete("/api/ai/chat/history")

    assert response.status_code == 200, response.text
    assert response.json()["deleted"] == 1
    assert [row.content for row in _messages()] == ["keep tenant", "keep user"]


@pytest.mark.parametrize("payload", [{"message": ""}, {"message": "   "}, {"message": "x" * 8001}, {"message": "ok", "project_id": 999}])
def test_send_rejects_empty_whitespace_excessive_and_unaccepted_project_fields(payload):
    _add_config()
    client = _client_for(_user())
    response = client.post("/api/ai/chat/send", json=payload)
    assert response.status_code == 422


def test_send_requires_config_and_enabled_config():
    client = _client_for(_user())
    missing = client.post("/api/ai/chat/send", json={"message": "hello"})
    assert missing.status_code == 400

    _add_config(enabled=False)
    disabled = client.post("/api/ai/chat/send", json={"message": "hello"})
    assert disabled.status_code == 400


def test_send_persists_user_and_assistant_messages_without_leaking_api_key(monkeypatch):
    _add_config(api_key="super-secret-test-key")

    def fake_call(db, user, config, user_message, history):
        assert user.id == 1
        assert user.current_organization_id == 1
        assert user_message == "summarize"
        assert history[-1]["content"] == "summarize"
        assert "super-secret-test-key" not in str(history)
        return AssistantResult(
            content="safe answer",
            provider="openai",
            model="gpt-4o-mini",
            used_tools=["social_overview"],
            usage={"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
        )

    monkeypatch.setattr(ai_chat, "call_assistant", fake_call)
    client = _client_for(_user())
    response = client.post("/api/ai/chat/send", json={"message": " summarize "})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user_message"]["content"] == "summarize"
    assert body["assistant_message"]["content"] == "safe answer"
    assert body["assistant_message"]["used_tools"] == ["social_overview"]
    assert "super-secret-test-key" not in response.text

    rows = _messages()
    assert [(row.role, row.content, row.organization_id, row.user_id) for row in rows] == [
        ("user", "summarize", 1, 1),
        ("assistant", "safe answer", 1, 1),
    ]


def test_send_provider_failure_returns_safe_error_and_rolls_back_user_message(monkeypatch):
    _add_config(api_key="super-secret-test-key")

    def fail_provider(*_args, **_kwargs):
        raise RuntimeError("provider timeout with super-secret-test-key")

    monkeypatch.setattr(ai_chat, "call_assistant", fail_provider)
    client = _client_for(_user())
    response = client.post("/api/ai/chat/send", json={"message": "hello"})

    assert response.status_code == 502
    assert response.json()["detail"] == ai_chat.AI_PROVIDER_ERROR_DETAIL
    assert "super-secret-test-key" not in response.text
    assert _messages() == []


def test_legacy_chat_endpoint_stays_backward_compatible(monkeypatch):
    _add_config()
    monkeypatch.setattr(
        ai_chat,
        "call_assistant",
        lambda *_args, **_kwargs: AssistantResult(
            content="legacy answer",
            provider="openai",
            model="gpt-4o-mini",
            used_tools=["social_overview"],
            usage={},
        ),
    )

    client = _client_for(_user())
    response = client.post("/api/ai/chat", json=[{"role": "user", "content": "hello"}])

    assert response.status_code == 200, response.text
    assert response.json() == {"role": "assistant", "content": "legacy answer", "used_tools": ["social_overview"]}
    assert _messages() == []


def test_stream_endpoint_returns_sse_events_and_persists_completion(monkeypatch):
    _add_config()

    def fake_stream(*_args, **_kwargs):
        return iter(["hel", "lo"]), ["social_overview"], "openai", "gpt-4o-mini"

    monkeypatch.setattr(ai_chat, "stream_assistant_chunks", fake_stream)
    client = _client_for(_user())
    response = client.post("/api/ai/chat/stream", json={"message": "stream please"})

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: meta" in response.text
    assert "event: chunk" in response.text
    assert "event: done" in response.text
    assert "hello" not in response.text

    rows = _messages()
    assert [(row.role, row.content) for row in rows] == [("user", "stream please"), ("assistant", "hello")]


def test_stream_endpoint_returns_safe_error_event(monkeypatch):
    _add_config(api_key="super-secret-test-key")

    def fail_stream(*_args, **_kwargs):
        raise RuntimeError("provider timeout with super-secret-test-key")

    monkeypatch.setattr(ai_chat, "stream_assistant_chunks", fail_stream)
    client = _client_for(_user())
    response = client.post("/api/ai/chat/stream", json={"message": "stream please"})

    assert response.status_code == 200, response.text
    assert "event: error" in response.text
    assert ai_chat.AI_PROVIDER_ERROR_DETAIL in response.text
    assert "super-secret-test-key" not in response.text

    rows = _messages()
    assert [(row.role, row.content) for row in rows] == [("user", "stream please")]
