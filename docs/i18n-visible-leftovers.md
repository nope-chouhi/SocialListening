# i18n Visible Leftovers (B3)

## Scope
Zero-touch PR for high-confidence screenshot-visible UI chrome leftovers + locale parity.

## P0 — Locale parity
Added missing keys to `th`/`ja`/`ko`/`zh` (already present in `vi`/`en`):
- `common.results`
- `common.for`
- `mentions.sidebar.sources`

## P1 — UI chrome localized
### Settings
- `frontend/src/app/dashboard/settings/page.tsx` — loading, titles, tabs, access denied
- Several settings save buttons use `common.saving` + `settings.save*`

### Mentions
- Bulk delete / delete filter confirm labels
- Delete toast success/error
- Save tags confirm

### Keywords
- Success toasts, search placeholder, delete/cancel confirm labels

## New keys
- `common.saving`
- `settings.*` (tabs, titles, save labels)
- `keywords.*`
- `mentions.page.deleteSuccess|deleteError|bulkDelete*|deleteFilter*|saveTags`

## Intentionally not translated
- Crawled mention content, authors, domains
- Platform/product names (TikTok, Reddit, Facebook, Instagram, RSS, Twitter/X)
- URLs, API identifiers, technical IDs
- Audit Logs / API and Webhooks product-style labels kept where intentional

## Checks
```powershell
cd frontend
node scripts/check-i18n-keys.mjs
npm run type-check
```

## Deferred (P2)
Many placeholders on alerts/incidents/assistant/scan/services remain for a follow-up pass.
