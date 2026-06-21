import base64
import html
import re
from typing import Optional
from urllib.parse import unquote, urlparse


GOOGLE_NEWS_HOSTS = {"news.google.com", "www.news.google.com"}
GOOGLE_MEDIA_HOST_SUFFIXES = ("googleusercontent.com",)
GOOGLE_MEDIA_HOSTS = {"lh3.googleusercontent.com"}
GENERIC_NEWS_DOMAINS = {"google_news.com"}
# XML/SVG/Schema namespace hosts — never article URLs
BLOCKED_NAMESPACE_HOSTS = {
    "w3.org",
    "www.w3.org",
    "schema.org",
    "www.schema.org",
    "xmlns.com",
    "www.xmlns.com",
    "purl.org",
    "www.purl.org",
    "ogp.me",
    "www.ogp.me",
    "rdf.data-vocabulary.org",
    "angular.dev",
    "www.angular.dev",
}
BLOCKED_FINAL_HOSTS = {
    "google-analytics.com",
    "www.google-analytics.com",
    "googletagmanager.com",
    "www.googletagmanager.com",
    "googleadservices.com",
    "www.googleadservices.com",
    "doubleclick.net",
    "www.doubleclick.net",
    "gstatic.com",
    "www.gstatic.com",
}
BLOCKED_FINAL_HOST_SUFFIXES = (
    "google-analytics.com",
    "googletagmanager.com",
    "googleadservices.com",
    "doubleclick.net",
    "gstatic.com",
    "corp.google.com",
)
GOOGLE_UTILITY_HOSTS = {
    "myaccount.google.com",
    "accounts.google.com",
    "policies.google.com",
    "privacy.google.com",
    "pay.google.com",
    "docs.google.com",
    "drive.google.com",
    "support.google.com",
}
STATIC_HOST_LABELS = {
    "ad",
    "ads",
    "analytics",
    "asset",
    "assets",
    "cdn",
    "css",
    "font",
    "fonts",
    "gtag",
    "image",
    "images",
    "img",
    "js",
    "media",
    "pagead",
    "script",
    "scripts",
    "static",
    "tag",
    "tracking",
}
BLOCKED_FILE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".avif",
    ".ico",
    ".js",
    ".css",
    ".woff",
    ".woff2",
    ".ttf",
    ".mp4",
    ".webm",
    ".pdf",
    ".xml",
    ".rss",
)
BLOCKED_PATH_PATTERNS = (
    "/analytics.js",
    "/gtag/js",
    "/collect",
    "/ads",
    "/pagead/",
    "/recaptcha/",
    "/rss",
)

# Utility/account/help page path prefixes — not article content
UTILITY_PATH_PREFIXES = (
    "/account",
    "/login",
    "/signin",
    "/sign-in",
    "/logout",
    "/sign-out",
    "/register",
    "/signup",
    "/sign-up",
    "/help",
    "/docs",
    "/documentation",
    "/legal",
    "/license",
    "/policy",
    "/privacy",
    "/terms",
    "/contact",
    "/about",
    "/search",
    "/tag/",
    "/tags/",
    "/category/",
    "/categories/",
    "/author/",
    "/authors/",
    "/user/",
    "/users/",
    "/profile/",
)

# RSS / Atom feed path segments — not publisher article pages
FEED_PATH_PATTERNS = (
    "/feed",
    "/feeds",
    "/rss",
    "/atom",
    "/sitemap",
)

# Non-HTTP asset URI schemes to reject explicitly
_NON_HTTP_ASSET_SCHEMES = frozenset({"sediment", "asset", "data", "blob", "file", "javascript"})

# ---------------------------------------------------------------------------
# In-memory provenance metrics (counters only, no persistence)
# ---------------------------------------------------------------------------
_provenance_metrics: dict = {
    "source_resolution_success_rate_attempts": 0,
    "source_resolution_success_rate_successes": 0,
    "title_domain_consistency_rate_checks": 0,
    "title_domain_consistency_rate_consistent": 0,
    "invalid_visit_url_count": 0,
    "blocked_utility_url_count": 0,
    "blocked_feed_url_count": 0,
    "blocked_asset_url_count": 0,
    "low_confidence_mention_count": 0,
    "preview_image_match_count": 0,
    "preview_image_mismatch_count": 0,
}


