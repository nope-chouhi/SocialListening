"""
Source Resolution Service — Mention Source Integrity Layer.

Resolves the true canonical URL of a mention by following redirects and
reading page-level signals (rel=canonical, og:url, Schema.org JSON-LD).
Computes source_confidence and is_clickable for the Visit button.

Used in two ways:
  1. resolve_source() — full HTTP fetch (only for unresolved Google News URLs or when explicitly called).
  2. build_provenance_for_direct_crawl() — no extra HTTP request; builds provenance from data already fetched.
"""
import json
import logging
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple
import requests
from bs4 import BeautifulSoup

from app.services.url_utils import (
    is_blocked_final_url,
    clean_final_url,
    recover_google_redirect_url,
    get_url_blocked_reason,
    domain_from_url,
    is_utility_page_url,
    is_rss_or_feed_url,
    is_non_http_asset_scheme,
    record_provenance_metric,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _calculate_title_similarity(provider_title: str, fetched_title: str) -> float:
    if not provider_title or not fetched_title:
        return 0.0
    p = provider_title.lower().strip()
    f = fetched_title.lower().strip()
    if not p or not f:
        return 0.0
    if p in f or f in p:
        return 0.9
    # Simple token overlap
    p_tokens = set(p.split())
    f_tokens = set(f.split())
    if not p_tokens or not f_tokens:
        return 0.0
    overlap = len(p_tokens.intersection(f_tokens))
    return overlap / max(len(p_tokens), len(f_tokens))


def _calculate_relevance_score(query: str, title: str, snippet: str, content: str) -> Tuple[float, List[str]]:
    score = 0.0
    reasons: List[str] = []
    q = query.lower().strip()
    if not q:
        return 0.0, reasons

    t = (title or "").lower()
    s = (snippet or "").lower()
    c = (content or "").lower()

    if q in t:
        score += 0.4
        reasons.append("query_in_title")
    if q in s:
        score += 0.4
        reasons.append("query_in_snippet")
    elif q in c:
        score += 0.2
        reasons.append("query_in_content")

    if score == 0.0:
        reasons.append("provider_associated_but_no_text_match")

    return max(0.0, min(1.0, score)), reasons


def _extract_schema_org_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Extract url / mainEntityOfPage from JSON-LD Schema.org scripts.

    Returns the first valid http/https URL found, resolved against base_url.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = script.string or ""
            data = json.loads(raw)
            # data may be a list or a dict
            objects = data if isinstance(data, list) else [data]
            for obj in objects:
                if not isinstance(obj, dict):
                    continue
                for key in ("url", "mainEntityOfPage"):
                    val = obj.get(key)
                    if isinstance(val, dict):
                        val = val.get("@id") or val.get("url")
                    if isinstance(val, str) and val.startswith("http"):
                        resolved = urllib.parse.urljoin(base_url, val)
                        if not get_url_blocked_reason(resolved):
                            return resolved
        except Exception:
            continue
    return None


def _extract_etld1(url: Optional[str]) -> str:
    """Extract eTLD+1 (e.g. example.co.uk from news.example.co.uk).

    Simplified: returns the last two dot-separated labels.
    """
    try:
        hostname = (urllib.parse.urlparse(url or "").hostname or "").lower()
        if hostname.startswith("www."):
            hostname = hostname[4:]
        parts = hostname.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return hostname
    except Exception:
        return ""


def _cross_domain_confidence(signals: List[Optional[str]]) -> Tuple[float, List[str]]:
    """Check cross-domain consistency among URL signals.

    If 2+ non-None signals agree on the eTLD+1, confidence is high.
    If they disagree across domains, confidence is low.
    Returns (confidence_delta, reasons).
    """
    valid = [s for s in signals if s and s.startswith("http")]
    if not valid:
        return 0.0, ["no_valid_signals"]

    etld1s = [_extract_etld1(u) for u in valid]
    non_empty = [e for e in etld1s if e]
    if not non_empty:
        return 0.0, ["cannot_extract_etld1"]

    from collections import Counter
    most_common, count = Counter(non_empty).most_common(1)[0]
    total = len(non_empty)

    reasons = []
    if count >= 2:
        reasons.append(f"domain_agreement_{count}_of_{total}")
        record_provenance_metric("title_domain_consistency_rate_consistent")
        return 0.3, reasons
    elif total == 1:
        reasons.append("single_signal_no_cross_check")
        return 0.1, reasons
    else:
        reasons.append("cross_domain_conflict")
        return -0.2, reasons


def _safe_preview_image(soup: BeautifulSoup, final_domain: str) -> Optional[str]:
    """Return og:image only if it is on the same eTLD+1 as final_domain.

    Images from CDN hosts or different domains are not returned.
    """
    og_image = soup.find("meta", property="og:image")
    if not og_image or not og_image.get("content"):
        return None
    img_url = og_image.get("content", "").strip()
    if not img_url or not img_url.startswith("http"):
        return None
    img_etld1 = _extract_etld1(img_url)
    page_etld1 = _extract_etld1("https://" + final_domain) if final_domain else ""
    if img_etld1 and page_etld1 and img_etld1 == page_etld1:
        record_provenance_metric("preview_image_match_count")
        return img_url
    record_provenance_metric("preview_image_mismatch_count")
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_provenance_for_direct_crawl(
    final_url: str,
    canonical_url: Optional[str],
    og_url: Optional[str],
    redirect_resolved_url: Optional[str],
    is_article_like: bool = True,
    schema_url: Optional[str] = None,
    preview_image_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a provenance metadata dict for a mention whose page was already fetched.

    This does NOT make any additional HTTP requests — it reconciles URL signals
    already known from the crawl result. Confidence is 0.9 when canonical and
    redirect agree on eTLD+1, 0.6 otherwise.
    """
    provenance: Dict[str, Any] = {
        "provider": "direct_crawl",
        "raw_provider_url": final_url,
        "redirect_resolved_url": redirect_resolved_url,
        "canonical_html_url": canonical_url,
        "og_url": og_url,
        "schema_url": schema_url,
        "main_entity_of_page": schema_url,
        "final_canonical_url": None,
        "final_domain": None,
        "source_confidence": 0.0,
        "source_confidence_reasons": [],
        "is_article_like": is_article_like,
        "article_eligibility_reasons": [],
        "is_clickable": False,
        "blocked_reason": None,
        "preview_image_url": None,
        "was_recovered_from_google_redirect": False,
    }

    # Determine final canonical URL priority: canonical > og:url > schema > redirect > raw
    candidates = [canonical_url, og_url, schema_url, redirect_resolved_url, final_url]
    resolved_final: Optional[str] = None
    for cand in candidates:
        if not cand:
            continue
        cleaned = clean_final_url(cand)
        if cleaned and not is_utility_page_url(cleaned) and not is_rss_or_feed_url(cleaned):
            resolved_final = cleaned
            break

    if not resolved_final:
        provenance["blocked_reason"] = "all_candidates_ineligible"
        record_provenance_metric("invalid_visit_url_count")
        return provenance

    provenance["final_canonical_url"] = resolved_final
    provenance["final_domain"] = domain_from_url(resolved_final) or ""

    # Cross-domain consistency
    conf_delta, conf_reasons = _cross_domain_confidence([
        canonical_url, og_url, schema_url, redirect_resolved_url, final_url
    ])
    record_provenance_metric("title_domain_consistency_rate_checks")

    # High confidence if canonical and redirect agree
    if canonical_url and redirect_resolved_url:
        if _extract_etld1(canonical_url) == _extract_etld1(redirect_resolved_url):
            provenance["source_confidence"] = 0.9
            provenance["source_confidence_reasons"].append("canonical_redirect_agree")
        else:
            provenance["source_confidence"] = 0.5
            provenance["source_confidence_reasons"].append("canonical_redirect_disagree")
    else:
        provenance["source_confidence"] = 0.6 + conf_delta
        provenance["source_confidence_reasons"].extend(conf_reasons)

    provenance["source_confidence"] = round(max(0.0, min(1.0, provenance["source_confidence"])), 3)

    if provenance["source_confidence"] >= 0.4 and is_article_like:
        provenance["is_clickable"] = True
    else:
        if provenance["source_confidence"] < 0.4:
            record_provenance_metric("low_confidence_mention_count")

    # Preview image (same-domain only)
    if preview_image_url and provenance["final_domain"]:
        img_etld1 = _extract_etld1(preview_image_url)
        page_etld1 = _extract_etld1("https://" + provenance["final_domain"])
        if img_etld1 and page_etld1 and img_etld1 == page_etld1:
            provenance["preview_image_url"] = preview_image_url
            record_provenance_metric("preview_image_match_count")
        else:
            record_provenance_metric("preview_image_mismatch_count")

    record_provenance_metric("source_resolution_success_rate_attempts")
    if provenance["is_clickable"]:
        record_provenance_metric("source_resolution_success_rate_successes")

    return provenance


def resolve_source(
    provider_name: str,
    raw_provider_url: str,
    provider_title: str,
    provider_snippet: str,
    query: str
) -> Dict[str, Any]:
    """Resolve the raw provider URL to verify its true source provenance.

    Makes a live HTTP GET request. Use only when the page has not already been fetched
    (e.g. for unresolved Google News RSS discovery URLs).
    """
    record_provenance_metric("source_resolution_success_rate_attempts")

    provenance: Dict[str, Any] = {
        "provider": provider_name,
        "raw_provider_url": raw_provider_url,
        "redirect_resolved_url": None,
        "canonical_html_url": None,
        "og_url": None,
        "schema_url": None,
        "main_entity_of_page": None,
        "final_canonical_url": None,
        "final_domain": None,
        "source_confidence": 0.0,
        "source_confidence_reasons": [],
        "is_article_like": False,
        "article_eligibility_reasons": [],
        "is_clickable": False,
        "blocked_reason": None,
        "preview_image_url": None,
        "title_similarity": 0.0,
        "relevance_score": 0.0,
        "relevance_reasons": [],
        "was_recovered_from_google_redirect": False,
    }

    if not raw_provider_url or not raw_provider_url.startswith("http"):
        provenance["blocked_reason"] = "non_http_scheme"
        return provenance

    if is_non_http_asset_scheme(raw_provider_url):
        provenance["blocked_reason"] = "non_http_asset_scheme"
        return provenance

    recovered = recover_google_redirect_url(raw_provider_url)
    if recovered:
        raw_provider_url = recovered
        provenance["was_recovered_from_google_redirect"] = True

    blocked_reason = get_url_blocked_reason(raw_provider_url)
    if blocked_reason:
        provenance["blocked_reason"] = blocked_reason
        return provenance

    if is_utility_page_url(raw_provider_url):
        provenance["blocked_reason"] = "utility_page_url"
        record_provenance_metric("blocked_utility_url_count")
        return provenance

    if is_rss_or_feed_url(raw_provider_url):
        provenance["blocked_reason"] = "rss_feed_endpoint"
        record_provenance_metric("blocked_feed_url_count")
        return provenance

    try:
        resp = requests.get(
            raw_provider_url,
            timeout=3.0,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            stream=True
        )
        content_type = resp.headers.get('Content-Type', '').lower()
        if 'text/html' not in content_type:
            provenance["blocked_reason"] = "non_html_content_type"
            resp.close()
            return provenance

        provenance["redirect_resolved_url"] = resp.url

        body = resp.raw.read(1024 * 1024)  # 1 MB max
        resp.close()

        soup = BeautifulSoup(body, 'html.parser')

        # Extract title
        fetched_title = ""
        if soup.title and soup.title.string:
            fetched_title = str(soup.title.string)
        og_title_tag = soup.find("meta", property="og:title")
        if og_title_tag and og_title_tag.get("content"):
            fetched_title = str(og_title_tag.get("content"))

        provenance["title_similarity"] = _calculate_title_similarity(provider_title, fetched_title)
        if provenance["title_similarity"] > 0.5:
            provenance["source_confidence"] += 0.5
            provenance["source_confidence_reasons"].append("high_title_similarity")
        elif fetched_title:
            provenance["source_confidence_reasons"].append("title_mismatch")
        else:
            provenance["source_confidence_reasons"].append("no_title_found")

        # Extract rel=canonical
        canon_tag = soup.find("link", rel="canonical")
        if canon_tag and canon_tag.get("href"):
            provenance["canonical_html_url"] = urllib.parse.urljoin(resp.url, str(canon_tag.get("href")))

        # Extract og:url
        og_url_tag = soup.find("meta", property="og:url")
        if og_url_tag and og_url_tag.get("content"):
            provenance["og_url"] = urllib.parse.urljoin(resp.url, str(og_url_tag.get("content")))

        # Extract Schema.org url / mainEntityOfPage
        schema_url = _extract_schema_org_url(soup, resp.url)
        if schema_url:
            provenance["schema_url"] = schema_url
            provenance["main_entity_of_page"] = schema_url

        # og:type article detection
        og_type_tag = soup.find("meta", property="og:type")
        og_type = str(og_type_tag.get("content")) if og_type_tag else ""
        if og_type == "article":
            provenance["is_article_like"] = True
            provenance["article_eligibility_reasons"].append("og:type_is_article")

        # Article body length heuristic
        text_content = soup.get_text(separator=' ', strip=True)
        if len(text_content) > 500:
            provenance["is_article_like"] = True
            provenance["article_eligibility_reasons"].append("sufficient_text_length")
        elif len(text_content) < 100:
            provenance["blocked_reason"] = "insufficient_text_length"

        # Determine final canonical URL (priority order)
        final_candidates = [
            provenance["canonical_html_url"],
            provenance["og_url"],
            provenance["schema_url"],
            provenance["redirect_resolved_url"],
        ]
        final_url = None
        for candidate in final_candidates:
            if candidate:
                recovered_cand = recover_google_redirect_url(candidate)
                if recovered_cand:
                    candidate = recovered_cand
                    provenance["was_recovered_from_google_redirect"] = True
                if (
                    not get_url_blocked_reason(candidate)
                    and not is_utility_page_url(candidate)
                    and not is_rss_or_feed_url(candidate)
                ):
                    final_url = candidate
                    break

        if not final_url:
            provenance["blocked_reason"] = "all_identity_signals_blocked"
            record_provenance_metric("invalid_visit_url_count")
            return provenance

        clean_url = clean_final_url(final_url)
        if not clean_url:
            provenance["blocked_reason"] = "clean_final_url_rejected"
            record_provenance_metric("invalid_visit_url_count")
            return provenance

        provenance["final_canonical_url"] = clean_url
        provenance["final_domain"] = domain_from_url(clean_url) or ""

        # Cross-domain consistency check
        conf_delta, conf_reasons = _cross_domain_confidence([
            provenance["canonical_html_url"],
            provenance["og_url"],
            provenance["schema_url"],
            provenance["redirect_resolved_url"],
        ])
        record_provenance_metric("title_domain_consistency_rate_checks")
        provenance["source_confidence"] += conf_delta
        provenance["source_confidence_reasons"].extend(conf_reasons)

        if provenance["title_similarity"] >= 0.3 or (query.lower() in fetched_title.lower()):
            provenance["source_confidence"] += 0.5
            provenance["source_confidence_reasons"].append("acceptable_identity")

        provenance["source_confidence"] = round(max(0.0, min(1.0, provenance["source_confidence"])), 3)

        if provenance["source_confidence"] >= 0.4 and provenance["is_article_like"] and not provenance["blocked_reason"]:
            provenance["is_clickable"] = True
        else:
            if provenance["source_confidence"] < 0.4:
                record_provenance_metric("low_confidence_mention_count")

        # Preview image (same-domain only)
        if provenance["final_domain"]:
            img = _safe_preview_image(soup, provenance["final_domain"])
            if img:
                provenance["preview_image_url"] = img

        # Relevance scoring
        rel_score, rel_reasons = _calculate_relevance_score(query, provider_title, provider_snippet, text_content)
        provenance["relevance_score"] = rel_score
        provenance["relevance_reasons"] = rel_reasons

        if provenance["is_clickable"]:
            record_provenance_metric("source_resolution_success_rate_successes")

    except requests.Timeout:
        provenance["source_confidence"] = 0.2
        provenance["source_confidence_reasons"].append("fetch_timeout")
        provenance["blocked_reason"] = "fetch_timeout"
    except Exception as e:
        provenance["source_confidence"] = 0.1
        provenance["source_confidence_reasons"].append(f"fetch_error: {type(e).__name__}")
        provenance["blocked_reason"] = "fetch_error"

    return provenance
