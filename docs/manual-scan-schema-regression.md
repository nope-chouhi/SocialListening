# Manual Scan Schema Regression Tests

## Agent

B1 Agent 1 — backend regression test writer  
Branch: `agent/b1-manual-scan-regression-tests`  
Worktree: `D:\desktop_file\agent-company\workspaces\b1-manual-scan-regression\agent-1-tests`

## Scope (path lock)

Allowed files:

- `backend/tests/test_manual_scan.py`
- `backend/tests/test_manual_scan_schema_regression.py`
- `docs/manual-scan-schema-regression.md`

No application source code modified.  
`backend/app/schemas/service.py` not touched.

## Regression Being Protected

Manual scan job creation depends on SQLAlchemy `CrawlJob`, which declares newer nullable columns on `crawl_jobs`:

- `user_id`
- `scan_schedule_id`

When the live DB schema lags the model, insert/query can fail. The route in `backend/app/api/crawl.py` should return structured **HTTP 503** JSON with:

- `ok: false`
- `error_code: DB_SCHEMA_MISMATCH`
- `detail` naming the missing column when possible

Not a raw unhandled 500.

## Tests

### Tracked file: `backend/tests/test_manual_scan.py`

Added/hardened:

- `test_manual_scan_schema_mismatch` — legacy table missing newer columns → 503
- `test_manual_scan_schema_mismatch_missing_scan_schedule_id` — has `user_id`, missing `scan_schedule_id` → 503 with detail containing `scan_schedule_id`

### Additional: `backend/tests/test_manual_scan_schema_regression.py`

Parametrized:

- `test_manual_scan_returns_structured_503_for_missing_crawl_job_columns`
  - missing `user_id`
  - missing `scan_schedule_id`

Note: root `.gitignore` contains `test_*.py`, so this file may require `git add -f` to track intentionally under `backend/tests/`.

## Commands

Python 3.11 project test venv:

`D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe`

```powershell
cd D:\desktop_file\agent-company\workspaces\b1-manual-scan-regression\agent-1-tests\backend
$py = "D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe"
& $py -m pytest tests/test_manual_scan.py::test_manual_scan_schema_mismatch_missing_scan_schedule_id -q
& $py -m pytest tests/test_manual_scan.py -q
& $py -m pytest tests/test_manual_scan_schema_regression.py -q
```

## Results (B1 Agent 1)

```text
test_manual_scan_schema_mismatch_missing_scan_schedule_id: 1 passed
tests/test_manual_scan.py: 7 passed
tests/test_manual_scan_schema_regression.py: 2 passed
```

## Safety

- No deploy / migration / Render/Vercel restart
- No secrets
- No app source changes
- Local commit only from Agent 1 (no push to main)
