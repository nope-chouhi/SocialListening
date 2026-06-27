# Mentions Sentiment Facets — Spec

## New endpoint

GET /api/mentions/sentiment-facets

## Response shape

{
  "positive": number,
  "neutral": number,
  "negative": number,
  "unknown": number,
}

All values are integers >= 0. Counts come from DB GROUP BY Mention.sentiment with the same visibility filters used by the mentions list.

## Supported filters

- project_id
- q / search_query / keyword
- date_from / date_to
- source_type / source_types
- source_id
- domain
- job_id
- sentiment (single, comma-separated)
- sentiments (multi)

Filters are applied consistently with /api/mentions and /api/mentions/summary, except this endpoint focuses on sentiment dimension.

## Frontend usage

Mentions sidebar Cảm xúc calls mentionsApi.sentimentFacets(current filters) and shows the returned positive/neutral/negative/unknown counts. Re-run this call when filters change.

## Risks / limitations

- unknown counts for values outside positive/neutral/negative.
- Deleted, muted, synthetic, and bad Google News discovery URLs are excluded from all counts.
- Frontend type-check currently fails globally due missing TS deps in this environment (`react`, `lucide-react`, `axios`, `@types/node`, `tailwindcss` types). Do not treat those as regressions from this branch.
