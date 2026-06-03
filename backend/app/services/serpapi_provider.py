"""
SerpAPI Web Search Provider for Nope Auto Discovery.
Server-side only — SERPAPI_API_KEY is never exposed to frontend.
"""
import logging
import requests
from typing import List, Dict, Optional
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)

SERPAPI_SEARCH_URL = "https://serpapi.com/search"


class SerpAPIError(Exception):
    """Base error for SerpAPI operations"""
    pass


class SerpAPINotConfigured(SerpAPIError):
    """Raised when API key is missing"""
    pass


class SerpAPIRateLimitError(SerpAPIError):
    """Raised when rate limit is hit"""
    pass


def _normalize_url(url: str) -> str:
    """Normalize a URL: strip fragments, trailing slashes, lowercase domain."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        # Rebuild without fragment
        scheme = parsed.scheme or "https"
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        query = parsed.query
        normalized = f"{scheme}://{netloc}{path}"
        if query:
            normalized += f"?{query}"
        return normalized
    except Exception:
        return url.strip()


def _extract_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _build_date_restrict(date_range: str) -> Optional[str]:
    """Convert date_range to SerpAPI's tbs parameter value."""
    mapping = {
        "last_24_hours": "qdr:d",
        "last_7_days": "qdr:w",
        "last_30_days": "qdr:m",
        "last_3_months": "qdr:m3",
        "last_year": "qdr:y",
    }
    return mapping.get(date_range)


def search(
    keywords: List[str],
    language: str = "vi",
    country: str = "vn",
    limit: int = 20,
    date_range: str = "last_30_days",
) -> List[Dict]:
    """
    Search the web via SerpAPI for given keywords.
    
    Returns list of:
        {
            "title": str,
            "url": str,       # normalized
            "snippet": str,
            "domain": str,
            "position": int,
            "keyword": str,   # which keyword matched this result
        }
    
    Raises:
        SerpAPINotConfigured: if SERPAPI_API_KEY is not set
        SerpAPIRateLimitError: if quota exceeded
        SerpAPIError: for other errors
    """
    api_key = settings.SERPAPI_API_KEY
    if not api_key or not api_key.strip():
        raise SerpAPINotConfigured("Chưa cấu hình Web Search API.")

    all_results = []
    seen_urls = set()

    per_keyword_limit = max(10, limit // max(len(keywords), 1))

    for keyword in keywords:
        if not keyword or not keyword.strip():
            continue

        try:
            params = {
                "api_key": api_key,
                "q": keyword.strip(),
                "engine": "google",
            }
            if language:
                params["hl"] = language
            if country:
                params["gl"] = country
            if per_keyword_limit > 0:
                params["num"] = min(per_keyword_limit, 100)

            tbs = _build_date_restrict(date_range)
            if tbs:
                params["tbs"] = tbs

            logger.info(f"SerpAPI search: keyword='{keyword}', lang={language}, country={country}")
            response = requests.get(SERPAPI_SEARCH_URL, params=params, timeout=30)

            if response.status_code == 429:
                raise SerpAPIRateLimitError("Đã vượt giới hạn Web Search API.")

            if response.status_code == 401:
                raise SerpAPINotConfigured("Chưa cấu hình Web Search API.")

            if response.status_code != 200:
                logger.error(f"SerpAPI returned status {response.status_code}")
                continue

            data = response.json()

            # Check for error in response
            if "error" in data:
                error_msg = data["error"]
                if "rate" in error_msg.lower() or "limit" in error_msg.lower():
                    raise SerpAPIRateLimitError("Đã vượt giới hạn Web Search API.")
                if "invalid" in error_msg.lower() and "key" in error_msg.lower():
                    raise SerpAPINotConfigured("Chưa cấu hình Web Search API.")
                logger.error(f"SerpAPI error: {error_msg}")
                continue

            organic_results = data.get("organic_results", [])

            for idx, result in enumerate(organic_results):
                url = result.get("link", "")
                if not url:
                    continue

                normalized = _normalize_url(url)
                if normalized in seen_urls:
                    continue
                seen_urls.add(normalized)

                domain = _extract_domain(url)

                all_results.append({
                    "title": result.get("title", ""),
                    "url": normalized,
                    "snippet": result.get("snippet", ""),
                    "domain": domain,
                    "position": result.get("position", idx + 1),
                    "keyword": keyword.strip(),
                })

                if len(all_results) >= limit:
                    break

        except (SerpAPINotConfigured, SerpAPIRateLimitError):
            raise
        except requests.exceptions.Timeout:
            logger.error(f"SerpAPI timeout for keyword '{keyword}'")
            continue
        except requests.exceptions.ConnectionError as e:
            logger.error(f"SerpAPI connection error: {e}")
            continue
        except Exception as e:
            logger.error(f"SerpAPI unexpected error for keyword '{keyword}': {e}")
            continue

        if len(all_results) >= limit:
            break

    return all_results