def record_provenance_metric(key: str, delta: int = 1) -> None:
    """Increment a named provenance metric counter (best-effort, no locking)."""
    if key in _provenance_metrics:
        _provenance_metrics[key] += delta


def get_provenance_metrics() -> dict:
    """Return a snapshot of current provenance metric counters."""
    return dict(_provenance_metrics)


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


def _hostname(url: Optional[str]) -> str:
    try:
        return (urlparse(_trim_url(url)).hostname or "").lower()
    except Exception:
        return ""


def is_tracking_or_static_host(url: Optional[str]) -> bool:
    hostname = _hostname(url)
    if not hostname:
        return False
    if hostname.startswith("uberproxy-"):
        return True
    if hostname in BLOCKED_FINAL_HOSTS:
        return True
    if any(hostname == suffix or hostname.endswith(f".{suffix}") for suffix in BLOCKED_FINAL_HOST_SUFFIXES):
        return True

    labels = {label for label in hostname.split(".") if label}
    return bool(labels & STATIC_HOST_LABELS)


def is_google_amp_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    hostname = (parsed.hostname or "").lower()
    path = parsed.path.lower()
    return hostname in {"google.com", "www.google.com"} and (path == "/amp" or path.startswith("/amp/"))


def is_google_utility_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    hostname = (parsed.hostname or "").lower()
    path = parsed.path.lower()
    query = parsed.query.lower()

    if hostname in GOOGLE_UTILITY_HOSTS:
        return True

    if hostname.endswith(".corp.google.com") or "uberproxy" in hostname or "pen-redirect" in hostname:
        return True

    if hostname in {"google.com", "www.google.com"}:
        if path.startswith("/account") or path.startswith("/settings") or path.startswith("/help"):
            return True
        if path.startswith("/log") or path.startswith("/url") or path.startswith("/search") or path.startswith("/preferences") or path.startswith("/alerts") or path.startswith("/finance"):
            return True
        if "format=json" in query and "hasfast=true" in query:
            return True

    return False


