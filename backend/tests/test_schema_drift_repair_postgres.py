import os
from uuid import uuid4

import psycopg2
import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import make_url

from app.core import migration_startup


def _test_database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL schema repair proof")
    return value.replace("postgresql+psycopg2://", "postgresql://", 1)


@pytest.fixture
def repair_engine(monkeypatch):
    source = make_url(_test_database_url())
    database_name = f"sl_schema_repair_{uuid4().hex[:12]}"
    admin = psycopg2.connect(
        host=source.host,
        port=source.port,
        dbname="postgres",
        user=source.username,
        password=source.password,
    )
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{database_name}"')
    admin.close()

    database_url = source.set(database=database_name).render_as_string(hide_password=False)
    test_engine = create_engine(database_url)
    monkeypatch.setattr(migration_startup, "engine", test_engine)
    try:
        yield test_engine
    finally:
        test_engine.dispose()
        admin = psycopg2.connect(
            host=source.host,
            port=source.port,
            dbname="postgres",
            user=source.username,
            password=source.password,
        )
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)')
        admin.close()


def _create_schema(
    engine,
    *,
    status_type="VARCHAR",
    status_nullable=True,
    error_type="TEXT",
    index_mode="absent",
    values=(),
):
    null_sql = "NULL" if status_nullable else "NOT NULL"
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE mentions ("
                "id SERIAL PRIMARY KEY, "
                f"verification_status {status_type} {null_sql}, "
                f"verification_error {error_type} NULL, "
                "verified_at TIMESTAMPTZ NULL, "
                "original_url TEXT NULL, "
                "canonical_url TEXT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
            )
        )
        connection.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
            {"revision": migration_startup.LEGACY_ANCESTOR_REVISION},
        )
        if index_mode == "correct":
            connection.execute(
                text(
                    "CREATE INDEX ix_mentions_verification_status "
                    "ON mentions (verification_status)"
                )
            )
        elif index_mode == "conflicting":
            connection.execute(
                text(
                    "CREATE INDEX ix_mentions_verification_status "
                    "ON mentions (canonical_url)"
                )
            )
        elif index_mode == "unique":
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX ix_mentions_verification_status "
                    "ON mentions (verification_status)"
                )
            )
        for value in values:
            connection.execute(
                text("INSERT INTO mentions (verification_status) VALUES (:value)"),
                {"value": value},
            )


def _status_contract(engine):
    status = next(
        column
        for column in inspect(engine).get_columns("mentions")
        if column["name"] == "verification_status"
    )
    indexes = [
        index
        for index in inspect(engine).get_indexes("mentions")
        if index["name"] == migration_startup.SCHEMA_CONTRACT_INDEX
    ]
    return migration_startup._normalized_schema_type(status["type"]), status["nullable"], indexes


def test_postgres_reflection_distinguishes_varchar_shapes(repair_engine):
    with repair_engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE reflection_probe ("
                "unbounded VARCHAR, v100 VARCHAR(100), v50 VARCHAR(50), "
                "fixed CHAR(12), body TEXT)"
            )
        )
    columns = {
        column["name"]: migration_startup._normalized_schema_type(column["type"])
        for column in inspect(repair_engine).get_columns("reflection_probe")
    }
    assert columns == {
        "unbounded": "varchar_unbounded",
        "v100": "varchar_length_other",
        "v50": "varchar_50",
        "fixed": "character_string_other",
        "body": "text",
    }


@pytest.mark.parametrize(
    ("status_type", "expected_before"),
    [("VARCHAR", "varchar_unbounded"), ("VARCHAR(100)", "varchar_length_other")],
)
def test_exact_drift_with_safe_values_repairs_transactionally(
    repair_engine, caplog, status_type, expected_before
):
    _create_schema(repair_engine, status_type=status_type, values=("new", "reviewed"))
    assert _status_contract(repair_engine)[:2] == (expected_before, True)

    with caplog.at_level("WARNING"):
        result = migration_startup._verify_or_repair_legacy_ancestor_schema(
            (migration_startup.LEGACY_ANCESTOR_REVISION,)
        )

    actual_type, nullable, indexes = _status_contract(repair_engine)
    assert result == "repaired"
    assert (actual_type, nullable) == ("varchar_50", True)
    assert len(indexes) == 1
    assert indexes[0]["column_names"] == ["verification_status"]
    assert indexes[0]["unique"] is False
    assert "over_length_count=0" in caplog.text
    assert migration_startup._verify_or_repair_legacy_ancestor_schema(
        (migration_startup.LEGACY_ANCESTOR_REVISION,)
    ) == "verified"
    assert len(_status_contract(repair_engine)[2]) == 1


