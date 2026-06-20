"""
Search provider chain for manual/ad-hoc scans.
Provider order controlled by SEARCH_PROVIDER_ORDER (default: serper,tavily,rss).
Missing API keys cause graceful skip, not failure.
All result URLs validated through clean_final_url() before mention creation.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

import requests

from app.core.config import settings
from app.services.url_utils import clean_final_url, domain_from_url

logger = logging.getLogger(__name__)

PROVIDER_STATUS_SKIPPED_KEY = "skipped_missing_key"
PROVIDER_STATUS_SUCCEEDED = "succeeded"
PROVIDER_STATUS_FAILED = "failed"
PROVIDER_STATUS_TIMEOUT = "timeout"
PROVIDER_STATUS_QUOTA = "quota_exceeded"


def _empty_provider_summary(provider: str) -> Dict[str, Any]:
    return {
        "provider": provider,
        "status": PROVIDER_STATUS_SKIPPED_KEY,
        "attempted": False,
        "raw_results": 0,
        "valid_results": 0,
        "created_mentions": 0,
        "duplicate_skipped": 0,
        "invalid_url_skipped": 0,
        "error": None,
    }


def _normalize_result(
    provider: str,
    title: str,
    snippet: str,
    raw_url: str,
    published_at: Optional[Any] = None,
    source_name: str = "",
) -> Optional[Dict[str, Any]]:
    """Validate URL and build normalized result. Returns None if URL is invalid."""
    url = clean_final_url(raw_url)
    if not url:
        return None
    source_domain = domain_from_url(url) or ""
    return {
        "provider": provider,
        "title": (title or "").strip()[:500],
        "snippet": (snippet or "").strip()[:1000],
        "url": url,
        "published_at": published_at,
        "source_name": (source_name or source_domain)[:200],
        "source_domain": source_domain,
    }


# -- Serper.dev ----------------------------------------------------------------

def _run_serper(keywords: List[str], max_results: int, timeout_s: int) -> Tuple[List[Dict], Dict]:
    summary = _empty_provider_summary("serper")
    api_key = (settings.SERPER_API_KEY or "").strip()
    if not api_key:
        return [], summary

    summary["attempted"] = True
    results: List[Dict] = []
    seen_urls: set = set()

    try:
        per_kw = max(5, max_results // max(len(keywords), 1))
        for keyword in keywords:
            if not keyword or not keyword.strip():
                continue
            if len(results) >= max_results:
                break
            try:
                resp = requests.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": api_key,
                        "Content-Type": "application/json",
                    },
                    json={"q": keyword.strip(), "num": min(per_kw, 10), "gl": "vn", "hl": "vi"},
                    timeout=timeout_s,
                )
                summary["raw_results"] += 1

                if resp.status_code == 429:
                    summary["status"] = PROVIDER_STATUS_QUOTA
                    summary["error"] = "rate_limited"
                    break
                if resp.status_code in (401, 403):
                    summary["status"] = PROVIDER_STATUS_FAILED
                    summary["error"] = "auth_error_%d" % resp.status_code
                    break
                if resp.status_code != 200:
                    logger.warning("Serper returned %s", resp.status_code)
                    continue

                data = resp.json()
                organic = data.get("organic", [])
                for item in organic:
                    if len(results) >= max_results:
                        break
                    normed = _normalize_result(
                        provider="serper",
                        title=item.get("title", ""),
                        snippet=item.get("snippet", ""),
                        raw_url=item.get("link", ""),
                        source_name=item.get("displayLink", ""),
                    )
                    if normed is None:
                        summary["invalid_url_skipped"] += 1
                        continue
                    if normed["url"] in seen_urls:
                        summary["duplicate_skipped"] += 1
                        continue
                    seen_urls.add(normed["url"])
                    results.append(normed)
                    summary["valid_results"] += 1

            except requests.Timeout:
                logger.warning("Serper timeout for keyword '%s'", keyword)
                continue
            except requests.RequestException as e:
                logger.warning("Serper request error: %s", e)
                continue

        if summary["attempted"] and summary["status"] == PROVIDER_STATUS_SKIPPED_KEY:
            summary["status"] = PROVIDER_STATUS_SUCCEEDED

    except Exception as e:
        summary["status"] = PROVIDER_STATUS_FAILED
        summary["error"] = str(e)
        logger.error("Serper provider error: %s", e)

    return results, summary


# -- Tavily.com ----------------------------------------------------------------

def _run_tavily(keywords: List[str], max_results: int, timeout_s: int) -> Tuple[List[Dict], Dict]:
    summary = _empty_provider_summary("tavily")
    api_key = (settings.TAVILY_API_KEY or "").strip()
    if not api_key:
        return [], summary

    summary["attempted"] = True
    results: List[Dict] = []
    seen_urls: set = set()

    try:
        per_kw = max(5, max_results // max(len(keywords), 1))
        for keyword in keywords:
            if not keyword or not keyword.strip():
                continue
            if len(results) >= max_results:
                break
            try:
                resp = requests.post(
                    "https://api.tavily.com/search",
                    headers={"Content-Type": "application/json"},
                    json={
                        "api_key": api_key,
                        "query": keyword.strip(),
                        "search_depth": "basic",
                        "max_results": min(per_kw, 10),
                        "include_answer": False,
                    },
                    timeout=timeout_s,
                )
                summary["raw_results"] += 1

                if resp.status_code == 429:
                    summary["status"] = PROVIDER_STATUS_QUOTA
                    summary["error"] = "rate_limited"
                    break
                if resp.status_code in (401, 403):
                    summary["status"] = PROVIDER_STATUS_FAILED
                    summary["error"] = "auth_error_%d" % resp.status_code
                    break
                if resp.status_code != 200:
                    logger.warning("Tavily returned %s", resp.status_code)
                    continue

                data = resp.json()
                for item in data.get("results", []):
                    if len(results) >= max_results:
                        break
                    pub_raw = item.get("published_date")
                    published_at = None
                    if pub_raw:
                        try:
                            published_at = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
                        except Exception:
                            pass
                    normed = _normalize_result(
                        provider="tavily",
                        title=item.get("title", ""),
                        snippet=item.get("content", ""),
                        raw_url=item.get("url", ""),
                        published_at=published_at,
                    )
                    if normed is None:
                        summary["invalid_url_skipped"] += 1
                        continue
                    if normed["url"] in seen_urls:
                        summary["duplicate_skipped"] += 1
                        continue
                    seen_urls.add(normed["url"])
                    results.append(normed)
                    summary["valid_results"] += 1

            except requests.Timeout:
                logger.warning("Tavily timeout for keyword '%s'", keyword)
                continue
            except requests.RequestException as e:
                logger.warning("Tavily request error: %s", e)
                continue

        if summary["attempted"] and summary["status"] == PROVIDER_STATUS_SKIPPED_KEY:
            summary["status"] = PROVIDER_STATUS_SUCCEEDED

    except Exception as e:
        summary["status"] = PROVIDER_STATUS_FAILED
        summary["error"] = str(e)
        logger.error("Tavily provider error: %s", e)

    return results, summary


# -- RSS fallback --------------------------------------------------------------

def _run_rss_provider(keywords: List[str], project_id: Optional[int], db_session_factory) -> Tuple[List[Dict], Dict]:
    """RSS fallback. Creates its own DB session and writes directly to DB."""
    summary = _empty_provider_summary("rss")
    summary["attempted"] = True
    try:
        from app.services.rss_collector import run_rss_collector
        local_db = db_session_factory()
        try:
            res = run_rss_collector(
                local_db,
                ad_hoc_keywords=keywords,
                ad_hoc_project_id=project_id,
            )
            summary["raw_results"] = res.get("items_seen", 0)
            summary["valid_results"] = res.get("mentions_created", 0)
            summary["created_mentions"] = res.get("mentions_created", 0)
            summary["duplicate_skipped"] = res.get("duplicates_skipped", 0)
            summary["status"] = PROVIDER_STATUS_SUCCEEDED
        finally:
            local_db.close()
    except Exception as e:
        summary["status"] = PROVIDER_STATUS_FAILED
        summary["error"] = str(e)
        logger.error("RSS provider error: %s", e)
    return [], summary


# -- Public interface ----------------------------------------------------------

def run_provider_chain(
    keywords: List[str],
    project_id: Optional[int],
    db_session_factory,
    max_results: Optional[int] = None,
    timeout_s: Optional[int] = None,
) -> Tuple[List[Dict], Dict[str, Dict]]:
    """
    Run the configured search provider chain. Returns (web_results, per_provider_summaries).
    RSS writes directly to DB and contributes no items to web_results.
    """
    max_results = max_results or settings.SEARCH_PROVIDER_MAX_RESULTS
    timeout_s = timeout_s or settings.SEARCH_PROVIDER_TIMEOUT_SECONDS

    order_raw = (settings.SEARCH_PROVIDER_ORDER or "serper,tavily,rss").strip()
    provider_order = [p.strip().lower() for p in order_raw.split(",") if p.strip()]

    all_results: List[Dict] = []
    summaries: Dict[str, Dict] = {}
    seen_urls: set = set()

    def _safe_call(fn, *args, call_timeout):
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(fn, *args)
            try:
                return future.result(timeout=call_timeout)
            except FuturesTimeoutError:
                prov = args[0][0] if args and args[0] else "unknown"
                s = _empty_provider_summary(str(prov))
                s["status"] = PROVIDER_STATUS_TIMEOUT
                s["error"] = "timeout"
                s["attempted"] = True
                return [], s
            except Exception as e:
                s = _empty_provider_summary("unknown")
                s["status"] = PROVIDER_STATUS_FAILED
                s["error"] = str(e)
                return [], s

    for provider in provider_order:
        if provider == "serper":
            items, summary = _safe_call(_run_serper, keywords, max_results, timeout_s, call_timeout=timeout_s + 2)
        elif provider == "tavily":
            items, summary = _safe_call(_run_tavily, keywords, max_results, timeout_s, call_timeout=timeout_s + 2)
        elif provider == "rss":
            items, summary = _safe_call(_run_rss_provider, keywords, project_id, db_session_factory, call_timeout=60)
        else:
            logger.warning("Unknown search provider '%s' in SEARCH_PROVIDER_ORDER — skipping", provider)
            continue

        summaries[provider] = summary

        for item in items:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_results.append(item)

        logger.info(
            "Provider '%s': status=%s valid=%d invalid_skipped=%d",
            provider,
            summary.get("status"),
            summary.get("valid_results", 0),
            summary.get("invalid_url_skipped", 0),
        )

    return all_results, summaries
