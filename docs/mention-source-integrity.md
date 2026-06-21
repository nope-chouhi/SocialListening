# Mention Source Integrity & Source Provenance

This document describes the Mention Source Integrity layer introduced in `feat/mention-source-integrity-fix`.

## Problem Statement

Mention cards could show a title/snippet from one document while attaching it to a different source domain or URL. This "source-binding corruption" occurred because:

1. `source_resolution_service.py` was written but never called in the ingestion pipeline.
2. The `meta_data["source_provenance"]` metadata the API reads for Visit button gating was never written.
3. `domain` on a `Mention` row was set from SerpAPI-provided metadata, not from the final resolved URL.
4. Utility pages (login, help, policy), feed endpoints, and CDN asset URLs could be saved as mentions.

## Solution Architecture

```
RSS / Crawl / Discovery
        │
        ▼
is_article_eligible_url()   ◄── blocks utility, feed, asset, tracking, namespace URLs
        │ PASS
        ▼
build_provenance_for_direct_crawl()  ◄── reconcile canonical / og:url / redirect URL signals
        │                                compute source_confidence, is_clickable, final_domain
        ▼
mention.meta_data["source_provenance"]  ◄── persisted in DB JSON column (no migration needed)
        │
        ▼
_mention_link_fields()  ◄── reads provenance, gates Visit button, adds source_integrity_level
        │
        ▼
Frontend mention card   ◄── shows disabled Visit + tooltip when integrity is low/unavailable
```

## Provenance Fields

`meta_data["source_provenance"]` is a JSON object with these fields:

| Field | Type | Description |
|---|---|---|
| `provider` | string | `"rss"` / `"direct_crawl"` / `"google_news"` |
| `raw_provider_url` | string | Original URL from feed/SerpAPI before any resolution |
| `redirect_resolved_url` | string? | URL after following HTTP redirects |
| `canonical_html_url` | string? | `<link rel="canonical">` from page |
| `og_url` | string? | `og:url` meta tag |
| `schema_url` | string? | Schema.org JSON-LD `url` / `mainEntityOfPage` |
| `final_canonical_url` | string? | Best reconciled URL from all signals |
| `final_domain` | string? | eTLD+1 of `final_canonical_url` |
| `source_confidence` | float [0,1] | Confidence that URL binds to this content |
| `is_clickable` | bool | Whether the Visit button should be active |
| `is_article_like` | bool | Whether the page appears to be an article |
| `blocked_reason` | string? | Reason URL was rejected (if any) |
| `preview_image_url` | string? | og:image only if same-domain as final_canonical_url |

## Source Confidence Levels

| Level | Condition | Visit Button |
|---|---|---|
| `high` ≥ 0.7 | canonical and redirect agree on same eTLD+1 | Active, no badge |
| `medium` 0.4–0.7 | partial agreement between signals | Active, yellow dot badge |
| `low` < 0.4 | signals disagree or fetch failed | Disabled, tooltip |
| `unavailable` | no provenance metadata | Disabled or degraded |

## source_integrity_level Field

The `_mention_link_fields()` function computes a `source_integrity_level` string and adds it to:
- `mention.metadata.source_integrity_level` (inside metadata JSON)
- `mention.source_integrity_level` (top-level field in list response)

Frontend uses this to decide whether to show the Visit button or the `Link2Off` icon with a tooltip.

## Article Eligibility Checks

`is_article_eligible_url(url)` is the single gating function. It blocks:
- **Non-HTTP asset schemes**: `data:`, `blob:`, `sediment:`, `javascript:`, `asset:`, `file:`
- **Blocked hosts**: Google News discovery, Google media/CDN, tracking/analytics, XML/schema namespaces
- **Utility pages**: `/login`, `/signin`, `/logout`, `/help`, `/docs`, `/privacy`, `/terms`, `/contact`, `/search`, `/tag/`, `/author/`, etc.
- **Feed endpoints**: `/feed`, `/feeds`, `/rss`, `/atom`, `/sitemap`
- **Static files**: `.jpg`, `.png`, `.js`, `.css`, `.pdf`, `.xml`, `.rss`, etc.

## Metrics

In-memory counters available via `get_provenance_metrics()`:

| Metric | Description |
|---|---|
| `source_resolution_success_rate_attempts` | Total mentions processed by provenance builder |
| `source_resolution_success_rate_successes` | Mentions with `is_clickable=True` |
| `invalid_visit_url_count` | Mentions with no valid Visit URL |
| `blocked_utility_url_count` | URLs rejected as utility pages |
| `blocked_feed_url_count` | URLs rejected as feed endpoints |
| `blocked_asset_url_count` | URLs rejected as asset/data URIs |
| `low_confidence_mention_count` | Mentions with `source_confidence < 0.4` |
| `preview_image_match_count` | Preview images accepted (same-domain) |
| `preview_image_mismatch_count` | Preview images rejected (cross-domain) |

## Files Changed

| File | Change |
|---|---|
| `backend/app/services/url_utils.py` | Added `UTILITY_PATH_PREFIXES`, `FEED_PATH_PATTERNS`, `is_utility_page_url()`, `is_rss_or_feed_url()`, `is_non_http_asset_scheme()`, `is_article_eligible_url()`, metrics counters |
| `backend/app/services/source_resolution_service.py` | Fixed `Tuple` import; added schema.org extraction; cross-domain check; preview image guard; `build_provenance_for_direct_crawl()` |
| `backend/app/services/crawl_service.py` | Eligibility check + provenance metadata in RSS pipeline |
| `backend/app/services/discovery_service.py` | Eligibility check + provenance + fix domain derivation from `final_canonical_url` |
| `backend/app/api/mentions.py` | `source_integrity_level` in response; utility page URL guard in `_mention_link_fields` |
| `frontend/src/lib/visit-url.ts` | Utility/feed blocking; `getVisitUrlStatus()` |
| `frontend/src/app/dashboard/mentions/page.tsx` | Visit button gated by `source_integrity_level`; integrity dot badge |
| `backend/tests/test_source_integrity.py` | New unit tests |
