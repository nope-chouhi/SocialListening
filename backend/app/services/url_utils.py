import base64
import html
import re
from typing import Optional
from urllib.parse import unquote, urlparse


GOOGLE_NEWS_HOSTS = {"news.google.com", "www.news.google.com"}


def _trim_url(url: Optional[str]) -> str:
    return str(url or "").strip()


def is_http_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def is_google_news_discovery_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    return (parsed.hostname or "").lower() in GOOGLE_NEWS_HOSTS


def clean_final_url(url: Optional[str]) -> Optional[str]:
    candidate = _trim_url(url)
    if not is_http_url(candidate):
        return None
    if is_google_news_discovery_url(candidate):
        return None
    return candidate


def domain_from_url(url: Optional[str]) -> Optional[str]:
    final_url = clean_final_url(url)
    if not final_url:
        return None
    hostname = (urlparse(final_url).hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname or None


def extract_google_news_embedded_url(url: Optional[str]) -> Optional[str]:
    candidate = _trim_url(url)
    if not is_google_news_discovery_url(candidate):
        return None

    try:
        parsed = urlparse(candidate)
        path_parts = [part for part in parsed.path.split("/") if part]
        if "articles" not in path_parts:
            return None
        encoded = path_parts[path_parts.index("articles") + 1]
    except Exception:
        return None

    try:
        encoded += "=" * ((4 - len(encoded) % 4) % 4)
        decoded = base64.urlsafe_b64decode(encoded).decode("utf-8", errors="ignore")
    except Exception:
        return None

    for match in re.finditer(r"https?://[^\s<>'\"\\]+", decoded):
        possible_url = html.unescape(unquote(match.group(0))).rstrip(").,;]")
        final_url = clean_final_url(possible_url)
        if final_url:
            return final_url
    return None
