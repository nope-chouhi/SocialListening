import base64
import html
import re
from typing import Optional
from urllib.parse import unquote, urlparse


GOOGLE_NEWS_HOSTS = {"news.google.com", "www.news.google.com"}
GOOGLE_MEDIA_HOST_SUFFIXES = ("googleusercontent.com",)
GOOGLE_MEDIA_HOSTS = {"lh3.googleusercontent.com"}
GENERIC_NEWS_DOMAINS = {"google_news.com"}
IMAGE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".avif",
    ".ico",
)


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


def is_google_media_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        hostname = (urlparse(candidate).hostname or "").lower()
    except Exception:
        return False
    return hostname in GOOGLE_MEDIA_HOSTS or any(hostname == suffix or hostname.endswith(f".{suffix}") for suffix in GOOGLE_MEDIA_HOST_SUFFIXES)


def is_media_file_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    return parsed.path.lower().endswith(IMAGE_EXTENSIONS)


def is_blocked_final_url(url: Optional[str]) -> bool:
    return (
        is_google_news_discovery_url(url)
        or is_google_media_url(url)
        or is_media_file_url(url)
    )


def clean_final_url(url: Optional[str]) -> Optional[str]:
    candidate = _trim_url(url)
    if not is_http_url(candidate):
        return None
    if is_blocked_final_url(candidate):
        return None
    return candidate


def is_safe_display_domain(domain: Optional[str]) -> bool:
    value = _trim_url(domain).lower()
    if not value:
        return False
    if value.startswith("www."):
        value = value[4:]
    return (
        value not in GOOGLE_NEWS_HOSTS
        and value not in GENERIC_NEWS_DOMAINS
        and value not in GOOGLE_MEDIA_HOSTS
        and not any(value == suffix or value.endswith(f".{suffix}") for suffix in GOOGLE_MEDIA_HOST_SUFFIXES)
    )


def domain_from_url(url: Optional[str]) -> Optional[str]:
    final_url = clean_final_url(url)
    if not final_url:
        return None
    hostname = (urlparse(final_url).hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname if is_safe_display_domain(hostname) else None


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
