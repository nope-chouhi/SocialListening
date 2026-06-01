"""
RSS Auto Discovery Service for Nope.
Discovers RSS/Atom feeds from domains found during Auto Discovery.
"""
import logging
import requests
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (compatible; SocialListeningBot/1.0)"

COMMON_FEED_PATHS = [
    "/rss",
    "/rss.xml",
    "/feed",
    "/feed.xml",
    "/atom.xml",
    "/index.xml",
    "/feeds/posts/default",  # Blogger
    "/blog/feed",
    "/news/rss",
]


def _is_valid_feed_response(response: requests.Response) -> bool:
    """Check if response looks like a valid RSS/Atom feed."""
    content_type = response.headers.get("content-type", "").lower()

    # Check content-type
    feed_content_types = [
        "application/rss+xml",
        "application/atom+xml",
        "application/xml",
        "text/xml",
    ]
    ct_ok = any(fct in content_type for fct in feed_content_types)

    # Check body content
    try:
        preview = response.content[:4096].decode("utf-8", errors="ignore").strip().lower()
    except Exception:
        preview = ""

    # Must NOT be HTML
    if "text/html" in content_type or preview.startswith("<!doctype html") or "<html" in preview[:200]:
        return False

    body_ok = any(tag in preview for tag in ["<rss", "<feed", "<channel"])

    return ct_ok or body_ok


def _extract_feed_links_from_html(html: str, base_url: str) -> List[str]:
    """Extract RSS/Atom feed URLs from HTML link tags."""
    feeds = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        link_tags = soup.find_all("link", rel=True)
        for tag in link_tags:
            rel = " ".join(tag.get("rel", []))
            tag_type = (tag.get("type") or "").lower()
            href = tag.get("href", "").strip()

            if not href:
                continue

            is_feed = False
            if "alternate" in rel:
                if tag_type in ("application/rss+xml", "application/atom+xml", "application/feed+json"):
                    is_feed = True
            if "feed" in rel:
                is_feed = True

            if is_feed:
                absolute_url = urljoin(base_url, href)
                if absolute_url not in feeds:
                    feeds.append(absolute_url)
    except Exception as e:
        logger.warning(f"Error parsing HTML for feed links: {e}")

    return feeds


def _validate_feed_url(url: str) -> Dict:
    """Validate a single feed URL. Returns dict with validation info."""
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        if response.status_code != 200:
            return {"url": url, "valid": False, "error": f"HTTP {response.status_code}"}

        if not _is_valid_feed_response(response):
            return {"url": url, "valid": False, "error": "Không phải RSS/Atom feed hợp lệ"}

        # Try to get item count and title
        import feedparser
        feed = feedparser.parse(response.content)
        feed_title = ""
        item_count = 0
        has_recent = False

        if hasattr(feed, "feed"):
            feed_title = feed.feed.get("title", "")

        if feed.entries:
            item_count = len(feed.entries)
            # Check if any entry has a date
            for entry in feed.entries[:5]:
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    has_recent = True
                    break
                if hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    has_recent = True
                    break

        return {
            "url": url,
            "valid": True,
            "feed_title": feed_title,
            "item_count": item_count,
            "has_recent": has_recent,
            "error": None,
        }

    except requests.exceptions.Timeout:
        return {"url": url, "valid": False, "error": "Timeout"}
    except Exception as e:
        logger.warning(f"Error validating feed {url}: {e}")
        return {"url": url, "valid": False, "error": str(e)}


def discover_rss_feeds(domain: str) -> Dict:
    """
    Discover RSS/Atom feeds for a given domain.

    Returns:
        {
            "rss_feed_url": str or None,
            "rss_valid": bool,
            "rss_error": str or None,
            "feed_title": str,
            "item_count": int,
            "all_feeds_found": list,
        }
    """
    homepage_url = f"https://{domain}/"
    candidate_feeds: List[str] = []

    # Step A: Fetch homepage and look for link tags
    try:
        response = requests.get(
            homepage_url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "").lower()
            if "text/html" in content_type:
                html_feeds = _extract_feed_links_from_html(response.text, homepage_url)
                candidate_feeds.extend(html_feeds)
    except Exception as e:
        logger.info(f"Could not fetch homepage for {domain}: {e}")

    # Step B: Check common feed paths
    for path in COMMON_FEED_PATHS:
        feed_url = f"https://{domain}{path}"
        if feed_url not in candidate_feeds:
            candidate_feeds.append(feed_url)

    if not candidate_feeds:
        return {
            "rss_feed_url": None,
            "rss_valid": False,
            "rss_error": "Không tìm thấy RSS hợp lệ.",
            "feed_title": "",
            "item_count": 0,
            "all_feeds_found": [],
        }

    # Step C: Validate candidates — try HTML-discovered ones first (more likely valid)
    validated = []
    for feed_url in candidate_feeds:
        result = _validate_feed_url(feed_url)
        validated.append(result)
        # Stop after finding 3 valid feeds to save API calls
        if sum(1 for v in validated if v.get("valid")) >= 3:
            break

    valid_feeds = [v for v in validated if v.get("valid")]

    if not valid_feeds:
        return {
            "rss_feed_url": None,
            "rss_valid": False,
            "rss_error": "Không tìm thấy RSS hợp lệ.",
            "feed_title": "",
            "item_count": 0,
            "all_feeds_found": [v["url"] for v in validated],
        }

    # Step D: Choose best feed
    # Prefer: has recent items > higher item count > first found
    best = sorted(
        valid_feeds,
        key=lambda f: (f.get("has_recent", False), f.get("item_count", 0)),
        reverse=True,
    )[0]

    return {
        "rss_feed_url": best["url"],
        "rss_valid": True,
        "rss_error": None,
        "feed_title": best.get("feed_title", ""),
        "item_count": best.get("item_count", 0),
        "all_feeds_found": [v["url"] for v in valid_feeds],
    }
