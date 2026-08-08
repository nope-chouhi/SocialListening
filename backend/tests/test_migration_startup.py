from pathlib import Path
from unittest.mock import ANY, MagicMock, Mock, call
import re

import pytest
from sqlalchemy import DateTime, String, Text
from sqlalchemy.sql.sqltypes import VARCHAR

from app.core import free_mvp_maintenance, migration_startup
from app.scripts import bootstrap_production_migrations


def _revision(revision: str, down_revision):
    item = Mock()
    item.revision = revision
    item.down_revision = down_revision
    return item


def _script_with_valid_lineage() -> Mock:
    script = Mock()
    script.get_heads.return_value = [migration_startup.EXPECTED_REVISION]
    revisions = {
        migration_startup.STRANDED_REVISION: _revision(
            migration_startup.STRANDED_REVISION,
            migration_startup.BRANCHPOINT_REVISION,
        ),
        migration_startup.MISSING_SIBLING_REVISION: _revision(
            migration_startup.MISSING_SIBLING_REVISION,
            migration_startup.BRANCHPOINT_REVISION,
        ),
        migration_startup.MERGE_REVISION: _revision(
            migration_startup.MERGE_REVISION,
            (
                migration_startup.MISSING_SIBLING_REVISION,
                migration_startup.STRANDED_REVISION,
            ),
        ),
        migration_startup.LEGACY_ANCESTOR_REVISION: _revision(
            migration_startup.LEGACY_ANCESTOR_REVISION,
            migration_startup.LEGACY_PARENT_REVISION,
        ),
        migration_startup.LEGACY_CHILD_REVISION: _revision(
            migration_startup.LEGACY_CHILD_REVISION,
            migration_startup.LEGACY_ANCESTOR_REVISION,
        ),
    }
    script.get_revision.side_effect = revisions.get
    script.iterate_revisions.return_value = [
        _revision(migration_startup.EXPECTED_REVISION, "parent"),
        revisions[migration_startup.MERGE_REVISION],
        revisions[migration_startup.LEGACY_CHILD_REVISION],
        revisions[migration_startup.LEGACY_ANCESTOR_REVISION],
    ]
    return script


def _install_script(monkeypatch, script=None):
    script = script or _script_with_valid_lineage()
    monkeypatch.setattr(
        migration_startup.ScriptDirectory,
        "from_config",
        Mock(return_value=script),
    )
    return script


