# Frontend i18n Full UI Coverage

## Overview
This document tracks the effort to ensure the selected language acts as the single source of truth for all static frontend UI text across the SocialListening dashboard. Hard-coded strings (e.g., Vietnamese labels like "Đang tải", "Lưu", "Hủy") are being incrementally replaced with the `t()` function from `useLanguage`.

## Phased Approach Strategy
Due to the sheer volume of files (30-40) containing static labels, the translation effort is broken into safe, iterative phases to avoid massive and risky pull requests.

### Phase A: Shared UI Components (Completed)
**Areas Audited & Translated:**
- `ConfirmDialog.tsx`
- `Forbidden.tsx`
- `LoadingSpinner.tsx`
- `ui/Dialog.tsx` (Confirm, Prompt, Alert Dialogs)
- `ui/LoadingState.tsx`

Common UI dictionaries (like `cancel`, `save`, `delete`, `confirm`, `loading`, etc.) were added to `vi.ts`, `en.ts`, `th.ts`, `ja.ts`, `ko.ts`, and `zh.ts`.

### Phase B: Mentions & Data Pages (Completed)
**Areas Audited & Translated:**
- `/dashboard/mentions/*` (Mentions list, search, active filters, empty results)
- `/dashboard/summary/*`
- `/dashboard/comparison/*`
- Chart components (TrendChart, SentimentDonut, ReachInteractions, etc.)

### Phase C: Settings, Services, Reports, AI (Remaining)
**Areas to Audit & Translate:**
- `/dashboard/project-settings/*`
- `/dashboard/settings/*` (User management, Role management, API Webhooks)
- `/dashboard/reports/*` (Email, PDF, Excel, Infographic)
- `/dashboard/services/*`
- `/dashboard/assistant/*`

## Intentionally Untranslated Strings
To maintain data integrity, the following content is explicitly excluded from localization and will remain in its original language:
- **Crawled mention titles and content** (raw data from external sources).
- **User-generated content** (e.g., project names, custom keyword groupings).
- **Brand names and URLs**.
- **API names and Technical identifiers**.
- **Existing AI-generated content** (summaries or analysis payloads returned by the backend).

## Developer Guide: How to Add UI Text
Future developers must **never** hard-code UI labels in React components. 
Instead:
1. Open the relevant locale files (`frontend/src/i18n/locales/*.ts`).
2. Add your English, Vietnamese, Japanese, Thai, Korean, and Chinese translations to the appropriate domain block (e.g., `common`, `mentions`, `reports`).
3. In your React component, call `const { t } = useLanguage();`.
4. Render the text using `{t('domain.key')}`.
