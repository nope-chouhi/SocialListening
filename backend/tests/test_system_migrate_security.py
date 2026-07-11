import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from fastapi.openapi.utils import get_openapi

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///test_system_migrate_security.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-tests")
os.environ.setdefault("ENVIRONMENT", "test")

from app.main import app  # noqa: E402
from app.core import security as security_module  # noqa: E402
from app.api import system as system_api  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


def test_system_migrate_route_not_in_openapi_schema():
    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    system_paths = [path for path in schema.get("paths", {}) if path.startswith("/api/system")]
    assert "/api/system/migrate" not in system_paths


def test_get_system_migrate_not_found():
    response = client.get("/api/system/migrate")
    assert response.status_code == 404, response.text


def test_post_system_migrate_not_found():
    response = client.post("/api/system/migrate")
    assert response.status_code == 404, response.text


def test_router_has_no_migrate_route():
    migrate_routes = [route for route in system_api.router.routes if getattr(route, "path", None) == "/migrate"]
    assert migrate_routes == []


def test_removed_migrate_handler_never_calls_alembic_upgrade(monkeypatch):
    called = {"upgrade": False}

    def _fake_upgrade(*args, **kwargs):
        called["upgrade"] = True
        raise AssertionError("upgrade must not run")

    fake_command = SimpleNamespace(upgrade=_fake_upgrade)
    monkeypatch.setattr(system_api, "alembic", SimpleNamespace(command=fake_command), raising=False)

    response = client.get("/api/system/migrate")

    assert response.status_code == 404
    assert called["upgrade"] is False


def test_existing_superuser_dependency_still_denies_non_admin():
    dep = security_module.get_current_superuser
    with pytest.raises(Exception) as exc_info:
        dep(current_user=SimpleNamespace(is_superuser=False))
    assert getattr(exc_info.value, "status_code", None) == 403
