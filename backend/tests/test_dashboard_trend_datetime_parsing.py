import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

TEST_DB_DIR = Path(tempfile.mkdtemp(prefix="dashboard-trend-"))
TEST_DB_PATH = TEST_DB_DIR / "dashboard_trend.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "dashboard-trend-test-secret"
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
from app.core.security import get_password_hash
from app.main import app
from app.models.organization import Organization, OrganizationMember
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.incident import Incident, IncidentStatus
from app.api.dashboard import _normalize_trend_bucket_value

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
def seeded_dashboard_user():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        org = Organization(name="Trend Org", slug="trend-org")
        db.add(org)
        db.flush()
        user = User(
            email="trend@example.com",
            hashed_password=get_password_hash("TrendPass123!"),
            full_name="Trend User",
            is_active=True,
            is_superuser=False,
            role="viewer",
            current_organization_id=org.id,
        )
        db.add(user)
        db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role="viewer", status="active"))

        mention = Mention(
            organization_id=org.id,
            user_id=user.id,
            project_id=1,
            source_type="web",
            platform="web",
            domain="example.com",
            title="Mention title",
            content="Mention content",
            content_hash="trend-mention-1",
            author="Author",
            url="https://example.com/mention-1",
            published_at=datetime.now(timezone.utc) - timedelta(hours=1),
            collected_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(mention)
        db.flush()

        analysis = AIAnalysis(
            mention_id=mention.id,
            sentiment=SentimentScore.NEGATIVE,
            risk_score=73,
            crisis_level=2,
            summary_vi="summary",
            suggested_action="monitor",
            responsible_department="pr",
        )
        db.add(analysis)

        alert = Alert(
            organization_id=org.id,
            user_id=user.id,
            project_id=1,
            mention_id=mention.id,
            severity=AlertSeverity.HIGH,
            status=AlertStatus.NEW,
            title="Alert title",
            message="Alert body",
        )
        db.add(alert)
        db.flush()

        incident = Incident(
            user_id=user.id,
            mention_id=mention.id,
            owner_id=user.id,
            title="Incident title",
            description="Incident body",
            status=IncidentStatus.NEW,
        )
        db.add(incident)
        db.commit()

        return {"email": user.email}
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


def test_normalize_trend_bucket_value_accepts_datetime_date_and_iso_string():
    dt = datetime(2026, 7, 11, 9, 30, tzinfo=timezone.utc)
    d = date(2026, 7, 11)

    assert _normalize_trend_bucket_value(dt) == dt
    assert _normalize_trend_bucket_value(d) == datetime(2026, 7, 11, 0, 0)
    assert _normalize_trend_bucket_value("2026-07-11") == datetime(2026, 7, 11, 0, 0)
    assert _normalize_trend_bucket_value("2026-07-11T09:30:00+00:00") == dt


def test_normalize_trend_bucket_value_rejects_invalid_and_allows_null():
    assert _normalize_trend_bucket_value(None) is None
    with pytest.raises(ValueError):
        _normalize_trend_bucket_value("not-a-date")


def test_dashboard_trends_counts_mentions_negative_alerts_and_incidents_without_sqlite_date_cast_crash(seeded_dashboard_user):
    login = _login(seeded_dashboard_user["email"], "TrendPass123!")
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    resp = client.get(
        "/api/dashboard/trends?range=today&granularity=daily&project_id=1",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["range"] == "today"
    assert body["granularity"] == "daily"
    assert body["items"]

    totals = {
        "total_mentions": sum(item["total_mentions"] for item in body["items"]),
        "negative_mentions": sum(item["negative_mentions"] for item in body["items"]),
        "alerts": sum(item["alerts"] for item in body["items"]),
        "incidents": sum(item["incidents"] for item in body["items"]),
    }
    assert totals == {
        "total_mentions": 1,
        "negative_mentions": 1,
        "alerts": 1,
        "incidents": 1,
    }
