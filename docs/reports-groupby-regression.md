# Reports GROUP BY Regression (B5)

## Scope
Regression coverage for real `top_sources` aggregation in `GET /api/reports/summary`.

## Protected behavior
- SQL aggregates with `GROUP BY source_type`
- Filters `is_deleted == False` and `is_muted == False`
- Tenant filter applied on aggregation path
- Display aliases merge (`news`/`newspaper`/`article_news` → `News`)
- Null/empty `source_type` → `Web`
- Multi-source rows preserved; ordered by count desc

## Tests
```text
cd backend
python -m pytest tests/test_reports_groupby_regression.py tests/test_reports.py -q
```

## Safety
- No production DB
- No migrations
- No `backend/app/schemas/service.py` changes
