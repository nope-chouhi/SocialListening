# i18n Remaining UI Polish Documentation

## Overview
This document outlines the exact fixes applied to address remaining hardcoded strings and raw i18n keys across the Social Listening platform.

## Exact Remaining UI Texts Found and Fixed
1. `frontend/src/app/dashboard/layout.tsx`:
   - `Loading...` -> `t('common.loading')`
   - `Select Project` -> `t('mentions.page.selectProject')`
   - `Active` -> `t('common.active')`
   - `No project` -> `t('mentions.page.noProject')`
   - `Workspace` -> `t('nav.workspace')`
   - `Projects` -> `t('nav.projectsTitle')`
   - `Expand` -> `t('common.expand')`
   - `Collapse` (tooltip) -> `t('common.collapse')`
2. `frontend/src/app/dashboard/reports/page.tsx`:
   - `Uploading...` -> `t('common.uploading')`
   - `Click or drag logo here` -> `t('common.uploadLogo')`
3. `frontend/src/components/reports/ReportEmptyState.tsx`:
   - `No project selected` -> `t('mentions.page.selectProject')`
   - `No report data available` -> `t('reports.noReportData')`
4. `frontend/src/app/dashboard/mentions/page.tsx`:
   - `Days` -> `t('mentions.page.days')`
   - `Weeks` -> `t('mentions.page.weeks')`
   - `Months` -> `t('mentions.page.months')`
5. `scanNow` filter text fixed in non-English locales (e.g. `th.ts`, `ja.ts`, `ko.ts`, `zh.ts`).

## Raw Key Issue Root Cause and Fix
- **Root Cause**: The active filter chips component (`MentionActiveFilterChips.tsx`) was taking the raw values (e.g. `web`, `news`, `facebook_page`) from the search parameters and concatenating them without passing them to the translation hook `t()`.
- **CSS Formatting Factor**: Users reported seeing `MENTIONS.SOURCETYPE.MSG.CONNECT`. This happens when `t()` returns the fallback key string (because it was missing from the loaded dictionary or misspelled), and CSS classes like `uppercase` transform it to all-caps on the screen.
- **Fix Applied**: 
  - Iterated through `filters.source_type.split(',')` and properly mapped each raw source value `s` through `t(\`mentions.sourceType.\${s}\`)` in `MentionActiveFilterChips.tsx`.
  - Added the missing nested `msg.connect` and `msg.comingSoon` keys appropriately in all locales, and verified that translations like "ウェブ" (Japanese) and "Kết nối" (Vietnamese) show up natively.

## Files Changed
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/app/dashboard/mentions/page.tsx`
- `frontend/src/app/dashboard/reports/page.tsx`
- `frontend/src/components/mentions/MentionActiveFilterChips.tsx`
- `frontend/src/components/reports/ReportEmptyState.tsx`
- `frontend/src/i18n/locales/en.ts`
- `frontend/src/i18n/locales/ja.ts`
- `frontend/src/i18n/locales/ko.ts`
- `frontend/src/i18n/locales/th.ts`
- `frontend/src/i18n/locales/vi.ts`
- `frontend/src/i18n/locales/zh.ts`
- `docs/i18n-remaining-ui-polish.md` (this file)

## Keys Added/Updated
- `common.active`
- `common.expand`
- `common.collapse`
- `common.uploading`
- `common.uploadLogo`
- `nav.projectsTitle`
- `reports.noReportData`
- `mentions.page.days`
- `mentions.page.weeks`
- `mentions.page.months`
- Replaced `scanNow: 'Scan Now'` with appropriate native translations in all non-English locales.

## Intentionally Untranslated Terms
- Brand names (`TikTok`, `Reddit`, `Facebook Page`, `Instagram`, `Twitter/X`, `RSS`, `Nope`).
- Technical formats (`JPEG or PNG`).

## Checks Run
- `node scripts/check-i18n-keys.mjs` was run and outputted `All locales have identical key structures.`
- `npm run type-check` was run. It exited non-zero only because of the known pre-existing Jest globals/@types issue in `src/lib/utils/mentions.test.ts`. No new TypeScript errors were introduced in modified i18n/component files.

## Safety Confirmation
- No backend files were touched.
- `backend/app/schemas/service.py` is entirely untouched.
- No bulk codemods were run.
- No external translation APIs/proxies were used.
- No deployments were triggered.
- No database migrations were executed.
- No Render/Vercel restarts were performed.
- Tested locally without pushing directly to `main`.
