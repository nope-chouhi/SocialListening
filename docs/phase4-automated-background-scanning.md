# Phase 4: Automated Background Scanning

This document outlines the architecture and implementation details for Phase 4: Automated Background Scanning in the Social Listening Platform.

## 1. Concurrency Control (Advisory Locks)
To prevent identical background tasks from overlapping, we implemented a robust lock mechanism in `scheduler_service.py` (`scheduler_lock`):
- **PostgreSQL**: Utilizes `pg_try_advisory_lock` for cross-process concurrency safety. This ensures that even if multiple worker instances are spun up (e.g., horizontally scaled in production), only one worker can acquire the lock for a given job.
- **SQLite (Development Fallback)**: For local environments using SQLite, a table-level fallback lock was implemented directly on the `WorkerStatus` table using `is_locked` and `locked_at` columns. Note that this SQLite fallback mechanism uses database table locking behavior which functions differently than native Postgres advisory locks, but serves the same purpose of preventing concurrent runs during local development.

## 2. Auto Discovery Integration
- **Scheduled Job**: Configured `APScheduler` to trigger a new `run_scheduled_discovery_scans` job every 6 hours automatically (if `AUTO_DISCOVERY_ENABLED` is true).
- **Target Selection**: The scanner selects active Projects (`KeywordGroup`) that contain valid active Keywords, ignoring groups that have received an auto-discovery scan within the last 24 hours to conserve API limits.

## 3. Observability Metrics
- **WorkerStatus Enhancements**: Added 10 new columns to `worker_status` to track execution metrics natively in the database, including:
  - `scan_interval_minutes`
  - `last_started_at`, `last_finished_at`, `last_success_at`, `next_run_at`
  - `last_scan_count`, `skipped_due_to_lock_count`
- **Frontend Dashboard**: The "Scan Center" worker status bar visualizes `LAST_SCAN` counts and the exact `SUCCESS` timestamp based on these new tracking columns.

## Deployment Notes
- A new Alembic migration (`a34bcad08e54_enhance_worker_status.py`) is included to apply the new observability columns to the `worker_status` table. 
- Deployment environments must run `alembic upgrade head` manually or ensure their deployment scripts handle the migration execution. Do not assume the production pipeline will run it naturally unless explicitly configured.

## 4. Automated Keyword Scanning
Phase 4 automated scanning is implemented and locally verified.
- **Config**: Controlled via `AUTO_SCAN_ENABLED` and `AUTO_SCAN_INTERVAL_MINUTES` in `config.py`.
- **Default Behavior**: Automated scanning is disabled by default (`AUTO_SCAN_ENABLED=False`) to prevent unintended execution during local development and preview deployments. To enable, set `AUTO_SCAN_ENABLED=true` in your `.env` file.
- **Architecture**: The keyword scanner logic operates as a scheduled job injected directly into the unified `scheduler_service.py` using `APScheduler`. It iterates over active keywords grouped by project, avoiding conflicts with overlapping schedules by checking `CrawlJob` states in the database.
- **Shared Pipeline**: Automated scans and Manual scans share the exact same core execution logic (`scan_service.execute_scan`), ensuring perfectly consistent API adapters, AI analysis rules, and content hash deduplication logic (`seen_hashes`).
- **Known Limitation**: `APScheduler` is an in-memory background worker. If the web server crashes or restarts, the interval resets. This is suitable for monolithic background tasks but is not a fully production-ready distributed queue (like Celery/Redis).
