import asyncio
import importlib
import inspect
import os
import sys
import types
from pathlib import Path
from unittest.mock import Mock


def _configure_isolated_env(db_path: Path) -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["SECRET_KEY"] = "startup-settings-scope-test-secret"
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


def _fresh_main_module():
    for module_name in [
        "app.main",
        "app.core.config",
        "app.core.database",
    ]:
        sys.modules.pop(module_name, None)
    return importlib.import_module("app.main")


def test_lifespan_side_effect_disabled_startup_completes_without_settings_scope_error(tmp_path, monkeypatch):
    _configure_isolated_env(tmp_path / "startup.db")

    seed_services_if_empty = Mock(name="seed_services_if_empty")
    migration_upgrade = Mock(name="alembic.command.upgrade")
    monkeypatch.setitem(
        sys.modules,
        "alembic.command",
        types.SimpleNamespace(upgrade=migration_upgrade),
    )
    monkeypatch.setitem(
        sys.modules,
        "app.scripts.seed_services",
        types.SimpleNamespace(seed_services_if_empty=seed_services_if_empty),
    )

    main = _fresh_main_module()

    import app.services.scheduler_service as scheduler_service

    start_scheduler = Mock(name="start_scheduler")
    stop_scheduler = Mock(name="stop_scheduler")
    monkeypatch.setattr(scheduler_service, "start_scheduler", start_scheduler)
    monkeypatch.setattr(scheduler_service, "stop_scheduler", stop_scheduler)

    async def enter_and_exit_lifespan():
        async with main.lifespan(main.app):
            assert main.settings.ADMIN_SEED_EMAIL in (None, "")

    asyncio.run(enter_and_exit_lifespan())

    migration_upgrade.assert_not_called()
    seed_services_if_empty.assert_called_once()
    start_scheduler.assert_not_called()
    stop_scheduler.assert_not_called()


def test_lifespan_uses_module_level_settings_without_local_shadowing(tmp_path):
    _configure_isolated_env(tmp_path / "settings.db")
    main = _fresh_main_module()

    lifespan_impl = inspect.unwrap(main.lifespan)

    assert main.settings.DATABASE_URL.startswith("sqlite:///")
    assert "settings" not in lifespan_impl.__code__.co_varnames
