import os
from pathlib import Path
from uuid import uuid4

import psycopg2
import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core import migration_startup


def _test_database_url() -> str:
    value = os.getenv("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL bootstrap proof")
    return value.replace("postgresql+psycopg2://", "postgresql://", 1)


def _write_revision(path: Path, revision: str, down_revision, body: str = "pass") -> None:
    path.write_text(
        "from alembic import op\n"
        "import sqlalchemy as sa\n"
        f"revision = {revision!r}\n"
        f"down_revision = {down_revision!r}\n"
        "branch_labels = None\n"
        "depends_on = None\n"
        f"def upgrade():\n    {body}\n"
        "def downgrade():\n    pass\n",
        encoding="utf-8",
    )


@pytest.mark.parametrize(
    ("starting_revision", "inject_legacy_drift"),
    [
        (migration_startup.STRANDED_REVISION, False),
        (migration_startup.LEGACY_ANCESTOR_REVISION, False),
        (migration_startup.LEGACY_ANCESTOR_REVISION, True),
    ],
)
def test_real_postgres_supported_historical_state_reaches_verified_head(
    tmp_path, monkeypatch, starting_revision, inject_legacy_drift
):
    source = make_url(_test_database_url())
    database_name = f"sl_bootstrap_{uuid4().hex[:12]}"
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
    script_dir = tmp_path / "alembic"
    versions = script_dir / "versions"
    versions.mkdir(parents=True)
    (script_dir / "env.py").write_text(
        "from alembic import context\n"
        "from sqlalchemy import engine_from_config, pool\n"
        "config = context.config\n"
        "with engine_from_config(config.get_section(config.config_ini_section), prefix='sqlalchemy.', poolclass=pool.NullPool).connect() as connection:\n"
        "    context.configure(connection=connection)\n"
        "    with context.begin_transaction():\n"
        "        context.run_migrations()\n",
        encoding="utf-8",
    )
    _write_revision(
        versions / "parent.py",
        migration_startup.LEGACY_PARENT_REVISION,
        None,
        "op.create_table('mentions', sa.Column('id', sa.Integer(), primary_key=True))",
    )
    _write_revision(
        versions / "legacy.py",
        migration_startup.LEGACY_ANCESTOR_REVISION,
        migration_startup.LEGACY_PARENT_REVISION,
        "op.add_column('mentions', sa.Column('verification_status', sa.String(length=50), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('verification_error', sa.Text(), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('original_url', sa.Text(), nullable=True))\n"
        "    op.add_column('mentions', sa.Column('canonical_url', sa.Text(), nullable=True))\n"
        "    op.create_index('ix_mentions_verification_status', 'mentions', ['verification_status'], unique=False)",
    )
    _write_revision(
        versions / "legacy_child.py",
        migration_startup.LEGACY_CHILD_REVISION,
        migration_startup.LEGACY_ANCESTOR_REVISION,
    )
    _write_revision(
        versions / "c4.py",
        migration_startup.BRANCHPOINT_REVISION,
        migration_startup.LEGACY_CHILD_REVISION,
        "op.create_table('bootstrap_probe', sa.Column('id', sa.Integer(), primary_key=True))",
    )
    _write_revision(
        versions / "stranded.py",
        migration_startup.STRANDED_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
    )
    _write_revision(
        versions / "sibling.py",
        migration_startup.MISSING_SIBLING_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
        "op.add_column('bootstrap_probe', sa.Column('sibling_applied', sa.Boolean(), nullable=True))",
    )
    _write_revision(
        versions / "merge.py",
        migration_startup.MERGE_REVISION,
        (migration_startup.MISSING_SIBLING_REVISION, migration_startup.STRANDED_REVISION),
    )
    _write_revision(
        versions / "head.py",
        migration_startup.EXPECTED_REVISION,
        migration_startup.MERGE_REVISION,
    )

    config = Config()
    config.set_main_option("script_location", str(script_dir))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    engine = create_engine(database_url)
    try:
        command.upgrade(config, starting_revision)
        if inject_legacy_drift:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "DROP INDEX ix_mentions_verification_status"
                    )
                )
                connection.execute(
                    text(
                        "ALTER TABLE mentions ALTER COLUMN verification_status "
                        "TYPE VARCHAR"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO mentions (verification_status) "
                        "VALUES ('safe-status')"
                    )
                )
        with engine.connect() as connection:
            assert MigrationContext.configure(connection).get_current_heads() == (
                starting_revision,
            )

        monkeypatch.setattr(migration_startup, "_config", lambda _backend_dir: config)
        def database_heads():
            with engine.connect() as connection:
                return tuple(
                    sorted(MigrationContext.configure(connection).get_current_heads())
                )
        monkeypatch.setattr(
            migration_startup,
            "_database_heads",
            database_heads,
        )
        monkeypatch.setattr(migration_startup, "engine", engine)
        assert migration_startup.run_verified_startup_migrations(tmp_path) == migration_startup.EXPECTED_REVISION
        with engine.connect() as connection:
            assert MigrationContext.configure(connection).get_current_heads() == (
                migration_startup.EXPECTED_REVISION,
            )
        assert "sibling_applied" in {
            column["name"]
            for column in inspect(engine).get_columns("bootstrap_probe")
        }
        assert {
            "verification_status",
            "verification_error",
            "verified_at",
            "original_url",
            "canonical_url",
        }.issubset(
            {column["name"] for column in inspect(engine).get_columns("mentions")}
        )
        assert any(
            index["name"] == "ix_mentions_verification_status"
            for index in inspect(engine).get_indexes("mentions")
        )
    finally:
        engine.dispose()
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


