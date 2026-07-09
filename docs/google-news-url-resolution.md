# Google News Visit URL Resolution (B4)

## Problem
Google News RSS/article wrappers (`news.google.com/...`) were sometimes stored on mentions and blocked by Visit URL quality gates without attempting deterministic embedded-publisher extraction.

## Fix
1. `resolve_visit_url_candidate()` in `backend/app/services/url_utils.py`
   - clean final URL
   - recover `google.com/url` redirects
   - extract embedded publisher from Google News article wrappers (offline base64 decode)
2. `_mention_link_fields()` in `backend/app/api/mentions.py` uses the helper for candidates including `original_url`.

## Fallback
If resolution fails, Visit remains unavailable with existing blocked reason (no crash, no inventing URLs).

## Tests (offline only)
```powershell
cd backend
D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe -m pytest tests/test_google_news_url_resolution.py tests/test_source_integrity.py -q
```

## Safety
- No migrations / schema changes
- No `backend/app/schemas/service.py`
- No new packages
- No live network in tests
