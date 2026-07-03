# i18n Phase 1: Locale Parity Audit & Fix

## Goal
Ensure all 6 locale files (`vi.ts`, `en.ts`, `th.ts`, `ja.ts`, `ko.ts`, `zh.ts`) share the exact same key structure, specifically focusing on fixing missing keys in foreign locales that fell back to Vietnamese/English.

## Missing Keys Fixed
1. `en.ts`: Added `nav.workspace`.
2. `th.ts`: Added 26 keys including `nav.workspace`, `mentions.page.mentionsAndReach`, `mentions.page.sentimentChart`, `mentions.sourceType.web`, etc., with native Thai translations.
3. `ja.ts`: Added 26 keys with native Japanese translations.
4. `ko.ts`: Added 26 keys with native Korean translations.
5. `zh.ts`: Added 26 keys with native Chinese translations.

## Parity Check Script
A safe TypeScript-based check script was added to ensure ongoing parity.
**Path:** `frontend/scripts/check-i18n-keys.mjs`

### How to run:
```bash
cd frontend
node scripts/check-i18n-keys.mjs
```
*Note: This script requires Node.js and the project's TypeScript dependencies to parse the locale `.ts` files.*

## Intentionally Untranslated Terms
As per guidelines, the following product names, technical identifiers, and sources were left as-is (untranslated) across all locales:
- `Web`, `News`, `Blog`, `Video`, `RSS`
- `Facebook Page`, `Instagram`, `Twitter/X`, `Reddit`, `TikTok`, `Podcast`

## Checks Run
- `npm run type-check`: Completed. Exited non-zero strictly due to the known pre-existing Jest globals issue in `src/lib/utils/mentions.test.ts`. No new i18n or syntax errors were introduced.
- `node scripts/check-i18n-keys.mjs`: Completed successfully. Output confirms `All locales have identical key structures`.

## Safety Confirmation
- No backend code or schemas (e.g., `service.py`) were modified.
- No bulk automated codemods or React component logic alterations were performed.
- No external automated translation APIs or proxies were used to generate translations.
- No database migrations, deployments, or server restarts were executed.
