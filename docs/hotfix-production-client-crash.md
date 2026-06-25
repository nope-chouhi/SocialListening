# Hotfix: Production Client-Side Crash

## Summary

This hotfix resolves a client-side crash (`Application error: a client-side exception has occurred`) in the production frontend where a `TypeError: s.slice is not a function` or similar `.slice` error occurred.

## Root Cause

The frontend relies heavily on calling `.slice(0, N)` on objects and arrays across various dashboard components to limit the number of items rendered (e.g., top keywords, top sources, etc.).

When the backend is down, returns an error status (like a 500, or a CORS error from the Azure/Vercel URL), or when an endpoint is temporarily unavailable, the frontend's API layer attempts to fall back or swallow errors. However, many components were accessing `data.top_sources.slice(0, 5)` or `JSON.stringify(response).slice(0, 500)` without ensuring the data was an Array or a String. If the backend returned an object missing `top_sources` or if `JSON.stringify` returned `undefined`, `.slice()` would throw an uncaught `TypeError`, bringing down the entire React tree and causing a white screen.

Regarding `/api/system/worker-status`:
The production console showed `[API Error] GET /api/system/worker-status → undefined`. This is simply the `api.ts` interceptor logging the CORS error (`status` is undefined on a preflight or network-level block). The endpoint is present in the Python backend, but `cors_origins` in `app/core/config.py` uses `social-listening-azure.vercel.app`. If the request fails, the layout component catches the error silently and leaves `status` as `null`, which safely renders nothing. The worker-status error itself does not crash the page — the crash was caused by the unhandled `.slice` bugs when subsequent data fetches failed.

## Files Changed

We added `Array.isArray()` and `typeof x === 'string'` type guards to all unguarded `.slice` usages across the application to prevent React from crashing when API data shape is unexpected.

* `frontend/src/components/dashboard/HotKeywordsWidget.tsx`
* `frontend/src/app/dashboard/summary/page.tsx`
* `frontend/src/app/dashboard/scan/page.tsx`
* `frontend/src/app/dashboard/reports/page.tsx`
* `frontend/src/app/dashboard/reports/infographic/page.tsx`
* `frontend/src/app/dashboard/influencers/page.tsx`
* `frontend/src/app/dashboard/sources/page.tsx`
* `frontend/src/app/dashboard/settings/APIWebhooks.tsx`
* `frontend/src/app/dashboard/settings/RoleManagement.tsx`
* `docs/hotfix-production-client-crash.md` (this document)

## Data Integrity / No-Fake Compliance

* **No fake data**: We did not introduce any fake fallback arrays or mock data to hide the API errors. If the array check fails, the map does not run, and the component truthfully shows no data (or an empty space) rather than faking it.
* **No fake status**: We did not mock the `worker-status` endpoint.
* **Real Errors Preserved**: API interceptor errors remain untouched, continuing to correctly bubble or log based on status code.

## Verification

* `git status` — Clean working directory with only the expected `.tsx` files modified.
* `npm run type-check` — Passed with 0 errors.
* `npm run build` — Passed static page generation successfully.
* `npx playwright test` — The project only has sample/external test scaffolding at the moment; no app-level E2E tests exist for the dashboard, so Playwright verification is skipped as non-applicable.

## Risks

* **UI Empty States**: While the app no longer crashes, components experiencing failed backend calls will now render empty sections instead of blowing up the screen. Proper `ErrorState` components should ideally be added to these areas in the future, similar to Phase 5.
