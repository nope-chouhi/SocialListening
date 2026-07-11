import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="auth-userresponse-compat-"))
TEST_DB_PATH = TEST_DB_DIR / "auth.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "auth-userresponse-compat-test-secret"
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
        org = Organization(name="Compat Org", slug="compat-org")
        db.add(org)
        db.flush()
        user = User(
            email="compat@example.com",
            hashed_password=get_password_hash("TempPass123!"),
            full_name="Compat User",
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


def test_authenticated_me_returns_expected_user_contract_without_sensitive_fields(seeded_user):
    login = _login(seeded_user["email"], "TempPass123!")
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers=_auth_headers(token))
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["email"] == seeded_user["email"]
    assert body["full_name"] == "Compat User"
    assert body["is_superuser"] is False
    assert body["is_active"] is True
    assert body["role"] == "viewer"
    assert "id" in body
    assert "created_at" in body
    assert "hashed_password" not in body
    assert "password" not in body
    assert "access_token" not in body


def test_me_context_remains_valid(seeded_user):
    login = _login(seeded_user["email"], "TempPass123!")
    token = login.json()["access_token"]

    context = client.get("/api/auth/me/context", headers=_auth_headers(token))
    assert context.status_code == 200, context.text
    payload = context.json()
    assert set(payload.keys()) == {"user", "organizations", "permissions"}
    assert payload["user"]["email"] == seeded_user["email"]
    assert payload["user"]["current_organization_id"] == seeded_user["org_id"]
    assert isinstance(payload["organizations"], list)
    assert payload["organizations"][0]["id"] == seeded_user["org_id"]
    assert isinstance(payload["permissions"], list)


def test_unauthenticated_me_remains_401():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_invalid_and_expired_token_remain_401(seeded_user):
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
