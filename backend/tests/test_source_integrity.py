"""
Unit tests for Mention Source Integrity layer.

Tests:
- is_article_eligible_url (accepts news articles, rejects login/help/policy/feed/image)
- is_utility_page_url
- is_rss_or_feed_url
- is_non_http_asset_scheme
- domain_from_url (always derives from final URL, not raw provider)
- _calculate_title_similarity
- build_provenance_for_direct_crawl structure
- Display domain is never news.google.com
- Provenance metadata has required keys
"""
import pytest

from app.services.url_utils import (
    is_article_eligible_url,
    is_utility_page_url,
    is_rss_or_feed_url,
    is_non_http_asset_scheme,
    domain_from_url,
    is_blocked_final_url,
    get_provenance_metrics,
    record_provenance_metric,
)
from app.services.source_resolution_service import (
    _calculate_title_similarity,
    build_provenance_for_direct_crawl,
)


# ---------------------------------------------------------------------------
# is_utility_page_url
# ---------------------------------------------------------------------------

class TestIsUtilityPageUrl:
    def test_rejects_login(self):
        assert is_utility_page_url("https://example.com/login") is True

    def test_rejects_signin(self):
        assert is_utility_page_url("https://example.com/signin") is True

    def test_rejects_logout(self):
        assert is_utility_page_url("https://example.com/logout?redirect=/home") is True

    def test_rejects_help_page(self):
        assert is_utility_page_url("https://example.com/help/article-123") is True

    def test_rejects_privacy(self):
        assert is_utility_page_url("https://example.com/privacy") is True

    def test_rejects_terms(self):
        assert is_utility_page_url("https://example.com/terms-of-service") is True

    def test_rejects_account(self):
        assert is_utility_page_url("https://example.com/account/settings") is True

    def test_rejects_docs(self):
        assert is_utility_page_url("https://docs.example.com/docs/getting-started") is True

    def test_accepts_article(self):
        assert is_utility_page_url("https://vnexpress.net/bai-viet-tin-tuc-123456.html") is False

    def test_accepts_news_root(self):
        assert is_utility_page_url("https://vnexpress.net/") is False

    def test_accepts_none(self):
        assert is_utility_page_url(None) is False

    def test_accepts_empty(self):
        assert is_utility_page_url("") is False


# ---------------------------------------------------------------------------
# is_rss_or_feed_url
# ---------------------------------------------------------------------------

class TestIsRssOrFeedUrl:
    def test_rejects_feed_path(self):
        assert is_rss_or_feed_url("https://example.com/feed") is True

    def test_rejects_rss_path(self):
        assert is_rss_or_feed_url("https://example.com/rss") is True

    def test_rejects_atom_path(self):
        assert is_rss_or_feed_url("https://example.com/atom") is True

    def test_rejects_feed_with_slash(self):
        assert is_rss_or_feed_url("https://example.com/feed/news") is True

    def test_rejects_sitemap(self):
        assert is_rss_or_feed_url("https://example.com/sitemap.xml") is True

    def test_accepts_article_url(self):
        assert is_rss_or_feed_url("https://tuoitre.vn/tin-moi-nhat.htm") is False

    def test_accepts_feedsomething_not_feed(self):
        # /feedback is NOT a feed
        assert is_rss_or_feed_url("https://example.com/feedback") is False

    def test_accepts_none(self):
        assert is_rss_or_feed_url(None) is False


# ---------------------------------------------------------------------------
# is_non_http_asset_scheme
# ---------------------------------------------------------------------------

class TestIsNonHttpAssetScheme:
    def test_rejects_data_uri(self):
        assert is_non_http_asset_scheme("data:image/png;base64,abc") is True

    def test_rejects_blob(self):
        assert is_non_http_asset_scheme("blob:https://example.com/123") is True

    def test_rejects_javascript(self):
        assert is_non_http_asset_scheme("javascript:void(0)") is True

    def test_rejects_sediment(self):
        assert is_non_http_asset_scheme("sediment://some-id") is True

    def test_accepts_https(self):
        assert is_non_http_asset_scheme("https://example.com/article") is False

    def test_accepts_http(self):
        assert is_non_http_asset_scheme("http://example.com/") is False

    def test_accepts_none(self):
        assert is_non_http_asset_scheme(None) is False


# ---------------------------------------------------------------------------
# is_article_eligible_url
# ---------------------------------------------------------------------------

class TestIsArticleEligibleUrl:
    def test_accepts_news_article(self):
        assert is_article_eligible_url("https://vnexpress.net/tin-moi-nhat-p2.html") is True

    def test_accepts_blog_post(self):
        assert is_article_eligible_url("https://medium.com/@user/some-article-title-abc123") is True

    def test_rejects_google_news_discovery(self):
        assert is_article_eligible_url("https://news.google.com/rss/articles/CBMiXW...") is False

    def test_rejects_login_page(self):
        assert is_article_eligible_url("https://example.com/login") is False

    def test_rejects_privacy_policy(self):
        assert is_article_eligible_url("https://example.com/privacy") is False

    def test_rejects_rss_feed(self):
        assert is_article_eligible_url("https://example.com/feed") is False

    def test_rejects_image_file(self):
        assert is_article_eligible_url("https://cdn.example.com/image.jpg") is False

    def test_rejects_js_file(self):
        assert is_article_eligible_url("https://example.com/static/app.js") is False

    def test_rejects_data_uri(self):
        assert is_article_eligible_url("data:image/png;base64,abc") is False

    def test_rejects_none(self):
        assert is_article_eligible_url(None) is False

    def test_rejects_empty(self):
        assert is_article_eligible_url("") is False

    def test_rejects_googleusercontent(self):
        assert is_article_eligible_url("https://lh3.googleusercontent.com/photo.jpg") is False


