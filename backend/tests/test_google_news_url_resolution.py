# -*- coding: utf-8 -*-
"""Offline regression tests for Google News Visit URL resolution.

No live network. Uses static sample wrapper/RSS-style URLs.
"""
import base64
from types import SimpleNamespace

from app.services.url_utils import (
    extract_google_news_embedded_url,
    is_google_news_discovery_url,
    resolve_visit_url_candidate,
    recover_google_redirect_url,
)
from app.api.mentions import _mention_link_fields


def _google_news_wrapper(publisher_url: str) -> str:
    raw = f"prefix {publisher_url} suffix"
    enc = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")
    return f"https://news.google.com/rss/articles/{enc}"


class TestExtractGoogleNewsEmbeddedUrl:
    def test_extracts_publisher_from_rss_articles_wrapper(self):
        publisher = "https://www.vnexpress.net/article-abc.html"
        wrapper = _google_news_wrapper(publisher)
        assert is_google_news_discovery_url(wrapper) is True
        assert extract_google_news_embedded_url(wrapper) == publisher

    def test_returns_none_for_non_google_news(self):
        assert extract_google_news_embedded_url("https://www.example.com/story") is None

    def test_returns_none_when_no_embeddable_publisher(self):
        # still a google news host but no articles payload with URL
        assert extract_google_news_embedded_url("https://news.google.com/home") is None


class TestResolveVisitUrlCandidate:
    def test_preserves_clean_publisher_url(self):
        url = "https://tuoitre.vn/tin-moi-nhat.htm"
        assert resolve_visit_url_candidate(url) == url

    def test_resolves_google_news_wrapper_offline(self):
        publisher = "https://www.bbc.com/news/world-123"
        wrapper = _google_news_wrapper(publisher)
        assert resolve_visit_url_candidate(wrapper) == publisher

    def test_resolves_google_url_redirect_param(self):
        redirect = "https://www.google.com/url?url=https%3A%2F%2Fwww.example.com%2Fstory"
        assert recover_google_redirect_url(redirect) == "https://www.example.com/story"
        assert resolve_visit_url_candidate(redirect) == "https://www.example.com/story"

    def test_fallback_none_for_unresolvable_google_news(self):
        assert resolve_visit_url_candidate("https://news.google.com/rss/articles/not-decodable") is None

    def test_rejects_empty(self):
        assert resolve_visit_url_candidate(None) is None
        assert resolve_visit_url_candidate("") is None


class TestMentionLinkFieldsGoogleNews:
    def test_visit_url_from_google_news_wrapper_on_url_field(self):
        publisher = "https://www.reuters.com/world/sample-article"
        wrapper = _google_news_wrapper(publisher)
        mention = SimpleNamespace(
            url=wrapper,
            canonical_url=None,
            original_url=None,
            meta_data={},
        )
        visit_url, display_domain, metadata, reason = _mention_link_fields(mention)
        assert reason is None
        assert visit_url == publisher
        assert metadata.get("visit_url_available") is True
        assert display_domain == "reuters.com"

    def test_visit_url_from_original_url_when_url_is_wrapper_unresolved(self):
        publisher = "https://www.nytimes.com/2024/01/01/world/sample.html"
        wrapper = _google_news_wrapper(publisher)
        mention = SimpleNamespace(
            url=None,
            canonical_url=None,
            original_url=wrapper,
            meta_data={},
        )
        visit_url, display_domain, metadata, reason = _mention_link_fields(mention)
        assert reason is None
        assert visit_url == publisher
        assert metadata.get("visit_url_available") is True

    def test_unresolvable_wrapper_does_not_crash(self):
        mention = SimpleNamespace(
            url="https://news.google.com/rss/articles/not-decodable",
            canonical_url=None,
            original_url=None,
            meta_data={},
        )
        visit_url, display_domain, metadata, reason = _mention_link_fields(mention)
        assert visit_url is None
        assert reason is not None
        assert metadata.get("visit_url_available") is False
