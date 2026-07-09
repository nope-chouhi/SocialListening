# Mentions Search Field Integrity

## Agent

B2 Agent 1 — mentions search integrity test writer  
Branch: `agent/b2-mentions-search-integrity-tests`  
Worktree: `D:\desktop_file\agent-company\workspaces\b2-mentions-search-integrity\agent-1-tests`

## Path lock

Allowed:

- `backend/tests/test_mentions_search_integrity.py` (and other `test_mentions*.py` if extended)
- `docs/mentions-search-integrity.md`
- frontend `*.test.ts(x)` only if runner available

No application source modified.

## Field mapping (current product)

### Backend `GET /api/mentions`

| Param | Behavior |
|---|---|
| `q` | Free-text on `title`, `snippet`, `content` when `job_id` is absent |
| `search_query` | Same free-text fields when `job_id` is absent |
| `keyword` | Filters `keyword_text` (distinct from free-text) |
| empty/null `q` | No free-text clause (`if q and not job_id`) |

AGENTS.md: free-text search must not match URL / raw payload / metadata JSON.

### Frontend mentions page

| URL / state | Maps to |
|---|---|
| `?q=` or `?keyword=` | `searchTerm` / `searchInput` |
| filters object | sentiment, source_type, risk, sort — preserved when search changes |

## Tests

File: `backend/tests/test_mentions_search_integrity.py`

- `q` uses title/snippet/content, not URL ilike
- empty `q` does not inject empty free-text title search
- other filters preserved with `q`
- `keyword` uses `keyword_text`
- `search_query` alias works
- `q` + `job_id` skips free-text branch

## Commands

```powershell
cd D:\desktop_file\agent-company\workspaces\b2-mentions-search-integrity\agent-1-tests\backend
$py = "D:\desktop_file\agent-company\.venv-sociallistening-py311\Scripts\python.exe"
& $py -m pytest tests/test_mentions_search_integrity.py -q
& $py -m pytest tests/test_mentions_regression.py tests/test_mentions_verifiable.py -q
```

## Frontend tests

`frontend/package.json` has no `test` script (only type-check/lint/build).  
Existing `frontend/src/lib/utils/mentions.test.ts` is source-label only, not search mapping.  
FE test run: **skipped** (no configured runner) — integrity covered on backend API mapping.

## Safety

- No deploy / migration / secrets
- No app source changes
- Local commit only from Agent 1
