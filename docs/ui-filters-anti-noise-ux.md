# Phase 4: Filters, Search & Anti-Noise UX

## Completed Implementation

Phase 4 modularized the Mentions filtering, searching, and empty state handling while retaining all existing logic and hooks. The changes strictly followed the "Truthful UI" mandate—no faking data, no faking states, and properly exposing real capabilities.

### 1. Component Modularization

The massive `page.tsx` was decomposed into smaller, single-responsibility components under `frontend/src/components/mentions/`:

1.  **MentionFilterBar** (`MentionFilterBar.tsx`): Houses the top bar for sorting, search input, clear filters button, save filters button, refresh, export, and scan actions.
2.  **MentionSearchInput** (`MentionSearchInput.tsx`): The dedicated search bar with a local state for typing, integrated into the `MentionFilterBar`.
3.  **MentionActiveFilterChips** (`MentionActiveFilterChips.tsx`): Renders pills for active sentiment, date range, source, risk, and influence score filters, allowing users to remove them individually or clear all.
4.  **MentionEmptyResults** (`MentionEmptyResults.tsx`): Handles all empty state logic, including typing loading state, scanning loading state, no results today, and general no results. It provides quick actions to expand the date range or clear source filters.
5.  **MentionFilterErrorState** (`MentionFilterErrorState.tsx`): Correctly maps and displays API or network errors during mention fetching instead of simply showing an empty list. It includes a retry button.
6.  **AntiNoiseNotice** (`AntiNoiseNotice.tsx`): Explains the "Anti-Noise Engine" to the user, highlighting how to manage spam through "Mute Domain", "Mute Author", and direct "Delete Mention" controls.

### 2. Integration into `page.tsx`

`frontend/src/app/dashboard/mentions/page.tsx` was refactored to replace massive inline UI blocks with the newly created modular components.

*   Props such as `searchInput`, `filters`, `loading`, `hasActiveFilters`, and callback functions (`setFilters`, `setDateRange`, `fetchMentions`, `handleScanClick`) were drilled down to the components.
*   A new `fetchError` state variable was added to capture exceptions during `fetchMentions`, which is then passed to `MentionFilterErrorState` for a truthful error UI.
*   The "Mute Author", "Mute Domain", and "Delete" capabilities were kept fully functional as they directly hook into the original backend muting/deleting APIs within `page.tsx`.
*   The `AntiNoiseNotice` was injected into the right sidebar to actively educate users on how to train the spam filter.

### 3. Truthful UI & Missing Capabilities

In accordance with the project rules, we do not present "fake" functionality. While basic filtering (by source type, sentiment, risk, and influence scores) is implemented and real, advanced boolean/structured querying is not explicitly supported by the current backend search logic in `mentions.list`.

#### Missing Backend/API Capabilities

*   **Boolean Search**: Searching with structured operators (e.g., "Apple AND NOT fruit") is not officially available in the current backend API filter fields. The search bar relies purely on the keyword query parameter (`q`).
*   **Required/Excluded Words Filter**: There are no dedicated `must_include` or `must_exclude` filter parameters in the `/api/mentions` endpoint.
*   Because these API capabilities are missing, we did **not** add UI elements for them, adhering to the rule: "If backend/API support does not exist or is unclear... Do not add a working-looking button. Do not fake the action."

## Verification Status

*   **TypeScript Check**: `npm run type-check` completed successfully.
*   **Next.js Build**: `npm run build` completed successfully.
*   **Git Status**: Clean, working on the `feat/ui-filters-anti-noise-ux` branch.
