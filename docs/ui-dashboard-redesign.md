# UI Dashboard Redesign

## Summary

This redesign (Phase 2) restructures the `Dashboard Overview` page into a serious, modern, and source-centric interface. We utilized the Phase 1 UI primitives to create small, specific dashboard components and built a consistent information hierarchy. 

We preserved all real API logic without introducing any mock data, fake alerts, or fake trends. The dashboard now cleanly separates the Real-time Monitor from the Historical Overview.

## Files Changed

* `frontend/src/app/dashboard/page.tsx`: Refactored to replace hardcoded markup with structured UI components. Separated realtime and historical data clearly.
* `frontend/src/components/dashboard/DashboardMetricGrid.tsx`: Displays summary KPIs (Total Mentions, Reach, Interactions, Sentiment Score) using `MetricCard`.
* `frontend/src/components/dashboard/MentionTrendCard.tsx`: Wraps the volume trend chart inside an `AppCard` and `SectionHeader`.
* `frontend/src/components/dashboard/SentimentOverviewCard.tsx`: Wraps the sentiment donut chart inside an `AppCard` and `SectionHeader`.
* `frontend/src/components/dashboard/HotKeywordsCard.tsx`: Wraps the hot keywords widget inside an `AppCard` and `SectionHeader`.
* `frontend/src/components/dashboard/RecentMentionsPanel.tsx`: Displays the latest mentions using `AppCard`.
* `frontend/src/components/dashboard/RiskAlertsPanel.tsx`: Displays the latest high-risk alerts using `AppCard`.

## Dashboard UX Improvements

* **Hierarchy**: Separated the dashboard into a "Real-time Monitor" section and a "Historical Overview" section.
* **Metrics & Trends**: Replaced raw KPI rendering with the structured `MetricCard` for clean, consistent alignment and readability. Added `MentionTrendCard` to explicitly show historical volume trends.
* **Alerts & Mentions**: Refactored the two-column layout using `AppCard` for `RecentMentionsPanel` and `RiskAlertsPanel`. Added clear loading and empty states for each panel.
* **Empty/Loading/Error States**: Propagated the `isLoading` prop from the dashboard data hook directly into each component so each card handles its own loading skeletons gracefully without blocking the whole page.

## Data Integrity / No-Fake Compliance

* **No Fake Data**: All data displayed flows directly from `dashboard.summary`, `dashboard.trends`, `dashboard.sentimentSummary`, and `dashboard.hotKeywords`.
* **No Mock APIs**: The `lib/api.ts` was not bypassed or mocked.
* **Truthful Fallbacks**: If the API returns no mentions or no alerts, the `EmptyState` and appropriate placeholder UI is shown. There are no "fake healthy" fallbacks.

## Source-Centric Product Fit

* **Source Coherence First**: The mention panel continues to use `MentionCard` which exposes the real source URL and data.
* **Trust over volume**: By keeping real numbers and real sentiment, the dashboard only shows what the backend has accurately crawled and analyzed.
* **Quality over quantity**: Information is broken down into clear cards rather than overwhelming the user with raw lists.

## Risks

* If the backend APIs do not return data exactly in the expected shape (e.g. `total_reach` vs `reach`), the fallback will safely display `0` rather than throwing a render error.
* The Next.js SWC build might still throw its usual Windows dynamic link library warning, but this does not affect production behavior.

## Verification

The following commands were run:
- `git status`
- `npm run type-check`
- `npm run build`
- `npx playwright test` (Runs setup/browser capability checks. Does not provide real Nope app page coverage yet.)
