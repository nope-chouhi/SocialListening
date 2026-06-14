"""
Auto Discovery Service — Main orchestrator for Nope.
Coordinates SerpAPI search → Website crawl → Keyword match → Mention creation → Source discovery → RSS detection.
"""
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.models.discovery import (
    DiscoveryJob, DiscoveryJobStatus,
    DiscoveredSource, DiscoveredSourceStatus,
    BlockedDomain, RecommendedMonitoringType,
)
from app.models.mention import Mention
from app.models.source import Source
from app.models.keyword import Keyword, KeywordGroup

logger = logging.getLogger(__name__)

# ─── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    """Normalize URL: lowercase domain, strip fragment, trailing slash."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        scheme = parsed.scheme or "https"
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        query = parsed.query
        result = f"{scheme}://{netloc}{path}"
        if query:
            result += f"?{query}"
        return result
    except Exception:
        return url.strip()


def _extract_domain(url: str) -> str:
    """Extract domain without www."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _generate_content_hash(content: str) -> str:
    """Generate SHA-256 hash for deduplication."""
    return hashlib.sha256(content.strip().encode("utf-8")).hexdigest()


def _match_keywords(
    text: str,
    keywords: List[str],
    exclude_keywords: List[str] = None,
) -> Dict:
    """
    Match keywords in text.
    Case-insensitive, supports Vietnamese, phrase matching.
    
    Returns:
        {
            "matched": bool,
            "matched_keywords": [{"keyword": str, "count": int}],
            "excluded": bool,
            "excluded_by": str or None,
            "match_context": str,  # snippet around first match
        }
    """
    if not text or not text.strip():
        return {"matched": False, "matched_keywords": [], "excluded": False, "excluded_by": None, "match_context": ""}

    import unicodedata
    text_lower = unicodedata.normalize('NFC', text.lower().strip())

    # Check exclude keywords first
    if exclude_keywords:
        for ex_kw in exclude_keywords:
            ex_kw = ex_kw.strip()
            if not ex_kw:
                continue
            ex_kw_norm = unicodedata.normalize('NFC', ex_kw.lower())
            if ex_kw_norm in text_lower:
                return {
                    "matched": False,
                    "matched_keywords": [],
                    "excluded": True,
                    "excluded_by": ex_kw,
                    "match_context": "",
                }

    matched = []
    first_match_pos = -1

    for kw in keywords:
        kw = kw.strip()
        if not kw:
            continue
        kw_lower = unicodedata.normalize('NFC', kw.lower())
        count = text_lower.count(kw_lower)
        if count > 0:
            matched.append({"keyword": kw, "count": count})
            if first_match_pos < 0:
                first_match_pos = text_lower.find(kw_lower)

    # Build match context (snippet around first match)
    match_context = ""
    if first_match_pos >= 0:
        start = max(0, first_match_pos - 80)
        end = min(len(text), first_match_pos + 200)
        match_context = text[start:end].strip()
        if start > 0:
            match_context = "..." + match_context
        if end < len(text):
            match_context = match_context + "..."

    return {
        "matched": len(matched) > 0,
        "matched_keywords": matched,
        "excluded": False,
        "excluded_by": None,
        "match_context": match_context,
    }


def _crawl_url_for_discovery(url: str) -> Dict:
    """
    Hardened website crawler for discovery.
    Fetches URL, extracts title/body/meta/canonical/language.
    Does NOT parse HTML as RSS. Does NOT crawl login pages.
    """
    import requests
    from bs4 import BeautifulSoup

    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        if "tiktok.com" in domain:
            return {"success": False, "error": "Nguồn này chưa hỗ trợ crawl trực tiếp. Cần connector riêng (TikTok)."}
        if "facebook.com" in domain or "instagram.com" in domain:
            return {"success": False, "error": "Nguồn này chưa hỗ trợ crawl trực tiếp. Cần connector riêng (Meta)."}

        headers = {"User-Agent": settings.CRAWL_USER_AGENT}
        response = requests.get(
            url,
            headers=headers,
            timeout=settings.CRAWL_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()

        content_type = response.headers.get("content-type", "").lower()

        # Skip non-HTML content
        if "text/html" not in content_type and "text/plain" not in content_type:
            return {"success": False, "error": "Không đọc được nội dung website."}

        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        # Remove noise tags
        for tag_name in ["script", "style", "nav", "footer", "aside", "header", "noscript", "iframe"]:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        # Extract title
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        if not title:
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                title = og_title["content"].strip()
        if not title:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text(strip=True)

        # Extract canonical URL
        canonical_url = url
        canonical_tag = soup.find("link", rel="canonical")
        if canonical_tag and canonical_tag.get("href"):
            canonical_url = canonical_tag["href"].strip()

        # Extract meta description
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = meta_tag["content"].strip()
        if not meta_desc:
            og_desc = soup.find("meta", property="og:description")
            if og_desc and og_desc.get("content"):
                meta_desc = og_desc["content"].strip()

        # Detect language
        language = ""
        html_tag = soup.find("html")
        if html_tag and html_tag.get("lang"):
            language = html_tag["lang"].strip().lower()
        if not language:
            meta_lang = soup.find("meta", attrs={"http-equiv": "content-language"})
            if meta_lang and meta_lang.get("content"):
                language = meta_lang["content"].strip().lower()

        # Extract body text
        body_text = ""
        # Try main content areas first
        for selector in ["article", "main", "[role='main']", ".content", "#content", ".post-content", ".entry-content"]:
            container = soup.select_one(selector)
            if container:
                body_text = container.get_text(separator=" ", strip=True)
                break
        if not body_text and soup.body:
            body_text = soup.body.get_text(separator=" ", strip=True)

        # Clean up whitespace
        body_text = re.sub(r"\s+", " ", body_text).strip()
        body_text = body_text[:10000]  # Limit

        # Create snippet
        snippet = body_text[:300].strip()
        if len(body_text) > 300:
            snippet += "..."

        # Content hash
        content_for_hash = (title + " " + body_text[:2000]).strip()
        content_hash = _generate_content_hash(content_for_hash) if content_for_hash else ""

        # Extract published date
        published_at = None
        date_meta = soup.find("meta", property="article:published_time")
        if date_meta and date_meta.get("content"):
            try:
                published_at = date_meta["content"]
            except Exception:
                pass
        if not published_at:
            time_tag = soup.find("time", attrs={"datetime": True})
            if time_tag:
                published_at = time_tag["datetime"]

        # Extract author
        author = ""
        author_meta = soup.find("meta", attrs={"name": "author"})
        if author_meta and author_meta.get("content"):
            author = author_meta["content"].strip()

        return {
            "success": True,
            "title": title[:500] if title else "",
            "body_text": body_text,
            "snippet": snippet,
            "meta_description": meta_desc[:1000] if meta_desc else "",
            "canonical_url": canonical_url,
            "language": language,
            "content_hash": content_hash,
            "published_at": published_at,
            "author": author[:500] if author else "",
            "final_url": str(response.url),
        }

    except requests.exceptions.Timeout:
        return {"success": False, "error": "Không thể truy cập website gốc."}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Không thể truy cập website gốc."}
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response else 0
        if status_code in (401, 403):
            return {"success": False, "error": "Không thể truy cập website gốc."}
        return {"success": False, "error": "Không đọc được nội dung website."}
    except Exception as e:
        logger.error(f"Crawl error for {url}: {e}")
        return {"success": False, "error": "Không đọc được nội dung website."}


def _calculate_relevance_score(
    mention_count: int,
    keyword_in_title: bool,
    keyword_in_content: bool,
    multiple_urls: bool,
    language_match: bool,
    rss_valid: bool,
    source_type: str,
) -> float:
    """Calculate relevance score 0-100."""
    score = 0.0

    # Mention count (max 30 pts)
    score += min(mention_count * 10, 30)

    # Keyword in title (15 pts)
    if keyword_in_title:
        score += 15

    # Keyword in content (10 pts)
    if keyword_in_content:
        score += 10

    # Multiple URLs from same domain (10 pts)
    if multiple_urls:
        score += 10

    # Language match (10 pts)
    if language_match:
        score += 10

    # Valid RSS (15 pts)
    if rss_valid:
        score += 15

    # Source type bonus (10 pts)
    if source_type in ("news", "blog"):
        score += 10
    elif source_type == "forum":
        score += 5

    return min(score, 100.0)


def _guess_source_type(domain: str, title: str = "", body: str = "") -> str:
    """Guess source type from domain and content."""
    domain_lower = domain.lower()
    text_lower = (title + " " + body[:500]).lower()

    news_indicators = ["news", "tin tuc", "tin-tuc", "bao", "press", "thoi-su", "thời sự"]
    blog_indicators = ["blog", "medium.com", "wordpress", "blogspot"]
    forum_indicators = ["forum", "dien-dan", "diễn đàn", "community", "reddit"]

    for ind in news_indicators:
        if ind in domain_lower or ind in text_lower:
            return "news"
    for ind in blog_indicators:
        if ind in domain_lower:
            return "blog"
    for ind in forum_indicators:
        if ind in domain_lower or ind in text_lower:
            return "forum"

    return "website"


# ─── Main Orchestrator ─────────────────────────────────────────────────────────

def create_discovery_job(db: Session, user_id: int, request_data: dict) -> DiscoveryJob:
    """Create a discovery job record in DB."""
    job = DiscoveryJob(
        keyword_group_id=request_data.get("keyword_group_id"),
        status=DiscoveryJobStatus.QUEUED,
        query_keywords=request_data.get("keywords", []),
        exclude_keywords=request_data.get("exclude_keywords", []),
        language=request_data.get("language", "vi"),
        country=request_data.get("country", "vn"),
        date_range=request_data.get("date_range", ""),
        limit=request_data.get("limit", 50),
        created_by_user_id=user_id,
    )
    db.add(job)
    db.flush()
    return job


def run_discovery_job(db: Session, job_id: int) -> DiscoveryJob:
    """
    Run a discovery job end-to-end:
    1. Search via SerpAPI
    2. Crawl each URL
    3. Match keywords
    4. Create mentions (with dedup)
    5. Create/update discovered sources
    6. Discover RSS feeds
    7. Calculate relevance scores
    """
    job = db.query(DiscoveryJob).get(job_id)
    if not job:
        raise ValueError(f"Discovery job {job_id} not found")

    # Set running
    job.status = DiscoveryJobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    job.providers_used_json = []
    db.commit()
    
    logger.info(f"STAGE D: Discovery Job created and running (job_id={job.id}, mode=AUTO_DISCOVERY, keyword_count={len(job.query_keywords or [])})")

    keywords = job.query_keywords or []
    exclude_keywords = job.exclude_keywords or []

    if not keywords:
        job.status = DiscoveryJobStatus.FAILED
        job.error_message = "Không có từ khóa để tìm kiếm."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job

    # ── Step 1: Get blocked domains ──
    blocked_domains: Set[str] = set()
    try:
        blocked_rows = db.execute(select(BlockedDomain.domain)).scalars().all()
        blocked_domains = {d.lower() for d in blocked_rows}
    except Exception as e:
        logger.warning(f"Could not load blocked domains: {e}")

    # ── Step 2: Search via SerpAPI ──
    search_results = []
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    logger.info(f"STAGE E: Calling SerpAPI (configured={has_serpapi})")
    try:
        from app.services.serpapi_provider import search, SerpAPINotConfigured, SerpAPIRateLimitError
        search_results = search(
            keywords=keywords,
            language=job.language if job.language is not None else "vi",
            country=job.country if job.country is not None else "vn",
            limit=job.limit or 50,
            date_range=job.date_range or "",
        )
        job.providers_used_json = ["serpapi"]
    except SerpAPINotConfigured as e:
        job.status = DiscoveryJobStatus.FAILED
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job
    except SerpAPIRateLimitError as e:
        job.status = DiscoveryJobStatus.FAILED
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job
    except Exception as e:
        logger.error(f"Search error: {e}")
        job.status = DiscoveryJobStatus.FAILED
        job.error_message = "Lỗi khi tìm kiếm qua Web. Vui lòng thử lại."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job

    # ── Step 2.5: Search via YouTube (if configured) ──
    try:
        from app.services.connectors.youtube_connector import YouTubeConnector
        yt_conn = YouTubeConnector()
        if yt_conn.validate_config():
            yt_videos = yt_conn.search_keywords(keywords=keywords, max_results=50)
            if "youtube" not in (job.providers_used_json or []):
                providers = job.providers_used_json or []
                providers.append("youtube")
                job.providers_used_json = providers
                
            for vid in yt_videos:
                search_results.append({
                    "url": vid["url"],
                    "domain": "youtube.com",
                    "title": vid["title"],
                    "snippet": vid["content"],
                    "author": vid["author"],
                    "published_at": vid["published_at"],
                    "is_social_video": True,
                    "youtube_data": vid
                })
    except Exception as e:
        logger.error(f"YouTube search error during discovery: {e}")
        # Non-fatal, continue with web results
        
    job.urls_found = len(search_results)
    logger.info(f"STAGE F: URLs discovered (count={len(search_results)})")

    if not search_results:
        job.status = DiscoveryJobStatus.COMPLETED
        job.error_message = "Không tìm thấy nguồn phù hợp với từ khóa."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job

    # ── Step 3: Process each URL ──
    seen_urls: Set[str] = set()
    domain_data: Dict[str, dict] = {}  # domain -> aggregated data

    logger.info(f"STAGE G & H: Crawling {len(search_results)} URLs and matching keywords...")

    for sr in search_results:
        url = sr["url"]
        domain = sr["domain"]

        # Skip blocked domains
        if domain in blocked_domains:
            job.blocked_domains_skipped = (job.blocked_domains_skipped or 0) + 1
            continue

        # Skip duplicate URLs
        normalized_url = _normalize_url(url)
        if normalized_url in seen_urls:
            job.duplicates_skipped = (job.duplicates_skipped or 0) + 1
            continue
        seen_urls.add(normalized_url)

        # ── Crawl the URL ──
        if sr.get("is_social_video"):
            # Don't crawl YouTube pages directly, use the API data
            yt_data = sr.get("youtube_data", {})
            crawl_result = {
                "success": True,
                "title": yt_data.get("title", ""),
                "body_text": yt_data.get("content", ""),
                "snippet": yt_data.get("content", ""),
                "canonical_url": url,
                "language": "vi",
                "content_hash": _generate_content_hash(yt_data.get("title", "") + " " + yt_data.get("content", "")),
                "published_at": yt_data.get("published_at"),
                "author": yt_data.get("author", ""),
                "final_url": url,
            }
            job.pages_scanned = (job.pages_scanned or 0) + 1
        else:
            crawl_result = _crawl_url_for_discovery(url)
            job.pages_scanned = (job.pages_scanned or 0) + 1

        if not crawl_result.get("success"):
            job.failed_items = (job.failed_items or 0) + 1
            # Still track domain even if crawl fails
            if domain not in domain_data:
                domain_data[domain] = {
                    "urls": [],
                    "mentions": 0,
                    "matched_keywords": set(),
                    "title": sr.get("title", ""),
                    "crawl_failed": True,
                }
            domain_data[domain]["urls"].append(url)
            continue

        # ── Build full text for keyword matching ──
        full_text_parts = [
            sr.get("title", ""),
            sr.get("snippet", ""),
            crawl_result.get("title", ""),
            crawl_result.get("body_text", ""),
            crawl_result.get("meta_description", ""),
        ]
        full_text = " ".join(p for p in full_text_parts if p)

        # ── Match keywords ──
        match_result = _match_keywords(full_text, keywords, exclude_keywords)

        if not match_result["matched"]:
            # Track domain but don't create mention
            if domain not in domain_data:
                domain_data[domain] = {
                    "urls": [],
                    "mentions": 0,
                    "matched_keywords": set(),
                    "title": sr.get("title", "") or crawl_result.get("title", ""),
                    "crawl_failed": False,
                }
            domain_data[domain]["urls"].append(url)
            continue

        # ── Deduplication check ──
        content_hash = crawl_result.get("content_hash", "")
        is_duplicate = False

        if content_hash:
            existing = db.execute(
                select(Mention).where(Mention.content_hash == content_hash)
            ).scalar_one_or_none()
            if existing:
                is_duplicate = True

        if not is_duplicate:
            existing_by_url = db.execute(
                select(Mention).where(Mention.url == normalized_url)
            ).scalar_one_or_none()
            if existing_by_url:
                is_duplicate = True

        if is_duplicate:
            job.duplicates_skipped = (job.duplicates_skipped or 0) + 1
            # Still track the domain
            if domain not in domain_data:
                domain_data[domain] = {
                    "urls": [],
                    "mentions": 0,
                    "matched_keywords": set(),
                    "title": sr.get("title", "") or crawl_result.get("title", ""),
                    "crawl_failed": False,
                }
            domain_data[domain]["urls"].append(url)
            for mk in match_result["matched_keywords"]:
                domain_data[domain]["matched_keywords"].add(mk["keyword"])
            continue

        # ── Create mention ──
        try:
            # We need a source_id. Use source_id=0 as a placeholder for auto-discovered mentions
            # or find/create a placeholder source
            mention_content = crawl_result.get("body_text", "") or sr.get("snippet", "")
            if not mention_content:
                mention_content = sr.get("title", "") or crawl_result.get("title", "")

            matched_kw_data = [
                {"keyword": mk["keyword"], "count": mk["count"]}
                for mk in match_result["matched_keywords"]
            ]

            source_type = sr.get("source_type") or _guess_source_type(domain, crawl_result.get("title", ""))
            platform = sr.get("platform") or "web"
            if sr.get("is_social_video"):
                source_type = "video"
                platform = "youtube"

            is_synthetic = domain in ("news.com", "example.com", "test.com", "") or "localhost" in domain or "127.0.0.1" in domain
            
            if is_synthetic:
                ver_status = "synthetic"
                ver_error = "Quarantined placeholder data"
            elif not crawl_result.get("success") and not sr.get("is_social_video"):
                ver_status = "reliable"
                ver_error = "Could not fetch original page content"
            else:
                ver_status = "verified"
                ver_error = None

            mention = Mention(
                project_id=job.project_id,  # Set project_id from discovery job
                job_id=job.id,
                source_id=None,  # Nullable for auto-discovered
                keyword_text=keywords[0] if keywords else None,
                source_type=source_type,
                platform=platform,
                domain=domain,
                title=(crawl_result.get("title") or sr.get("title", ""))[:500] if (crawl_result.get("title") or sr.get("title")) else None,
                content=mention_content[:10000],
                snippet=match_result.get("match_context", "")[:1000] if match_result.get("match_context") else sr.get("snippet", "")[:1000],
                content_hash=content_hash or _generate_content_hash(mention_content),
                url=normalized_url,
                author=crawl_result.get("author", ""),
                published_at=crawl_result.get("published_at") or sr.get("published_at"),
                collected_at=datetime.now(timezone.utc),
                matched_keywords=matched_kw_data,
                language=crawl_result.get("language", ""),
                country=job.country,
                meta_data={
                    "search_position": sr.get("position"),
                },
                extraction_source="crawled_page" if crawl_result.get("success") else "search_result",
                is_reviewed=False,
                verification_status=ver_status,
                verification_error=ver_error,
            )
            
            # Simple influence score calculation
            base_score = 5.0
            if sr.get("position"):
                try:
                    pos = int(sr.get("position"))
                    base_score = max(0.1, 10.0 - (pos * 0.2))
                except Exception:
                    pass
            mention.influence_score = base_score
            db.add(mention)
            db.flush()

            job.mentions_created = (job.mentions_created or 0) + 1

            # Try AI analysis (non-blocking)
            try:
                from app.services.ai_service import analyze_mention as ai_analyze
                from app.models.mention import AIAnalysis
                analysis_result = ai_analyze(mention.content, mention.title)
                ai_analysis = AIAnalysis(
                    mention_id=mention.id,
                    sentiment=analysis_result["sentiment"],
                    risk_score=analysis_result["risk_score"],
                    crisis_level=analysis_result["crisis_level"],
                    summary_vi=analysis_result.get("summary_vi", ""),
                    suggested_action=analysis_result.get("suggested_action", "monitor"),
                    responsible_department=analysis_result.get("responsible_department", "customer_service"),
                    confidence_score=analysis_result.get("confidence_score", 65.0),
                    ai_provider=analysis_result.get("ai_provider", "dummy"),
                    model_version="1.0",
                    processing_time_ms=analysis_result.get("processing_time_ms", 0),
                )
                db.add(ai_analysis)
            except Exception as ai_err:
                logger.info(f"AI analysis skipped for discovery mention: {ai_err}")
                # Create a placeholder analysis
                try:
                    from app.models.mention import AIAnalysis
                    ai_analysis = AIAnalysis(
                        mention_id=mention.id,
                        sentiment="neutral",
                        risk_score=0.0,
                        crisis_level=1,
                        summary_vi="AI chưa cấu hình, mention đã được lưu nhưng chưa phân tích AI.",
                        suggested_action="monitor",
                        responsible_department="customer_service",
                        confidence_score=0.0,
                        ai_provider="skipped",
                        model_version="1.0",
                        processing_time_ms=0,
                    )
                    db.add(ai_analysis)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Error creating mention for {url}: {e}")
            job.failed_items = (job.failed_items or 0) + 1

        # Track domain
        if domain not in domain_data:
            domain_data[domain] = {
                "urls": [],
                "mentions": 0,
                "matched_keywords": set(),
                "title": sr.get("title", "") or crawl_result.get("title", ""),
                "crawl_failed": False,
                "language": crawl_result.get("language", ""),
            }
        domain_data[domain]["urls"].append(url)
        domain_data[domain]["mentions"] += 1
        for mk in match_result["matched_keywords"]:
            domain_data[domain]["matched_keywords"].add(mk["keyword"])

    db.commit()  # Commit mentions

    # ── Step 4: Create/update discovered sources + RSS discovery ──
    for domain, ddata in domain_data.items():
        try:
            # Check if discovered source already exists for this domain
            existing_ds = db.execute(
                select(DiscoveredSource).where(
                    DiscoveredSource.domain == domain,
                )
            ).scalar_one_or_none()

            source_type = _guess_source_type(domain, ddata.get("title", ""))
            matched_kws = list(ddata.get("matched_keywords", set()))

            # RSS discovery
            rss_result = {"rss_feed_url": None, "rss_valid": False, "rss_error": None, "feed_title": "", "item_count": 0}
            try:
                from app.services.rss_discovery_service import discover_rss_feeds
                rss_result = discover_rss_feeds(domain)
                if rss_result.get("rss_valid"):
                    job.rss_feeds_detected = (job.rss_feeds_detected or 0) + 1
                    job.valid_rss_feeds = (job.valid_rss_feeds or 0) + 1
                elif rss_result.get("rss_feed_url"):
                    job.rss_feeds_detected = (job.rss_feeds_detected or 0) + 1
            except Exception as rss_err:
                logger.info(f"RSS discovery failed for {domain}: {rss_err}")

            # Determine recommended monitoring type
            if domain in blocked_domains:
                rec_type = RecommendedMonitoringType.BLOCKED
            elif rss_result.get("rss_valid"):
                rec_type = RecommendedMonitoringType.RSS
            elif not ddata.get("crawl_failed"):
                rec_type = RecommendedMonitoringType.WEBSITE
            else:
                rec_type = RecommendedMonitoringType.MANUAL_URL

            # Calculate relevance
            keyword_in_title = any(
                kw.lower() in ddata.get("title", "").lower()
                for kw in matched_kws
            ) if matched_kws else False

            relevance = _calculate_relevance_score(
                mention_count=ddata.get("mentions", 0),
                keyword_in_title=keyword_in_title,
                keyword_in_content=len(matched_kws) > 0,
                multiple_urls=len(ddata.get("urls", [])) > 1,
                language_match=ddata.get("language", "").startswith("vi"),
                rss_valid=rss_result.get("rss_valid", False),
                source_type=source_type,
            )

            # Build relevance reason
            reasons = []
            if ddata.get("mentions", 0) > 0:
                reasons.append(f"có {ddata['mentions']} mention khớp từ khóa")
            if len(ddata.get("urls", [])) > 1:
                reasons.append(f"{len(ddata['urls'])} URL từ domain này")
            if rss_result.get("rss_valid"):
                reasons.append("RSS hợp lệ")
            if keyword_in_title:
                reasons.append("từ khóa xuất hiện trong tiêu đề")
            relevance_reason = "Điểm liên quan " + ("cao" if relevance >= 50 else "trung bình" if relevance >= 25 else "thấp")
            if reasons:
                relevance_reason += " vì " + ", ".join(reasons) + "."

            if existing_ds:
                # Update existing
                existing_ds.last_seen_at = datetime.now(timezone.utc)
                existing_ds.discovery_job_id = job.id
                existing_ds.sample_mentions_count = (existing_ds.sample_mentions_count or 0) + ddata.get("mentions", 0)
                existing_ds.matched_keywords_json = list(set((existing_ds.matched_keywords_json or []) + matched_kws))
                existing_ds.relevance_score = max(existing_ds.relevance_score or 0, relevance)
                existing_ds.relevance_reason = relevance_reason
                if rss_result.get("rss_valid") and not existing_ds.rss_valid:
                    existing_ds.rss_feed_url = rss_result["rss_feed_url"]
                    existing_ds.rss_valid = True
                    existing_ds.rss_last_checked_at = datetime.now(timezone.utc)
                if rss_result.get("rss_error") and not existing_ds.rss_valid:
                    existing_ds.rss_error = rss_result["rss_error"]
                existing_ds.recommended_monitoring_type = rec_type
                if ddata.get("urls"):
                    existing_ds.sample_url = ddata["urls"][0]
                job.candidate_sources_updated = (job.candidate_sources_updated or 0) + 1
            else:
                # Create new
                ds = DiscoveredSource(
                    discovery_job_id=job.id,
                    source_name=ddata.get("title", domain)[:500] or domain,
                    domain=domain,
                    homepage_url=f"https://{domain}/",
                    url=ddata["urls"][0] if ddata.get("urls") else f"https://{domain}/",
                    source_type=source_type,
                    recommended_monitoring_type=rec_type,
                    rss_feed_url=rss_result.get("rss_feed_url"),
                    rss_valid=rss_result.get("rss_valid", False),
                    rss_last_checked_at=datetime.now(timezone.utc) if rss_result.get("rss_feed_url") else None,
                    rss_error=rss_result.get("rss_error"),
                    sample_url=ddata["urls"][0] if ddata.get("urls") else None,
                    sample_mentions_count=ddata.get("mentions", 0),
                    matched_keywords_json=matched_kws,
                    relevance_score=relevance,
                    relevance_reason=relevance_reason,
                    status=DiscoveredSourceStatus.CANDIDATE,
                    first_seen_at=datetime.now(timezone.utc),
                    last_seen_at=datetime.now(timezone.utc),
                )
                db.add(ds)
                job.candidate_sources_created = (job.candidate_sources_created or 0) + 1

        except Exception as e:
            logger.error(f"Error processing domain {domain}: {e}")
            job.failed_items = (job.failed_items or 0) + 1

    has_failures = (job.failed_items or 0) > 0
    mentions_created = job.mentions_created or 0
    urls_found = job.urls_found or 0
    pages_scanned = job.pages_scanned or 0
    has_results = mentions_created > 0 or (job.candidate_sources_created or 0) > 0

    if not search_results:
        job.status = DiscoveryJobStatus.COMPLETED
        job.error_message = "Không tìm thấy nguồn phù hợp với từ khóa."
    elif has_failures and has_results:
        job.status = DiscoveryJobStatus.PARTIAL_FAILED
        job.error_message = f"Hoàn tất một phần. Tìm thấy {urls_found} URL, tạo {mentions_created} mentions."
    elif has_failures and not has_results:
        job.status = DiscoveryJobStatus.FAILED
        if pages_scanned == 0:
            job.error_message = f"Tìm thấy {urls_found} URL, crawl 0 URL."
        else:
            job.error_message = "Đã tìm thấy URL nhưng không đọc được nội dung."
    else:
        job.status = DiscoveryJobStatus.COMPLETED
        if mentions_created == 0 and pages_scanned > 0:
            job.error_message = "Crawl thành công nhưng không có mention khớp từ khóa."
        else:
            job.error_message = f"Tạo {mentions_created} mentions."

    job.completed_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"STAGE I: Mentions created in DB (count={mentions_created}, urls_crawled={pages_scanned})")
    return job
