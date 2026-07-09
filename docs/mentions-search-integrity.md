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
`backend/app/**` not edited (including `backend/app/schemas/service.py`).

## Field mapping (current product)

### Backend `GET /api/mentions` (list path)

| Param | Behavior |
|---|---|
| `q` | Free-text on `title`, `snippet`, `content` when `job_id` is absent |
| `search_query` | Same free-text fields when `job_id` is absent |
| `keyword` | Filters `keyword_text` via `ilike` (distinct from free-text `q`) |
| empty/null `q` | No free-text clause (`if q and not job_id`) |
| `q` + `job_id` | Free-text `q` branch skipped; job scoping wins |

AGENTS.md: free-text search must not match URL / raw payload / metadata JSON.  
Noise filters still apply `url NOTILIKE` for Google/RSS junk — that is **not** free-text search.

### Backend `GET /api/mentions/summary`

| Param | Behavior |
|---|---|
| `q` | Free-text on `title`, `snippet`, `content` only |

### Helper `apply_mention_filters()`

Used by tags / export-style routes:

| Param | Behavior |
|---|---|
| `q` or `search_query` | Free-text on `title`, `content`, `author`, `domain` (no URL) |
| `keyword` | **Broken today**: references `Mention.keyword` which does not exist on the model (model has `keyword_text`). List path is correct; helper is not. |

App source fix for the helper is **out of scope** for this agent (tests/docs only). Regression documents the AttributeError until a separate fix lands.

### Frontend mentions page

| URL / state | Maps to |
|---|---|
| `?q=` or `?keyword=` | `searchTerm` / `searchInput` initial state |
| list API call | sends free-text as `params.q` (not `keyword`) so backend searches title/snippet/content |
| filters object | sentiment, source_type, risk, sort — preserved when search changes |

## Tests

File: `backend/tests/test_mentions_search_integrity.py`

**Helper unit checks**

- `q` matches title/content, not URL
- empty/null `q` is a no-op
- free-text `q` does not apply keyword equality
- known `Mention.keyword` AttributeError when helper is called with `keyword=`
- `search_query` alias works; `q` wins when both set

**HTTP list / summary**

- `q` uses title/snippet/content, not URL free-text ilike
- empty `q` does not inject empty free-text patterns
- other filters preserved with/without `q`
- `keyword` uses `keyword_text`
- `keyword` + `q` both applied distinctly
- `search_query` alias works
- `q` + `job_id` skips free-text branch
- summary `q` matches title/snippet/content only

Note: root `.gitignore` contains `test_*.py`, so this file requires `git add -f backend/tests/test_mentions_search_integrity.py`.

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
FE test run: **skipped** (no configured runner) — integrity covered on backend API mapping and documented FE param names above.

## Known app issue (not fixed here)

- `apply_mention_filters(..., keyword=...)` raises `AttributeError: type object 'Mention' has no attribute 'keyword'`
- Affects routes that pass `keyword` into the helper (tags / export paths)
- Main list `GET /api/mentions?keyword=` is fine (`keyword_text`)
- Recommended fix (separate agent): use `Mention.keyword_text` (and ideally align equality vs `ilike` with list path)

## Safety

- No deploy / migration / secrets
- No app source changes
- Local commit only from Agent 1
