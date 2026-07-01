# Scheduled Scanning Runtime Verification

This document clarifies how the background worker and scheduled keyword scanning operate in the **Nope Social Listening Platform**, specifically addressing the Phase 4 runtime execution logic.

## Overview
The application uses **APScheduler** to handle scheduled background jobs rather than relying on a separate Celery worker. APScheduler is natively wired directly into the FastAPI application lifecycle (`lifespan` inside `backend/app/main.py`), making it simple to deploy without extra infrastructure overhead like Redis or separate worker containers.

## Environment Variables
The following environment variables control the execution of the background scheduler and Phase 4 auto-scanning:

1. **`SCHEDULER_ENABLED`**: (Default: `true`) Controls whether APScheduler starts at all during application boot. 
2. **`AUTO_SCAN_ENABLED`**: (Default: `false`) Controls whether automated scan jobs (`run_automated_scans`) are registered with the scheduler. This executes every `AUTO_SCAN_INTERVAL_MINUTES` (Default: 15 minutes) only if enabled.

## Runtime Behavior
### Default & Local Development Behavior
By default, **scheduled scan registration is disabled** (`AUTO_SCAN_ENABLED=false`). This prevents the application from consuming real crawler/API/provider resources automatically just because a developer starts the backend locally.
During local development, you should keep it disabled unless you are deliberately testing the scheduler.

### Render Production Environment
On Render, you must explicitly enable automated scanning by setting the following environment variables in the Render dashboard:
- `SCHEDULER_ENABLED=true`
- `AUTO_SCAN_ENABLED=true`

The FastAPI backend might run with multiple workers (e.g., using `gunicorn` with Uvicorn workers). Because there is no external Celery broker, each worker will technically spin up its own instance of `APScheduler`.

**How duplicate scans are prevented:**
To avoid duplicate overlapping scans triggered by multiple workers, the project uses **Postgres Advisory Locks** (with a fallback to SQLite table-based locking for local dev) via the `scheduler_lock` context manager.
- When it's time to run `run_automated_scans`, the worker will attempt to acquire a database lock.
- If it succeeds, the job executes.
- If it fails (meaning another worker is already handling the scheduled interval), it simply skips execution.

## Verification & Troubleshooting
If you suspect background scanning is not running, check the following:
1. **Environment Variables**: Ensure `AUTO_SCAN_ENABLED=true` is set.
2. **API Status**: You can query the worker status at `/api/system/worker-status` (if the system endpoint is exposed) to verify heartbeat and running jobs.
3. **Server Logs**: Look for the following logs when the application starts:
   - `Background scheduler started`
   - `Phase 4 Automated keyword scanning scheduled every 15 min`
4. **Database Check**: Check the `CrawlJob` table for recent jobs where `job_type = 'auto_scan'`. Check `WorkerStatus` table for `last_heartbeat` and `last_scan_count` metrics.