@pytest.mark.parametrize(
    "database_heads",
    [
        (migration_startup.MISSING_SIBLING_REVISION,),
        tuple(sorted((migration_startup.STRANDED_REVISION, migration_startup.MISSING_SIBLING_REVISION))),
        (migration_startup.MERGE_REVISION,),
        ("ffffffffffff",),
    ],
)
def test_real_postgres_unsupported_head_matrix_is_diagnostic_only(
    tmp_path, monkeypatch, database_heads
):
    source = make_url(_test_database_url())
    database_name = f"sl_head_matrix_{uuid4().hex[:12]}"
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
    script_dir = tmp_path / "alembic"
    versions = script_dir / "versions"
    versions.mkdir(parents=True)
    (script_dir / "env.py").write_text("", encoding="utf-8")
    _write_revision(
        versions / "parent.py", migration_startup.LEGACY_PARENT_REVISION, None
    )
    _write_revision(
        versions / "legacy.py",
        migration_startup.LEGACY_ANCESTOR_REVISION,
        migration_startup.LEGACY_PARENT_REVISION,
    )
    _write_revision(
        versions / "legacy_child.py",
        migration_startup.LEGACY_CHILD_REVISION,
        migration_startup.LEGACY_ANCESTOR_REVISION,
    )
    _write_revision(
        versions / "c4.py",
        migration_startup.BRANCHPOINT_REVISION,
        migration_startup.LEGACY_CHILD_REVISION,
    )
    _write_revision(
        versions / "stranded.py",
        migration_startup.STRANDED_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
    )
    _write_revision(
        versions / "sibling.py",
        migration_startup.MISSING_SIBLING_REVISION,
        migration_startup.BRANCHPOINT_REVISION,
    )
    _write_revision(
        versions / "merge.py",
        migration_startup.MERGE_REVISION,
        (migration_startup.MISSING_SIBLING_REVISION, migration_startup.STRANDED_REVISION),
    )
    _write_revision(
        versions / "head.py",
        migration_startup.EXPECTED_REVISION,
        migration_startup.MERGE_REVISION,
    )

    config = Config()
    config.set_main_option("script_location", str(script_dir))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))
            for revision in database_heads:
                connection.execute(
                    text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                    {"revision": revision},
                )

        monkeypatch.setattr(migration_startup, "_config", lambda _backend_dir: config)

        def current_heads():
            with engine.connect() as connection:
                return tuple(sorted(MigrationContext.configure(connection).get_current_heads()))

        monkeypatch.setattr(migration_startup, "_database_heads", current_heads)
        before = current_heads()
        with pytest.raises(
            migration_startup.StartupMigrationError,
            match="database migration state is not supported by bootstrap",
        ):
            migration_startup.run_verified_startup_migrations(tmp_path)
        assert current_heads() == before
    finally:
        engine.dispose()
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
