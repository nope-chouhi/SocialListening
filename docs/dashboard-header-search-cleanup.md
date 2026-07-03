# Dashboard Header Search Cleanup

## Overview
The global/top header search bar has been removed from all dashboard pages. 

## Rationale
The top search bar with the placeholder `"Tìm từ khóa và tự động quét nếu chưa có dữ liệu..."` was visually redundant and confusing because individual pages (like the Mentions page) already provide their own contextual search and filter inputs (`"Tìm kiếm mentions, từ khóa..."`). To improve usability and prevent ambiguity, the redundant global search bar was removed.

## Behavior Preserved
- Page-specific local search/filter inputs (e.g. inside `/dashboard/mentions`) are fully intact.
- Action buttons inside page content (e.g. "Scan Now") remain functional.
- The right side of the top header layout (worker status, upgrade, user profile, etc.) remains fully functional and is gracefully aligned.
- **No API Changes**: This was purely a frontend layout adjustment. No underlying API behaviors or endpoints were modified.
