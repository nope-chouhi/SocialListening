# UI Reports & Analytics UX

## Summary

Phase 5 improves the Reports and Analytics UX across all three report pages (`reports/`, `reports/excel/`, `reports/infographic/`) while preserving all real backend report and export behavior.

Key changes:

1. **Removed a misleading "Export Image" button** from the Infographic page that previously appeared fully functional but silently called `toast.error()` internally. Replaced with a clear `InfographicExportNotice` component.
2. **Introduced a shared `ExportHistoryTable` component** to deduplicate the export history table that was copy-pasted in both PDF and Excel report pages.
3. **Added `ReportDataScopeNotice`** to all three report pages so users always know which project and date range a report covers.
4. **Added `ReportErrorState`** so that API failures during data loading are shown honestly as an error — not silently swallowed or confused with empty data (replacing toast-only error handling).
5. **Added `ReportEmptyState`** for when no project is selected in the PDF report builder.
6. **Added `exportHistoryLoading` state** so the `ExportHistoryTable` can show a proper loading skeleton instead of flashing empty.

## Files Changed

| File | Reason |
|------|--------|
| `frontend/src/components/reports/InfographicExportNotice.tsx` | **[NEW]** Replaces the misleading "Export Image" button with a truthful unavailability notice. |
| `frontend/src/components/reports/ReportDataScopeNotice.tsx` | **[NEW]** Shows which project and date range a report covers. |
| `frontend/src/components/reports/ReportEmptyState.tsx` | **[NEW]** Empty state for when no project is selected or no report data exists. |
| `frontend/src/components/reports/ReportErrorState.tsx` | **[NEW]** Truthful error state surfacing real API error messages with a Retry button. |
| `frontend/src/components/reports/ExportHistoryTable.tsx` | **[NEW]** Shared export history table, deduplicating copy-paste from PDF and Excel pages. |
| `frontend/src/app/dashboard/reports/page.tsx` | **[MODIFY]** Import new components; add `fetchError` state; render `ReportErrorState` and `ReportEmptyState`; add `ReportDataScopeNotice`; replace inline table with `ExportHistoryTable`. |
| `frontend/src/app/dashboard/reports/excel/page.tsx` | **[MODIFY]** Import new components; replace inline export history table with `ExportHistoryTable`; add `ReportDataScopeNotice`. |
| `frontend/src/app/dashboard/reports/infographic/page.tsx` | **[MODIFY]** Remove misleading `handleExport`; add `InfographicExportNotice`; add `ReportDataScopeNotice`; add `ReportErrorState`; add `fetchError` state. |
| `docs/ui-reports-analytics-ux.md` | **[NEW]** This document. |

## Reports UX Improvements

### Misleading Export Image Button — Fixed

The old infographic page had a button labeled "Export Image" that presented a full working-looking UI but internally called `toast.error("Tính năng xuất ảnh đang được hoàn thiện...")`. This is a violation of the project's **Truthful UI** rule. It has been replaced by `InfographicExportNotice`, which:

- Clearly states "Direct image export is not available yet."
- Provides a disabled badge labeled "Unavailable" so users can see the button but understand it is not actionable.
- Instructs users to use their OS screenshot tool instead.

### Report Data Scope Notice — New

All three report pages now show a `ReportDataScopeNotice` banner at the top that clearly communicates:

- Which **project** the report is scoped to (or "All projects" if none is selected).
- Which **date range** is active (e.g., "Last 30 days").

This prevents confusion where users are unsure whether the report reflects the right project.

### Truthful Error States — New

Previously, when the `reports.summaryData()` API call failed, the page would:

1. Show a `toast.error()` notification.
2. Continue rendering with an empty/null data state.

This made it impossible to distinguish a real API failure from "no mentions data." All three pages now capture the error into `fetchError` state and render `ReportErrorState` (with a retry button) when the API fails.

### Export History Table — Deduplicated

The export history table was copy-pasted identically in `reports/page.tsx` and `reports/excel/page.tsx`. It is now extracted into `ExportHistoryTable` which:

- Accepts real export data via props.
- Shows a loading state while fetching.
- Renders status badges (`pending`, `running`, `success`, `failed`) with animations.
- Shows real `error_message` from the backend for failed exports.
- Provides a Download button only for `success` exports (backed by `/api/reports/exports/{id}/download`).

### Report Empty State — New

The PDF report builder now shows `ReportEmptyState` when no active project is selected, instead of rendering an empty builder form with no context.

## Data Integrity / No-Fake Compliance

- No fake reports were created.
- No fake export buttons exist (the previously fake "Export Image" button has been removed and replaced with a truthful unavailability notice).
- No fake PDF generation was added.
- No fake Excel generation was added.
- No fake infographic download or canvas generation was added.
- No fake analytics were introduced.
- No fake AI summaries were introduced.
- No fake API responses were introduced.
- All export history data comes from the real `/api/reports/exports/history` endpoint.
- All download actions go through the real `/api/reports/exports/{id}/download` endpoint.
- Error states show real API error messages from backend responses.

## Missing Backend/API Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| **Infographic Image Export** | ❌ Not available | The backend does not expose an image generation endpoint. The frontend previously silently called `toast.error()`. This is now clearly documented and the UI shows a truthful notice. |
| **Export progress percentage** | ❌ Not available | The `/api/reports/exports/history` returns `status: pending/running/success/failed` but no progress percentage. The UI shows animated "Processing…" for pending/running. |
| **Report scheduling** | ❌ Not available | Scheduled/recurring PDF or Excel reports are not supported by the current backend. |
| **Logo upload in PDF report** | ❌ Not available | The PDF builder has a logo upload area but it is already clearly labeled "coming soon". Not changed in this phase. |
| **Custom date range picker** | ⚠️ Partial | All report pages use a preset date range select. A custom calendar date-range picker is not implemented. |

## Risks

- **Prop-drilling risk**: The `ExportHistoryTable` and other components receive all data via props. State management remains in the parent pages, which is consistent with existing patterns but increases page-level complexity.
- **Polling behavior**: Export history polling (every 5 seconds for pending/running) was preserved as-is from the original code. This is correct behavior tied to real backend status updates.
- **infographic `fetchData` retry**: The `ReportErrorState` retry button calls `fetchData` which re-fetches from the real backend — no fake fallback.

## Verification

### Commands Run

```
npm run type-check   → passed
npm run build        → passed
```

### Playwright

No Playwright E2E tests for the report pages exist. The existing `playwright.config.ts` runs sample/example tests only. No claim is made for app-level E2E coverage of the report pages.
