# Render Deploy Fix: Missing Croniter Dependency

## Issue
The Render backend deploy failed with a `ModuleNotFoundError` during startup:
```
ModuleNotFoundError: No module named 'croniter'
```

## Root Cause
The file `backend/app/schemas/crawl.py` imports `croniter` to parse and validate cron schedule strings for discovery and crawling jobs, but the package was never added to `backend/requirements.txt`.

## Fix
Added `croniter>=2.0.0` to `backend/requirements.txt`.

## Verification
- Local environment: ran `pip install -r requirements.txt`.
- Import test: `python -c "from croniter import croniter; print('croniter ok')"` completed successfully.
- Startup test: `python -c "from app.main import app; print('app import ok')"` completed successfully.
- Test suite: `python -m pytest tests` ran without import failures.

Since Render automatically deploys on `main` branch updates, merging this change will resolve the deployment crash and restore the backend service.
