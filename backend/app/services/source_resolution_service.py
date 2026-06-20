import logging
import urllib.parse
from typing import Any, Dict, List, Optional
import requests
from bs4 import BeautifulSoup

from app.services.url_utils import is_blocked_final_url, clean_final_url, recover_google_redirect_url, get_url_blocked_reason

logger = logging.getLogger(__name__)

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
    reasons = []
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
        score -= 0.5
        reasons.append("provider_associated_but_no_text_match")

    return max(0.0, min(1.0, score)), reasons

def resolve_source(
    provider_name: str,
    raw_provider_url: str,
    provider_title: str,
    provider_snippet: str,
    query: str
) -> Dict[str, Any]:
    """
    Resolve the raw provider URL to verify its true source provenance.
    """
    provenance = {
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
        "title_similarity": 0.0,
        "relevance_score": 0.0,
        "relevance_reasons": [],
        "was_recovered_from_google_redirect": False
    }

    if not raw_provider_url or not raw_provider_url.startswith("http"):
        provenance["blocked_reason"] = "non_http_scheme"
        return provenance

    recovered = recover_google_redirect_url(raw_provider_url)
    if recovered:
        raw_provider_url = recovered
        provenance["was_recovered_from_google_redirect"] = True

    blocked_reason = get_url_blocked_reason(raw_provider_url)
    if blocked_reason:
        provenance["blocked_reason"] = blocked_reason
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

        body = resp.raw.read(1024 * 1024) # 1MB max
        resp.close()

        soup = BeautifulSoup(body, 'html.parser')

        # Extract title
        fetched_title = ""
        if soup.title and soup.title.string:
            fetched_title = soup.title.string
        og_title_tag = soup.find("meta", property="og:title")
        if og_title_tag and og_title_tag.get("content"):
            fetched_title = og_title_tag.get("content")

        provenance["title_similarity"] = _calculate_title_similarity(provider_title, fetched_title)
        if provenance["title_similarity"] > 0.5:
            provenance["source_confidence"] += 0.5
            provenance["source_confidence_reasons"].append("high_title_similarity")
        elif fetched_title:
            provenance["source_confidence_reasons"].append("title_mismatch")
        else:
            provenance["source_confidence_reasons"].append("no_title_found")

        # Extract URLs
        canon_tag = soup.find("link", rel="canonical")
        if canon_tag and canon_tag.get("href"):
            provenance["canonical_html_url"] = urllib.parse.urljoin(resp.url, canon_tag.get("href"))

        og_url_tag = soup.find("meta", property="og:url")
        if og_url_tag and og_url_tag.get("content"):
            provenance["og_url"] = urllib.parse.urljoin(resp.url, og_url_tag.get("content"))

        og_type_tag = soup.find("meta", property="og:type")
        og_type = og_type_tag.get("content") if og_type_tag else ""

        if og_type == "article":
            provenance["is_article_like"] = True
            provenance["article_eligibility_reasons"].append("og:type_is_article")

        # Try to find body length
        text_content = soup.get_text(separator=' ', strip=True)
        if len(text_content) > 500:
            provenance["is_article_like"] = True
            provenance["article_eligibility_reasons"].append("sufficient_text_length")
        elif len(text_content) < 100:
            provenance["blocked_reason"] = "insufficient_text_length"

        # Determine final canonical URL
        final_candidates = [
            provenance["canonical_html_url"],
            provenance["og_url"],
            provenance["redirect_resolved_url"]
        ]

        final_url = None
        for candidate in final_candidates:
            if candidate:
                recovered_cand = recover_google_redirect_url(candidate)
                if recovered_cand:
                    candidate = recovered_cand
                    provenance["was_recovered_from_google_redirect"] = True
                if not get_url_blocked_reason(candidate):
                    final_url = candidate
                    break

        if not final_url:
            provenance["blocked_reason"] = "all_identity_signals_blocked"
            return provenance

        clean_url = clean_final_url(final_url)
        if not clean_url:
            provenance["blocked_reason"] = "clean_final_url_rejected"
            return provenance

        provenance["final_canonical_url"] = clean_url
        provenance["final_domain"] = urllib.parse.urlparse(clean_url).netloc.replace("www.", "")

        if provenance["title_similarity"] >= 0.3 or (query.lower() in fetched_title.lower()):
            provenance["source_confidence"] += 0.5
            provenance["source_confidence_reasons"].append("acceptable_identity")

        if provenance["source_confidence"] >= 0.4 and provenance["is_article_like"] and not provenance["blocked_reason"]:
            provenance["is_clickable"] = True

        # Relevance
        rel_score, rel_reasons = _calculate_relevance_score(query, provider_title, provider_snippet, text_content)
        provenance["relevance_score"] = rel_score
        provenance["relevance_reasons"] = rel_reasons

    except requests.Timeout:
        provenance["source_confidence"] = 0.2
        provenance["source_confidence_reasons"].append("fetch_timeout")
        provenance["blocked_reason"] = "fetch_timeout"
    except Exception as e:
        provenance["source_confidence"] = 0.1
        provenance["source_confidence_reasons"].append(f"fetch_error: {type(e).__name__}")
        provenance["blocked_reason"] = "fetch_error"

    return provenance
