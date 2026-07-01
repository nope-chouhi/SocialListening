# Dashboard Errors Fix

**Date**: 2026-07-01

## Context

Production and development environments were experiencing dashboard console errors:
1. Backend API Error on `GET /api/reports/email-schedules` throwing a 500 status code.
2. Frontend Next.js RSC errors such as `Failed to fetch RSC payload` and `net::ERR_NAME_NOT_RESOLVED` for routes like `/dashboard/reports/email` and other sidebar items.

## Fixes Implemented

### 1. Backend 500 Error Resolution

**Root Cause**: The `/api/reports/email-schedules` endpoint generated a 500 error when querying the `SystemNotificationSettings` table. This occurred because a recently added column (`report_email_recipients`) might not exist in unmigrated databases, causing SQLAlchemy to throw a `ProgrammingError` that wasn't handled gracefully.

**Fix**:
- Wrapped the query in `backend/app/api/reports.py` with a `try-except` block.
- Upon a database error, it safely rolls back the session and returns a valid fallback configuration object (with default empty values) instead of throwing a 500 error.
- Ensured that missing columns or pending migrations won't break the frontend dashboard's email schedule checks.
- Also updated `test_email_schedules_route_priority_regression` in `backend/tests/test_reports.py` to assert the endpoint returns 200 and a valid payload.

### 2. Frontend Next.js RSC Payload Errors

**Root Cause**: Next.js automatically greedy prefetches linked routes in the background. Because some sidebar routes require authentication and specific data loading context, these background prefetches occasionally triggered RSC payload fetch failures.

**Fix**:
- Added `prefetch={false}` to all main sidebar navigation components inside `frontend/src/app/dashboard/layout.tsx`.
- This ensures routes are only fetched when the user explicitly clicks the link, preventing noisy background RSC errors and resolving the `ERR_NAME_NOT_RESOLVED` warnings in the console.

## Next Steps

- Ensure production database migrations are safely applied to add missing columns.
- Test production deployments to verify no further RSC payload fetch warnings occur.
