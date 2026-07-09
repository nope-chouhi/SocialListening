# Manual Scan Schema Regression Tests

## Agent

B1 Agent 1 (sl-coder-heavy) — backend regression test writer

## Scope

Branch: `agent/b1-manual-scan-regression-tests`  
Worktree: `D:\desktop_file\agent-company\workspaces\b1-manual-scan-regression\agent-1-tests`  
Base: `main` @ `bff19ed`

Allowed files used:

- `backend/tests/test_manual_scan.py`
- `backend/tests/test_manual_scan_schema_regression.py`
- `docs/manual-scan-schema-regression.md`

No application source code was modified.

## Regression Being Protected

Manual scan job creation depends on the SQLAlchemy `CrawlJob` model, which currently declares these newer nullable columns on `crawl_jobs`:

- `user_id`
- `scan_schedule_id`

The backend route in `backend/app/api/crawl.py` already attempts to avoid broad duplicate-check failures by selecting only needed columns, then catches insert-time missing-column errors and returns structured `503` JSON with `error_code=DB_SCHEMA_MISMATCH` (not a raw unhandled 500).

When production/dev DBs lag migrations, `POST /api/crawl/manual-scan` must surface a clear schema mismatch instead of an opaque server error.

## Tests Added / Extended

### Tracked durable coverage (`backend/tests/test_manual_scan.py`)

Existing tests are preserved. Extended with:

`test_manual_scan_schema_mismatch_missing_scan_schedule_id`

This creates a temporary SQLite legacy schema where `crawl_jobs` includes `user_id` but omits `scan_schedule_id`, then posts to:

`POST /api/crawl/manual-scan`

Expected result:

- HTTP `503`
- JSON `ok: false`
- JSON `error_code: DB_SCHEMA_MISMATCH`
- response `detail` contains `scan_schedule_id`

Related existing coverage:

- `test_manual_scan_schema_mismatch` — fully legacy table missing `user_id` (and other newer columns) → structured 503

### Parametrized focused file (`backend/tests/test_manual_scan_schema_regression.py`)

`test_manual_scan_returns_structured_503_for_missing_crawl_job_columns`

Parametrized cases:

| include_user_id | include_scan_schedule_id | missing_column     |
|-----------------|--------------------------|--------------------|
| False           | True                     | `user_id`          |
| True            | False                    | `scan_schedule_id` |

Note: root `.gitignore` may ignore untracked `test_*.py` patterns. If `git status` shows the new regression file as ignored, force-add it intentionally under `backend/tests/` so CI can collect it.

## How to Run

Use the dedicated Python 3.11 venv:

`D:\desktop_file\agent-company\.venv-sociallistening-py311`

### Single required test

```powershell
cd D:\desktop_file\agent-company\workspaces\b1-manual-scan-regression\agent-1-tests\backend
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_manual_scan.py::test_manual_scan_schema_mismatch_missing_scan_schedule_id -q
```

### Full manual-scan suite

```powershell
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_manual_scan.py -q
```

### Parametrized schema regression file

```powershell
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_manual_scan_schema_regression.py -q
```

### Both files together

```powershell
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_manual_scan.py tests/test_manual_scan_schema_regression.py -q
```

## Environment Notes

- Prefer Python 3.11 for this FastAPI/Pydantic stack.
- Python 3.12+ can hit collection/runtime incompatibilities with the pinned backend deps.
- Tests use SQLite + FastAPI `TestClient` with dependency overrides; no live Postgres required.

## Follow-up

Keep this branch tests/docs-only. Before PR:

```powershell
cd backend
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_manual_scan.py tests/test_manual_scan_schema_regression.py -q
```

If app source fails these tests, stop and report — do not patch `backend/app/**` from this test agent path unless a separate source-fix task is authorized.
