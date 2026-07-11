import os
import tempfile
from pathlib import Path

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="saved-filters-"))
TEST_DB_PATH = TEST_DB_DIR / "saved_filters.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "saved-filters-test-secret"
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

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash
import app.models  # noqa: F401
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.main import app

engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False})
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


def teardown_module():
    app.dependency_overrides.pop(get_db, None)
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
        org = Organization(name="Saved Filters Org", slug="saved-filters-org")
        db.add(org)
        db.flush()
        user = User(
            email="saved-filters@example.com",
            hashed_password=get_password_hash("TempPass123!"),
            full_name="Saved Filters User",
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


def _auth_headers(email: str):
    login = client.post(
        "/api/auth/login",
        data={"username": email, "password": "TempPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_importing_app_models_registers_saved_filters_table():
    assert "saved_filters" in Base.metadata.tables

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    assert "saved_filters" in inspect(engine).get_table_names()


def test_saved_filters_endpoint_persists_and_lists_filter(seeded_user):
    headers = _auth_headers(seeded_user["email"])

    created = client.post(
        "/api/saved-filters?project_id=1",
        json={"name": "Positive Web", "filter_json": {"sentiment": "positive", "source_type": "web"}},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["name"] == "Positive Web"

    listed = client.get("/api/saved-filters?project_id=1", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["filter_json"] == {"sentiment": "positive", "source_type": "web"}


def test_mentions_saved_filters_endpoint_smoke_returns_empty_list_not_500(seeded_user):
    headers = _auth_headers(seeded_user["email"])

    response = client.get("/api/saved-filters?project_id=1", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json() == {"items": []}