def test_exact_stranded_state_repairs_before_normal_upgrade(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    heads = iter(
        [
            (migration_startup.STRANDED_REVISION,),
            tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
            (migration_startup.EXPECTED_REVISION,),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    result = migration_startup.run_verified_startup_migrations(Path("backend"))

    assert result == migration_startup.EXPECTED_REVISION
    assert upgrade.call_args_list == [
        call(ANY, migration_startup.MISSING_SIBLING_REVISION),
        call(ANY, "head"),
    ]


def test_normal_current_database_is_noop_before_normal_upgrade(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: (migration_startup.EXPECTED_REVISION,),
    )

    migration_startup.run_verified_startup_migrations(Path("backend"))

    assert upgrade.call_args_list == [call(ANY, "head")]


def test_exact_legacy_ancestor_schema_is_verified_before_normal_upgrade(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    verify_schema = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    verify_schema.return_value = "verified"
    monkeypatch.setattr(
        migration_startup, "_verify_or_repair_legacy_ancestor_schema", verify_schema
    )
    heads = iter(
        [
            (migration_startup.LEGACY_ANCESTOR_REVISION,),
            (migration_startup.EXPECTED_REVISION,),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    result = migration_startup.run_verified_startup_migrations(Path("backend"))

    assert result == migration_startup.EXPECTED_REVISION
    verify_schema.assert_called_once_with((migration_startup.LEGACY_ANCESTOR_REVISION,))
    assert upgrade.call_args_list == [call(ANY, "head")]


def test_legacy_ancestor_schema_mismatch_fails_before_migration(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_verify_or_repair_legacy_ancestor_schema",
        Mock(side_effect=migration_startup.StartupMigrationError("schema mismatch")),
    )
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: (migration_startup.LEGACY_ANCESTOR_REVISION,),
    )

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_legacy_ancestor_diagnostic_is_exact_and_reachable():
    reason, reachable = migration_startup._diagnose_database_heads(
        _script_with_valid_lineage(),
        (migration_startup.LEGACY_ANCESTOR_REVISION,),
        (migration_startup.EXPECTED_REVISION,),
    )
    assert reason == migration_startup.DIAGNOSTIC_REASON_LEGACY_ANCESTOR
    assert reachable is True


def _legacy_schema_contract():
    columns = [
        {"name": "verification_status", "type": VARCHAR(50), "nullable": True},
        {"name": "verification_error", "type": Text(), "nullable": True},
        {"name": "verified_at", "type": DateTime(timezone=True), "nullable": True},
        {"name": "original_url", "type": Text(), "nullable": True},
        {"name": "canonical_url", "type": Text(), "nullable": True},
    ]
    indexes = [
        {
            "name": "ix_mentions_verification_status",
            "column_names": ["verification_status"],
            "unique": False,
        }
    ]
    return columns, indexes


def _install_schema_inspector(monkeypatch, columns, indexes):
    inspector = Mock()
    inspector.get_table_names.return_value = ["mentions"]
    inspector.get_columns.return_value = columns
    inspector.get_indexes.return_value = indexes
    connection = Mock()
    test_engine = MagicMock()
    test_engine.connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(migration_startup, "engine", test_engine)
    monkeypatch.setattr(migration_startup, "inspect", Mock(return_value=inspector))


@pytest.mark.parametrize(
    ("defect", "reason"),
    [
        ("missing_verification_status", migration_startup.SCHEMA_REASON_COLUMN_MISSING),
        ("wrong_verification_status_length", migration_startup.SCHEMA_REASON_COLUMN_TYPE),
        ("wrong_verification_error_type", migration_startup.SCHEMA_REASON_COLUMN_TYPE),
        ("verified_at_without_timezone", migration_startup.SCHEMA_REASON_TIMESTAMP_TIMEZONE),
        ("wrong_original_url_type", migration_startup.SCHEMA_REASON_COLUMN_TYPE),
        ("wrong_canonical_url_type", migration_startup.SCHEMA_REASON_COLUMN_TYPE),
        ("unexpected_not_null", migration_startup.SCHEMA_REASON_COLUMN_NULLABILITY),
        ("missing_index", migration_startup.SCHEMA_REASON_INDEX_MISSING),
        ("wrong_index_columns", migration_startup.SCHEMA_REASON_INDEX_COLUMN),
        ("unique_index", migration_startup.SCHEMA_REASON_INDEX_UNIQUENESS),
        ("multiple_mismatches", migration_startup.SCHEMA_REASON_MULTIPLE),
    ],
)
def test_legacy_schema_guard_emits_bounded_contract_diagnostic(
    monkeypatch, caplog, defect, reason
):
    columns, indexes = _legacy_schema_contract()
    by_name = {column["name"]: column for column in columns}
    if defect == "missing_verification_status":
        columns.remove(by_name["verification_status"])
    elif defect == "wrong_verification_status_length":
        by_name["verification_status"]["type"] = VARCHAR(255)
    elif defect == "wrong_verification_error_type":
        by_name["verification_error"]["type"] = String(50)
    elif defect == "verified_at_without_timezone":
        by_name["verified_at"]["type"] = DateTime(timezone=False)
    elif defect == "wrong_original_url_type":
        by_name["original_url"]["type"] = String(50)
    elif defect == "wrong_canonical_url_type":
        by_name["canonical_url"]["type"] = String(50)
    elif defect == "unexpected_not_null":
        by_name["canonical_url"]["nullable"] = False
    elif defect == "missing_index":
        indexes.clear()
    elif defect == "wrong_index_columns":
        indexes[0]["column_names"] = ["canonical_url"]
    elif defect == "unique_index":
        indexes[0]["unique"] = True
    elif defect == "multiple_mismatches":
        columns.remove(by_name["verification_status"])
        indexes[0]["unique"] = True

    _install_schema_inspector(monkeypatch, columns, indexes)

    with caplog.at_level("ERROR"), pytest.raises(
        migration_startup.StartupMigrationError,
        match="legacy ancestor schema verification failed",
    ):
        migration_startup._verify_legacy_ancestor_schema()

    line = next(
        record.getMessage()
        for record in caplog.records
        if record.getMessage().startswith("SCHEMA_CONTRACT_STATE")
    )
    assert f"reason={reason}" in line
    assert "table=mentions" in line
    assert "verification_status" in line
    assert "verification_error" in line
    assert "verified_at" in line
    assert "original_url" in line
    assert "canonical_url" in line
    assert "ix_mentions_verification_status" in line
    assert "credential" not in line.lower()
    assert "database_url" not in line.lower()
    assert "tenant" not in line.lower()
    assert re.fullmatch(r"SCHEMA_CONTRACT_STATE(?: [a-zA-Z0-9_=,:+]+)+", line)
    if defect == "wrong_index_columns":
        assert "actual_columns=canonical_url" in line


def test_exact_legacy_schema_contract_passes_without_diagnostic(monkeypatch, caplog):
    columns, indexes = _legacy_schema_contract()
    _install_schema_inspector(monkeypatch, columns, indexes)

    with caplog.at_level("ERROR"):
        migration_startup._verify_legacy_ancestor_schema()

    assert "SCHEMA_CONTRACT_STATE" not in caplog.text


@pytest.mark.parametrize(
    "heads",
    [
        ("unknown",),
        tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
    ],
)
def test_unknown_or_partial_sibling_state_fails_closed(monkeypatch, heads):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: heads)

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


@pytest.mark.parametrize(
    ("heads", "reason", "reachable"),
    [
        (
            tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
            migration_startup.DIAGNOSTIC_REASON_SIBLING_SET,
            True,
        ),
        (
            (migration_startup.MERGE_REVISION,),
            migration_startup.DIAGNOSTIC_REASON_MERGEPOINT,
            True,
        ),
        (("ffffffffffff",), migration_startup.DIAGNOSTIC_REASON_UNKNOWN, False),
    ],
)
def test_unsupported_states_emit_bounded_revision_diagnostic(
    monkeypatch, caplog, heads, reason, reachable
):
    script = _install_script(monkeypatch)
    script.iterate_revisions.side_effect = lambda upper, _lower: (
        [
            _revision(migration_startup.MERGE_REVISION, "parent"),
            _revision(migration_startup.LEGACY_CHILD_REVISION, "parent"),
            _revision(migration_startup.LEGACY_ANCESTOR_REVISION, "parent"),
        ]
        if upper == migration_startup.EXPECTED_REVISION
        else [_revision(migration_startup.MERGE_REVISION, "parent")]
        if upper == migration_startup.MERGE_REVISION
        else []
    )
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: heads)

    with caplog.at_level("WARNING"), pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    line = next(record.getMessage() for record in caplog.records if "ALEMBIC_BOOTSTRAP_STATE" in record.getMessage())
    assert f"reason={reason}" in line
    assert f"mergepoint_reachable={str(reachable).lower()}" in line
    assert "credential" not in line.lower()
    assert "database_url" not in line.lower()
    assert "tenant" not in line.lower()
    allowed = re.compile(
        r"^ALEMBIC_BOOTSTRAP_STATE database_revisions=[0-9a-f,]+ "
        r"repository_heads=[0-9a-f,]+ stranded_present=(?:true|false) "
        r"sibling_present=(?:true|false) mergepoint_reachable=(?:true|false) "
        r"reason=[A-Z_]+$"
    )
    assert allowed.fullmatch(line)
    upgrade.assert_not_called()


def test_multiple_version_rows_never_trigger_migration(monkeypatch):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
    )

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_malformed_revision_value_is_redacted_and_never_migrated(monkeypatch, caplog):
    _install_script(monkeypatch)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(
        migration_startup,
        "_database_heads",
        lambda: ("credential-shaped-sensitive-detail",),
    )

    with caplog.at_level("WARNING"), pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    line = next(record.getMessage() for record in caplog.records if "ALEMBIC_BOOTSTRAP_STATE" in record.getMessage())
    assert "credential-shaped-sensitive-detail" not in line
    assert "database_revisions=none" in line
    assert f"reason={migration_startup.DIAGNOSTIC_REASON_UNKNOWN}" in line
    upgrade.assert_not_called()


def test_mergepoint_already_present_never_triggers_migration(monkeypatch):
    script = _install_script(monkeypatch)
    script.iterate_revisions.side_effect = lambda upper, _lower: (
        [
            _revision(migration_startup.MERGE_REVISION, "parent"),
            _revision(migration_startup.LEGACY_CHILD_REVISION, "parent"),
            _revision(migration_startup.LEGACY_ANCESTOR_REVISION, "parent"),
        ]
        if upper == migration_startup.EXPECTED_REVISION
        else [_revision(migration_startup.MERGE_REVISION, "parent")]
        if upper == migration_startup.MERGE_REVISION
        else []
    )
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: (migration_startup.MERGE_REVISION,))

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_repository_graph_mismatch_fails_closed(monkeypatch):
    script = _script_with_valid_lineage()
    script.get_revision(migration_startup.MERGE_REVISION).down_revision = ("unexpected",)
    _install_script(monkeypatch, script)
    upgrade = Mock()
    monkeypatch.setattr(migration_startup.command, "upgrade", upgrade)

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))

    upgrade.assert_not_called()