# ---------------------------------------------------------------------------
# domain_from_url
# ---------------------------------------------------------------------------

class TestDomainFromUrl:
    def test_extracts_domain(self):
        assert domain_from_url("https://www.vnexpress.net/article") == "vnexpress.net"

    def test_strips_www(self):
        assert domain_from_url("https://www.tuoitre.vn/article") == "tuoitre.vn"

    def test_returns_none_for_google_news(self):
        assert domain_from_url("https://news.google.com/rss/articles/abc") is None

    def test_returns_none_for_none(self):
        assert domain_from_url(None) is None

    def test_returns_none_for_blocked(self):
        assert domain_from_url("https://lh3.googleusercontent.com/photo.jpg") is None

    def test_returns_none_for_js_file(self):
        assert domain_from_url("https://cdn.example.com/script.js") is None


# ---------------------------------------------------------------------------
# _calculate_title_similarity
# ---------------------------------------------------------------------------

class TestCalculateTitleSimilarity:
    def test_identical_titles(self):
        score = _calculate_title_similarity("Hà Nội hôm nay", "Hà Nội hôm nay")
        assert score >= 0.9

    def test_substring_match(self):
        score = _calculate_title_similarity("Hà Nội", "Tin tức Hà Nội hôm nay")
        assert score >= 0.5

    def test_no_match(self):
        score = _calculate_title_similarity("Python tutorial", "Bánh mì Việt Nam")
        assert score < 0.3

    def test_empty_strings(self):
        assert _calculate_title_similarity("", "some title") == 0.0
        assert _calculate_title_similarity("some title", "") == 0.0
        assert _calculate_title_similarity("", "") == 0.0


# ---------------------------------------------------------------------------
# build_provenance_for_direct_crawl
# ---------------------------------------------------------------------------

class TestBuildProvenanceForDirectCrawl:
    REQUIRED_KEYS = {
        "provider",
        "raw_provider_url",
        "redirect_resolved_url",
        "canonical_html_url",
        "og_url",
        "schema_url",
        "final_canonical_url",
        "final_domain",
        "source_confidence",
        "source_confidence_reasons",
        "is_article_like",
        "is_clickable",
        "blocked_reason",
    }

    def test_has_required_keys(self):
        prov = build_provenance_for_direct_crawl(
            final_url="https://vnexpress.net/bai-viet.html",
            canonical_url="https://vnexpress.net/bai-viet.html",
            og_url=None,
            redirect_resolved_url="https://vnexpress.net/bai-viet.html",
            is_article_like=True,
        )
        for key in self.REQUIRED_KEYS:
            assert key in prov, f"Missing key: {key}"

    def test_high_confidence_when_canonical_and_redirect_agree(self):
        prov = build_provenance_for_direct_crawl(
            final_url="https://vnexpress.net/bai-viet.html",
            canonical_url="https://vnexpress.net/bai-viet.html",
            og_url=None,
            redirect_resolved_url="https://vnexpress.net/bai-viet.html",
            is_article_like=True,
        )
        assert prov["source_confidence"] >= 0.7
        assert prov["is_clickable"] is True

    def test_blocked_for_utility_url(self):
        prov = build_provenance_for_direct_crawl(
            final_url="https://example.com/login",
            canonical_url="https://example.com/login",
            og_url=None,
            redirect_resolved_url="https://example.com/login",
            is_article_like=False,
        )
        assert prov["final_canonical_url"] is None
        assert prov["blocked_reason"] is not None
        assert prov["is_clickable"] is False

    def test_display_domain_never_google_news(self):
        prov = build_provenance_for_direct_crawl(
            final_url="https://vnexpress.net/bai-viet.html",
            canonical_url="https://vnexpress.net/bai-viet.html",
            og_url=None,
            redirect_resolved_url="https://vnexpress.net/bai-viet.html",
            is_article_like=True,
        )
        assert prov.get("final_domain") != "news.google.com"
        assert prov.get("final_domain") != "www.news.google.com"

    def test_confidence_is_float_between_0_and_1(self):
        prov = build_provenance_for_direct_crawl(
            final_url="https://vnexpress.net/bai-viet.html",
            canonical_url=None,
            og_url=None,
            redirect_resolved_url=None,
            is_article_like=True,
        )
        conf = prov["source_confidence"]
        assert isinstance(conf, float)
        assert 0.0 <= conf <= 1.0


# ---------------------------------------------------------------------------
# Provenance metrics
# ---------------------------------------------------------------------------

class TestProvenanceMetrics:
    def test_record_and_get_metrics(self):
        metrics_before = get_provenance_metrics()
        record_provenance_metric("blocked_utility_url_count")
        metrics_after = get_provenance_metrics()
        assert metrics_after["blocked_utility_url_count"] == metrics_before["blocked_utility_url_count"] + 1

    def test_get_metrics_returns_all_keys(self):
        metrics = get_provenance_metrics()
        expected_keys = {
            "source_resolution_success_rate_attempts",
            "source_resolution_success_rate_successes",
            "title_domain_consistency_rate_checks",
            "title_domain_consistency_rate_consistent",
            "invalid_visit_url_count",
            "blocked_utility_url_count",
            "blocked_feed_url_count",
            "blocked_asset_url_count",
            "low_confidence_mention_count",
            "preview_image_match_count",
            "preview_image_mismatch_count",
        }
        for key in expected_keys:
            assert key in metrics, f"Missing metric key: {key}"
