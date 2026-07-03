# Mention Toolbar Cleanup

## Overview
The mention item toolbar in the SocialListening dashboard was refactored to reduce clutter and improve scanability, especially on smaller screens.

## UI Changes
- **Primary Actions Preserved**: The most frequently used actions (`Mở bài gốc`, `Phân tích AI`, and the `Đã xem` read-status indicator) remain persistently visible on the toolbar. Conditional critical actions like `Cảnh báo` also remain prominent when applicable.
- **Secondary Actions Abstracted**: Secondary actions have been consolidated into a new `MentionActionMenu` dropdown component (`frontend/src/components/mentions/MentionActionMenu.tsx`). This includes:
  - Review
  - Tags
  - Add PDF
  - Mute author
  - Mute site
  - Delete
- **Destructive Actions**: The `Delete` button is visually distinguished within the dropdown menu using red (`rose-600`) text to prevent accidental clicks.
- **Improved UX**: The dropdown supports closing via clicking outside or pressing the `Escape` key.
- **Robust Layout**: Removed `overflow-hidden` from the parent mention card to prevent the dropdown from being clipped when expanding upwards. Rounded corners on the card header and footer were safely preserved.

## API Behavior
- **No API Changes**: This was purely a frontend UI refactor. All underlying API behaviors, endpoints, and action handlers remain completely unchanged. The original functional callbacks are simply passed as props to the new `MentionActionMenu` component.