def test_over_length_value_fails_closed_with_zero_ddl_and_redacted_log(
    repair_engine, caplog
):
    sensitive_row_value = "do-not-log-" + ("x" * 60)
    _create_schema(repair_engine, values=("ok", sensitive_row_value))

    with caplog.at_level("WARNING"), pytest.raises(
        migration_startup.StartupMigrationError,
        match="length preflight failed",
    ):
        migration_startup._verify_or_repair_legacy_ancestor_schema(
            (migration_startup.LEGACY_ANCESTOR_REVISION,)
        )

    actual_type, nullable, indexes = _status_contract(repair_engine)
    assert (actual_type, nullable, indexes) == ("varchar_unbounded", True, [])
    assert "over_length_count=1" in caplog.text
    assert migration_startup.SCHEMA_REASON_LENGTH_UNSAFE in caplog.text
    assert sensitive_row_value not in caplog.text


@pytest.mark.parametrize(
    ("status_type", "status_nullable", "error_type", "index_mode"),
    [
        ("VARCHAR(50)", True, "TEXT", "absent"),
        ("VARCHAR(100)", True, "TEXT", "correct"),
        ("VARCHAR(100)", True, "TEXT", "conflicting"),
        ("VARCHAR(100)", True, "TEXT", "unique"),
        ("VARCHAR(100)", True, "VARCHAR(80)", "absent"),
        ("VARCHAR(100)", False, "TEXT", "absent"),
    ],
)
def test_nearby_but_unsupported_schema_states_never_mutate(
    repair_engine, status_type, status_nullable, error_type, index_mode
):
    _create_schema(
        repair_engine,
        status_type=status_type,
        status_nullable=status_nullable,
        error_type=error_type,
        index_mode=index_mode,
    )
    before = _status_contract(repair_engine)

    with pytest.raises(
        migration_startup.StartupMigrationError,
        match="legacy ancestor schema verification failed",
    ):
        migration_startup._verify_or_repair_legacy_ancestor_schema(
            (migration_startup.LEGACY_ANCESTOR_REVISION,)
        )

    assert _status_contract(repair_engine) == before


def test_exact_historical_contract_is_a_noop(repair_engine):
    _create_schema(repair_engine, status_type="VARCHAR(50)", index_mode="correct")
    before = _status_contract(repair_engine)
    assert migration_startup._verify_or_repair_legacy_ancestor_schema(
        (migration_startup.LEGACY_ANCESTOR_REVISION,)
    ) == "verified"
    assert _status_contract(repair_engine) == before


def test_unknown_revision_fails_before_schema_mutation(repair_engine):
    _create_schema(repair_engine)
    before = _status_contract(repair_engine)
    with pytest.raises(
        migration_startup.StartupMigrationError,
        match="repair revision is unexpected",
    ):
        migration_startup._verify_or_repair_legacy_ancestor_schema(("ffffffffffff",))
    assert _status_contract(repair_engine) == before


@pytest.mark.parametrize("failure_statement", ["ALTER TABLE", "CREATE INDEX"])
def test_ddl_failure_rolls_back_all_repair_changes(repair_engine, failure_statement):
    _create_schema(repair_engine)

    def reject_statement(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith(failure_statement):
            raise RuntimeError("injected bounded DDL failure")

    event.listen(repair_engine, "before_cursor_execute", reject_statement)
    try:
        with pytest.raises(RuntimeError, match="injected bounded DDL failure"):
            migration_startup._verify_or_repair_legacy_ancestor_schema(
                (migration_startup.LEGACY_ANCESTOR_REVISION,)
            )
    finally:
        event.remove(repair_engine, "before_cursor_execute", reject_statement)

    assert _status_contract(repair_engine) == ("varchar_unbounded", True, [])


def test_post_repair_verification_failure_rolls_back_ddl(repair_engine, monkeypatch):
    _create_schema(repair_engine)
    real_state = migration_startup._legacy_schema_state
    calls = 0

    def fail_second_inspection(connection):
        nonlocal calls
        calls += 1
        state = real_state(connection)
        if calls == 2:
            state["mismatches"] = [migration_startup.SCHEMA_REASON_INDEX_MISSING]
        return state

    monkeypatch.setattr(migration_startup, "_legacy_schema_state", fail_second_inspection)
    with pytest.raises(
        migration_startup.StartupMigrationError,
        match="repair verification failed",
    ):
        migration_startup._verify_or_repair_legacy_ancestor_schema(
            (migration_startup.LEGACY_ANCESTOR_REVISION,)
        )

    assert _status_contract(repair_engine) == ("varchar_unbounded", True, [])