def is_media_file_url(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    return parsed.path.lower().endswith(BLOCKED_FILE_EXTENSIONS)


def has_blocked_path(url: Optional[str]) -> bool:
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        path = urlparse(candidate).path.lower()
    except Exception:
        return False
    return any(pattern in path for pattern in BLOCKED_PATH_PATTERNS)


def is_namespace_url(url: Optional[str]) -> bool:
    """Block XML/SVG/schema namespace hosts that appear as attribute values, not article URLs."""
    hostname = _hostname(url)
    if not hostname:
        return False
    return hostname in BLOCKED_NAMESPACE_HOSTS


def get_url_blocked_reason(url: Optional[str]) -> Optional[str]:
    candidate = _trim_url(url)
    if not candidate:
        return "invalid_or_empty_url"

    if is_google_news_discovery_url(candidate):
        return "google_news_discovery_url"
    if is_google_media_url(candidate):
        return "google_media_url"
    if is_google_amp_url(candidate):
        return "google_amp_url"

    # Check specifically for google log/redirects vs other utility
    if is_google_utility_url(candidate):
        try:
            parsed = urlparse(candidate)
            path = parsed.path.lower()
            hostname = (parsed.hostname or "").lower()
            if hostname in {"google.com", "www.google.com"} and (path.startswith("/log") or path.startswith("/url")):
                return "google_internal_log_url" if path.startswith("/log") else "google_redirect_url"
            if "corp.google.com" in hostname or "uberproxy" in hostname or "pen-redirect" in hostname:
                return "google_proxy_or_redirect_url"
        except Exception:
            pass
        return "google_utility_page"

    if is_tracking_or_static_host(candidate):
        return "static_asset"
    if is_media_file_url(candidate):
        return "static_asset"
    if has_blocked_path(candidate):
        return "static_asset"
    if is_namespace_url(candidate):
        return "namespace_url"

    return None


def is_blocked_final_url(url: Optional[str]) -> bool:
    return get_url_blocked_reason(url) is not None


def recover_google_redirect_url(url: Optional[str]) -> Optional[str]:
    candidate = _trim_url(url)
    if not candidate:
        return None

    try:
        parsed = urlparse(candidate)
        hostname = (parsed.hostname or "").lower()
        path = parsed.path.lower()

        # Only attempt recovery on google domains and specific redirect paths
        if hostname not in {"google.com", "www.google.com"}:
            return None
        if not (path.startswith("/url") or path.startswith("/log") or path.startswith("/search") or path.startswith("/alerts")):
            return None

        from urllib.parse import parse_qs
        qs = parse_qs(parsed.query)

        for param in ["url", "q", "u", "target", "continue", "adurl"]:
            if param in qs and qs[param]:
                val = str(qs[param][0]).strip()
                if is_http_url(val):
                    # decode recursively just in case
                    val = unquote(val)
                    # Check if the recovered url is also blocked
                    if not get_url_blocked_reason(val):
                        return val
    except Exception:
        pass
    return None


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
        and value not in BLOCKED_FINAL_HOSTS
        and value not in BLOCKED_NAMESPACE_HOSTS
        and value not in GOOGLE_UTILITY_HOSTS
        and not any(value == suffix or value.endswith(f".{suffix}") for suffix in GOOGLE_MEDIA_HOST_SUFFIXES)
        and not any(value == suffix or value.endswith(f".{suffix}") for suffix in BLOCKED_FINAL_HOST_SUFFIXES)
        and not bool({label for label in value.split(".") if label} & STATIC_HOST_LABELS)
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


# ---------------------------------------------------------------------------
# Article eligibility helpers
# ---------------------------------------------------------------------------

def is_non_http_asset_scheme(url: Optional[str]) -> bool:
    """Return True if the URL uses a non-HTTP asset/data scheme (sediment://, asset://, data:, etc.)."""
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        scheme = urlparse(candidate).scheme.lower()
    except Exception:
        return False
    return scheme in _NON_HTTP_ASSET_SCHEMES


def is_utility_page_url(url: Optional[str]) -> bool:
    """Return True if the URL path begins with a known utility/account/help path prefix.

    These pages are not publisher article content and should not be stored as mentions
    or shown with an active Visit button.
    """
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        path = urlparse(candidate).path.lower()
    except Exception:
        return False
    if not path or path == "/":
        return False
    for prefix in UTILITY_PATH_PREFIXES:
        if path == prefix.rstrip("/") or path.startswith(prefix):
            return True
    return False


def is_rss_or_feed_url(url: Optional[str]) -> bool:
    """Return True if the URL is a feed/RSS/Atom endpoint rather than an article page.

    Checks both path patterns and file extensions (.xml, .rss already in
    BLOCKED_FILE_EXTENSIONS, so is_media_file_url covers those).
    """
    candidate = _trim_url(url)
    if not candidate:
        return False
    try:
        path = urlparse(candidate).path.lower()
    except Exception:
        return False
    for pattern in FEED_PATH_PATTERNS:
        # Match /feed, /feeds, /feed.xml, /rss.xml, etc.
        if path == pattern or path.startswith(pattern + "/") or path.startswith(pattern + "."):
            return True
    return False


def is_article_eligible_url(url: Optional[str]) -> bool:
    """Return True only if the URL passes all eligibility checks to be stored as a mention article.

    An ineligible URL is one that is:
    - A non-HTTP asset scheme (sediment://, data:, blob:, …)
    - A blocked final URL (Google News discovery, media, tracking, namespace, …)
    - A utility/account/help/policy page
    - A feed/RSS/Atom endpoint
    - A static asset or image file

    This is the single entry-point to check before saving a mention URL.
    """
    candidate = _trim_url(url)
    if not candidate:
        return False
    if is_non_http_asset_scheme(candidate):
        record_provenance_metric("blocked_asset_url_count")
        return False
    if not is_http_url(candidate):
        return False
    if is_blocked_final_url(candidate):
        return False
    if is_utility_page_url(candidate):
        record_provenance_metric("blocked_utility_url_count")
        return False
    if is_rss_or_feed_url(candidate):
        record_provenance_metric("blocked_feed_url_count")
        return False
    return True
