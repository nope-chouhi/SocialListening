# i18n Screenshot-Visible UI Leftovers

## Overview
This document logs the changes made to address the final remaining translation issues discovered via visual QA (screenshots) of the Mentions dashboard page and its associated shared components. 

## Strings Fixed

### Vietnamese UI fixed when English is selected
These hardcoded Vietnamese strings were found in the `MentionsCard` and `mentions/page.tsx` and have been mapped back to translation dictionary lookups.

* `Nguồn` -> `{t('mentions.sidebar.sources')}`
* `216 kết quả cho '...'` -> `{t('common.results')}` and `{t('common.for')}`
* `Ảnh hưởng` -> `{t('mentions.card.influence')}`
* `Mở bài gốc` -> `{t('mentions.openOriginal')}`
* `Đã xem` -> `{t('common.seen')}`
* `Phân tích AI` -> `{t('mentions.card.analyzeAi')}`

### English UI fixed when Vietnamese is selected
These strings existed in the code correctly utilizing `t()` calls, but their definitions within `vi.ts` were erroneously written in English. The translations in `vi.ts` have been rewritten to native Vietnamese.

* `Mentions & Reach` -> `Đề cập & Tiếp cận`
* `Anti-Noise / Lọc nhiễu` -> `Bộ lọc nhiễu`
* `Active Features:` -> `Đang hoạt động:`
* `Filter by sentiment, source, credibility.` -> `Lọc theo cảm xúc, nguồn, độ uy tín.`
* `Remove spam (Delete).` -> `Loại bỏ tin nhắn rác (Xóa).`
* `Block all posts from a Domain or Author.` -> `Chặn toàn bộ bài từ một Domain hoặc Tác giả.`
* `Advanced Filtering` -> `Lọc nâng cao`
* `Required words` -> `Từ khóa bắt buộc có`
* `Excluded words` -> `Từ khóa loại trừ`
* `Boolean logic (AND/OR)` -> `Biểu thức logic (AND/OR)`
* `Neutral` -> `{t('mentions.sentiment.neutral')}` (mapped fallback in UI)
* `Unknown` -> `{t('common.unknownSource')}` and `{t('common.unknownAuthor')}` (mapped fallback in UI)
* `More` -> `Thêm` (`vi.ts` dict updated)

## Keys Added/Updated
The `en.ts` and `vi.ts` files were correctly updated to reflect these keys, while maintaining structural parity.

## Intentionally Untranslated
Data properties returned by the API indicating brand names and content strings were NOT translated or wrapped in `t()`.
* Crawled post titles
* Author names
* Target domains
* Specific brand sources: `TikTok`, `Reddit`, `Instagram`, `Facebook Page`, `RSS`, `Twitter/X`, `Nope`.

## Checks
- `node scripts/check-i18n-keys.mjs` was executed and reported absolute parity (`All locales have identical key structures`).
- `npm run type-check` was executed and reported no issues with the i18n hooks. The only reported issues are pre-existing missing Jest globals for `mentions.test.ts` due to missing `@types/jest`.

## Safety Confirmation
- No backend schemas or service logic were changed.
- No `backend/app/schemas/service.py` modifications.
- No deployments triggered.
- No migrations.
- No auto-generated non-semantic keys were created.
