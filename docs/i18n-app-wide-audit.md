# App-Wide i18n Consistency Audit

## 1. Locale Key Completeness
An audit script was executed to flatten and compare the translation key structures across all 6 locale files (`vi`, `en`, `th`, `ja`, `ko`, `zh`). The `vi.ts` structure was used as the reference baseline.

### Findings
- **vi.ts**: Complete (Baseline)
- **en.ts**: Missing `nav.workspace` (1 key)
- **th.ts**: Missing 26 keys
- **ja.ts**: Missing 26 keys
- **ko.ts**: Missing 26 keys
- **zh.ts**: Missing 26 keys

**List of missing keys in foreign locales:**
- `nav.workspace`
- `mentions.page.mentionsAndReach`
- `mentions.page.sentimentChart`
- `mentions.page.chartNote`
- `mentions.page.noChartData`
- `mentions.page.days`
- `mentions.page.weeks`
- `mentions.page.months`
- `mentions.page.loading`
- `mentions.page.noProject`
- `mentions.page.selectProject`
- `mentions.page.newProject`
- `mentions.sourceType.web`
- `mentions.sourceType.news`
- `mentions.sourceType.blog`
- `mentions.sourceType.video`
- `mentions.sourceType.rss`
- `mentions.sourceType.facebook_page`
- `mentions.sourceType.instagram`
- `mentions.sourceType.twitter`
- `mentions.sourceType.reddit`
- `mentions.sourceType.tiktok`
- `mentions.sourceType.podcast`
- `mentions.sourceType.msg.connect`
- `mentions.sourceType.msg.comingSoon`
- `mentions.searchPlaceholder`

## 2. Hardcoded String Audit
An AST-based extraction script was run on `frontend/src/app/dashboard` and `frontend/src/components` to identify raw JSX texts and specific UI attributes (`placeholder`, `title`, `label`).

**Summary:**
- Discovered approximately **1,495** hardcoded UI strings.
- Spread across **85** React components and pages.

**Top files with highest density of hardcoded strings:**
1. `src/app/dashboard/sources/page.tsx` (110 strings)
2. `src/app/dashboard/scan/page.tsx` (91 strings)
3. `src/app/dashboard/services/page.tsx` (79 strings)
4. `src/app/dashboard/mentions/page.tsx` (77 strings)
5. `src/app/dashboard/reports/page.tsx` (54 strings)
6. `src/app/dashboard/keywords/page.tsx` (45 strings)
7. `src/app/dashboard/service-requests/[id]/page.tsx` (42 strings)
8. `src/app/dashboard/settings/UserManagement.tsx` (41 strings)
9. `src/app/dashboard/incidents/page.tsx` (37 strings)
10. `src/app/dashboard/reputation/page.tsx` (37 strings)
11. `src/app/dashboard/settings/AuditLogs.tsx` (37 strings)

## 3. Recommended PR Phases
To avoid monolithic and risky PRs, the work will be phased:
1. **Phase 1: Locale structure completeness** (Synchronize keys and backfill translations for missing elements).
2. **Phase 2: Dashboard layout and global components** (Sidebar, Header, Shared States).
3. **Phase 3: Mentions + Analysis + Comparison** (Semantic extractions).
4. **Phase 4: Reports pages** (All report configuration components).
5. **Phase 5: Settings + Services + AI Assistant + Integrations** (Remaining high-density configuration components).

## 4. Risk Notes
- Extracting hardcoded strings manually is tedious and semantic naming is subjective. Extreme care must be taken to maintain context and context-specific translations.
- Component structural integrity is the primary risk when migrating large files with `useLanguage() / t()` hooks. Testing must be prioritized.
- We must avoid translating database enumerations directly when they are passed as data objects. They should be mapped to the UI via translation wrappers.

## 5. Safety Confirmation
- No bulk component modifications have been made.
- Backend schemas (`backend/app/schemas/service.py`) and infrastructure configs were completely untouched.
- `docs/i18n-app-wide-audit.md` and the updated `implementation_plan.md` artifact were the only files modified.
- No database migrations, Render/Vercel deployments, or automated generation of translation keys were executed.
