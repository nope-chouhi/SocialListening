import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

# Isolated env before app import
TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="isolated-auth-"))
TEST_DB_PATH = TEST_DB_DIR / "auth.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "isolated-auth-test-secret"
os.environ["ENVIRONMENT"] = "test"
os.environ["RUN_MIGRATIONS_ON_STARTUP"] = "false"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ENABLE_EMBEDDED_SCHEDULER"] = "false"
os.environ["AUTO_SCAN_ENABLED"] = "false"
os.environ["AUTO_DISCOVERY_ENABLED"] = "false"
os.environ["SOCIAL_CRAWL_ENABLED"] = "false"
os.environ["SMTP_ENABLED"] = "false"
os.environ["WEBHOOK_NOTIFICATIONS_ENABLED"] = "false"
os.environ["ADMIN_SEED_EMAIL"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["SERPAPI_API_KEY"] = ""
os.environ["SERPER_API_KEY"] = ""
os.environ["TAVILY_API_KEY"] = ""

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.models.user_settings import UserSession
from app.main import app

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
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app, raise_server_exceptions=False)


def setup_module():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module():
    client.close()
    engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    if TEST_DB_DIR.exists():
        TEST_DB_DIR.rmdir()


@pytest.fixture()
def seeded_user():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        org = Organization(name="Isolated Org", slug="isolated-org")
        db.add(org)
        db.flush()
        user = User(
            email="isolated@example.com",
            hashed_password=get_password_hash("TempPass123!"),
            full_name="Isolated User",
            is_active=True,
            is_superuser=False,
            role="viewer",
            current_organization_id=org.id,
        )
        db.add(user)
        db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="viewer", status="active"))
        db.commit()
        db.refresh(user)
        return {"user_id": user.id, "email": user.email, "org_id": org.id}
    finally:
        db.close()


def _login(email: str, password: str):
    return client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_login_success_invalid_password_and_schema(seeded_user):
    ok = _login(seeded_user["email"], "TempPass123!")
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert set(body.keys()) == {"access_token", "token_type"}
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"].split(".")) == 3

    bad = _login(seeded_user["email"], "wrong-password")
    assert bad.status_code == 401
    assert bad.json()["detail"] == "Incorrect email or password"


def test_auth_me_and_context_match_frontend_contract(seeded_user):
    login = _login(seeded_user["email"], "TempPass123!")
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers=_auth_headers(token))
    assert me.status_code == 200, me.text
    me_body = me.json()
    assert me_body["email"] == seeded_user["email"]
    assert me_body["full_name"] == "Isolated User"
    assert me_body["is_superuser"] is False
    assert me_body["is_active"] is True
    assert "id" in me_body
    assert "created_at" in me_body
    assert "access_token" not in me_body

    context = client.get("/api/auth/me/context", headers=_auth_headers(token))
    assert context.status_code == 200, context.text
    ctx = context.json()
    assert set(ctx.keys()) == {"user", "organizations", "permissions"}
    assert ctx["user"]["id"] == me_body["id"]
    assert ctx["user"]["email"] == me_body["email"]
    assert ctx["user"]["full_name"] == me_body["full_name"]
    assert ctx["user"]["is_superuser"] == me_body["is_superuser"]
    assert ctx["user"]["current_organization_id"] == seeded_user["org_id"]
    assert isinstance(ctx["organizations"], list)
    assert ctx["organizations"][0]["id"] == seeded_user["org_id"]
    assert ctx["organizations"][0]["role"] == "viewer"
    assert isinstance(ctx["permissions"], list)
    assert "report.view" in ctx["permissions"]


def test_protected_read_requires_auth_and_succeeds_with_token(seeded_user):
    unauth = client.get("/api/auth/me/sessions")
    assert unauth.status_code == 401

    login = _login(seeded_user["email"], "TempPass123!")
    token = login.json()["access_token"]

    authed = client.get("/api/auth/me/sessions", headers=_auth_headers(token))
    assert authed.status_code == 200, authed.text
    body = authed.json()
    assert "sessions" in body
    assert isinstance(body["sessions"], list)
    assert len(body["sessions"]) >= 1
    assert "id" in body["sessions"][0]
    assert "expires_at" in body["sessions"][0]


def test_invalid_and_expired_token_rejected_without_server_error(seeded_user):
    invalid = client.get("/api/auth/me", headers=_auth_headers("not-a-real-token"))
    assert invalid.status_code == 401
    assert invalid.json()["detail"] == "Could not validate credentials"

    expired = create_access_token(
        {"sub": str(seeded_user["user_id"]), "jti": "expired-jti"},
        expires_delta=timedelta(minutes=-1),
    )
    expired_resp = client.get("/api/auth/me", headers=_auth_headers(expired))
    assert expired_resp.status_code == 401
    assert expired_resp.json()["detail"] == "Could not validate credentials"


def test_startup_isolation_flags_and_local_state_only(seeded_user):
    assert os.environ["RUN_MIGRATIONS_ON_STARTUP"] == "false"
    assert os.environ["SCHEDULER_ENABLED"] == "false"
    assert os.environ["ENABLE_EMBEDDED_SCHEDULER"] == "false"
    assert os.environ["AUTO_SCAN_ENABLED"] == "false"
    assert os.environ["AUTO_DISCOVERY_ENABLED"] == "false"
    assert os.environ["SOCIAL_CRAWL_ENABLED"] == "false"
    assert os.environ["SMTP_ENABLED"] == "false"
    assert os.environ["WEBHOOK_NOTIFICATIONS_ENABLED"] == "false"
    assert TEST_DB_PATH.exists()

    db = TestingSessionLocal()
    try:
        sessions = db.query(UserSession).all()
        assert all(s.user_id == seeded_user["user_id"] for s in sessions)
        assert all(s.token_jti for s in sessions)
    finally:
        db.close()