def test_final_revision_mismatch_fails_closed(monkeypatch):
    _install_script(monkeypatch)
    monkeypatch.setattr(migration_startup.command, "upgrade", Mock())
    heads = iter(
        [
            (migration_startup.STRANDED_REVISION,),
            tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
            ("unexpected-final",),
        ]
    )
    monkeypatch.setattr(migration_startup, "_database_heads", lambda: next(heads))

    with pytest.raises(migration_startup.StartupMigrationError):
        migration_startup.run_verified_startup_migrations(Path("backend"))


def test_bootstrap_failure_prevents_uvicorn_startup():
    render = (Path(__file__).parents[1] / "render.yaml").read_text(encoding="utf-8")
    command_line = next(line.strip() for line in render.splitlines() if "startCommand:" in line)
    assert "python -m app.scripts.bootstrap_production_migrations && uvicorn" in command_line
    assert "alembic upgrade head && uvicorn" not in command_line


def test_bootstrap_failure_emits_only_redacted_error_type(monkeypatch, caplog):
    monkeypatch.setattr(
        bootstrap_production_migrations,
        "run_verified_startup_migrations",
        Mock(side_effect=RuntimeError("credential-shaped-sensitive-detail")),
    )
    with caplog.at_level("CRITICAL"), pytest.raises(SystemExit) as exc_info:
        bootstrap_production_migrations.main()
    assert exc_info.value.code == 3
    assert "RuntimeError" in caplog.text
    assert "credential-shaped-sensitive-detail" not in caplog.text


def test_maintenance_runs_only_after_verified_migrations():
    source = (Path(__file__).parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert source.index("run_verified_startup_migrations(backend_dir)") < source.index(
        "run_free_mvp_maintenance_if_enabled()"
    )


def test_consumed_maintenance_operation_id_cannot_rerun():
    db = Mock()
    db.execute.return_value.first.return_value = None
    with pytest.raises(free_mvp_maintenance.FreeMvpMaintenanceError, match="already consumed"):
        free_mvp_maintenance._claim_operation(db, "consumed-operation")
    db.commit.assert_called_once()


def test_maintenance_contract_has_no_apply_path_and_keeps_revision_guard():
    source = (Path(__file__).parents[1] / "app" / "core" / "free_mvp_maintenance.py").read_text(encoding="utf-8")
    assert "dry_run=True" in source
    assert "--apply" not in source
    assert "database revision does not match the approved revision" in source
    assert free_mvp_maintenance.EXPECTED_REVISION == migration_startup.EXPECTED_REVISION
