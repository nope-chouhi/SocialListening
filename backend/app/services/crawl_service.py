"""
Crawl Service for Social Listening Platform
Production-grade RSS scanner with deduplication, keyword matching, AI analysis.
"""
import hashlib
import logging
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
import feedparser
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.source import Source
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.crawl import CrawlJob, CrawlJobStatus

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 30
MAX_RSS_ENTRIES = 50
MAX_CONTENT_LENGTH = 10000
USER_AGENT = "Mozilla/5.0 (compatible; SocialListeningBot/1.0)"


def generate_content_hash(content: str) -> str:
    """Generate SHA-256 hash of content for deduplication"""
    return hashlib.sha256(content.strip().encode('utf-8')).hexdigest()


def generate_url_hash(url: str) -> str:
    """Generate hash of URL for quick dedup lookup"""
    return hashlib.sha256(url.strip().lower().encode('utf-8')).hexdigest()


def check_keyword_match(content: str, keywords: List[Keyword]) -> List[dict]:
    """
    Check if content matches any active keywords.
    Returns list of matched keyword info dicts.
    """
    content_lower = content.lower()
    matched = []

    for kw in keywords:
        if not kw.is_active:
            continue
        if kw.is_excluded:
            continue

        keyword_lower = kw.keyword.lower()
        if keyword_lower in content_lower:
            matched.append({
                "keyword_id": kw.id,
                "keyword": kw.keyword
            })

    return matched


def get_all_active_keywords(db: Session) -> List[Keyword]:
    """Get all active, non-excluded keywords from all groups"""
    try:
        keywords = db.execute(
            select(Keyword).where(Keyword.is_active == True, Keyword.is_excluded == False)
        ).scalars().all()
        return list(keywords)
    except Exception as e:
        logger.error(f"Error fetching keywords: {e}")
        return []


def crawl_rss_feed(url: str) -> Dict:
    """
    Crawl RSS/Atom feed with production error handling.

    Returns:
        {
            "success": True/False,
            "articles": [...],
            "feed_title": "...",
            "error": "..." (if failed)
        }
    """
    try:
        # Fetch with requests first for proper timeout/error handling
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        response.raise_for_status()

        # Parse with feedparser
        feed = feedparser.parse(response.content)

        if feed.bozo and not feed.entries:
            # feedparser detected an error and there are no entries
            error_msg = str(feed.bozo_exception) if hasattr(feed, 'bozo_exception') else "Malformed feed"
            return {
                "success": False,
                "articles": [],
                "feed_title": "",
                "error": f"Feed parse error: {error_msg}"
            }

        articles = []
        feed_title = feed.feed.get('title', '') if hasattr(feed, 'feed') else ''

        for entry in feed.entries[:MAX_RSS_ENTRIES]:
            title = entry.get('title', '').strip()
            link = entry.get('link', '').strip()

            # Get content - try multiple fields
            content_raw = (
                entry.get('content', [{}])[0].get('value', '') if entry.get('content') else ''
            ) or entry.get('summary', '') or entry.get('description', '')

            # Clean HTML from content
            if content_raw:
                try:
                    soup = BeautifulSoup(content_raw, 'html.parser')
                    content = soup.get_text(separator=' ', strip=True)
                except Exception:
                    content = content_raw
            else:
                content = ''

            # Truncate
            content = content[:MAX_CONTENT_LENGTH]

            # Parse published date
            published_at = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                try:
                    published_at = datetime(*entry.published_parsed[:6])
                except Exception:
                    pass
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                try:
                    published_at = datetime(*entry.updated_parsed[:6])
                except Exception:
                    pass

            author = entry.get('author', '').strip()

            if not link and not content:
                continue  # Skip empty entries

            articles.append({
                'title': title[:500] if title else None,
                'content': content,
                'url': link or url,
                'author': author[:500] if author else None,
                'published_at': published_at
            })

        return {
            "success": True,
            "articles": articles,
            "feed_title": feed_title,
            "error": None
        }

    except requests.exceptions.Timeout:
        return {"success": False, "articles": [], "feed_title": "", "error": f"Timeout after {REQUEST_TIMEOUT}s"}
    except requests.exceptions.ConnectionError as e:
        return {"success": False, "articles": [], "feed_title": "", "error": f"Connection error: {e}"}
    except requests.exceptions.HTTPError as e:
        return {"success": False, "articles": [], "feed_title": "", "error": f"HTTP error: {e}"}
    except Exception as e:
        logger.error(f"Unexpected error crawling RSS feed {url}: {e}")
        return {"success": False, "articles": [], "feed_title": "", "error": str(e)}


def crawl_html_page(url: str) -> Dict:
    """Crawl HTML page using BeautifulSoup"""
    try:
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Remove script and style
        for script in soup(["script", "style"]):
            script.decompose()

        title = ''
        if soup.title:
            title = soup.title.string or ''
        elif soup.find('h1'):
            title = soup.find('h1').get_text()

        content = ''
        for selector in ['article', 'main', '.content', '#content', '.post-content']:
            container = soup.select_one(selector)
            if container:
                content = container.get_text(separator=' ', strip=True)
                break
        if not content and soup.body:
            content = soup.body.get_text(separator=' ', strip=True)

        content = ' '.join(content.split())[:MAX_CONTENT_LENGTH]

        return {
            "success": True,
            "articles": [{
                'title': title[:500] if title else None,
                'content': content,
                'url': url,
                'author': None,
                'published_at': None
            }],
            "feed_title": title,
            "error": None
        }
    except Exception as e:
        return {"success": False, "articles": [], "feed_title": "", "error": str(e)}


def test_rss_feed(url: str) -> Dict:
    """
    Test an RSS feed URL without saving anything.
    Returns validation result for the frontend.
    """
    result = crawl_rss_feed(url)
    return {
        "valid": result["success"],
        "feed_title": result.get("feed_title", ""),
        "item_count": len(result.get("articles", [])),
        "sample_titles": [a['title'] for a in result.get("articles", [])[:5]],
        "error": result.get("error")
    }


def crawl_source(db: Session, source_id: int, job_id: int = None) -> Dict:
    """
    Crawl a source and save mentions.
    Production-grade: deduplication, keyword matching, AI analysis, alert creation.

    Returns: dict with crawl results
    """
    source = db.execute(
        select(Source).where(Source.id == source_id)
    ).scalar_one_or_none()

    if not source:
        raise ValueError(f"Source {source_id} not found")
    if not source.is_active:
        raise ValueError(f"Source {source_id} is not active")

    # Get all active keywords
    keywords = get_all_active_keywords(db)

    # Crawl based on source type
    if source.source_type in ('rss', 'news'):
        result = crawl_rss_feed(source.url)
    elif source.source_type in ('website', 'manual_url', 'forum'):
        result = crawl_html_page(source.url)
    else:
        logger.info(f"Source type {source.source_type} not yet supported for automated crawling")
        return {
            'mentions_found': 0,
            'mentions_new': 0,
            'mentions_duplicate': 0,
            'error': None
        }

    if not result["success"]:
        raise ValueError(f"Crawl failed: {result['error']}")

    articles = result["articles"]
    mentions_found = len(articles)
    mentions_new = 0
    mentions_duplicate = 0

    for article in articles:
        try:
            # Skip if no content
            if not article.get('content') and not article.get('title'):
                continue

            full_text = f"{article.get('title', '')} {article.get('content', '')}"

            # Dedup by URL first
            if article.get('url'):
                existing_by_url = db.execute(
                    select(Mention).where(Mention.url == article['url'])
                ).scalar_one_or_none()
                if existing_by_url:
                    mentions_duplicate += 1
                    continue

            # Dedup by content hash
            content_for_hash = article.get('content', '') or article.get('title', '')
            content_hash = generate_content_hash(content_for_hash)
            existing_by_hash = db.execute(
                select(Mention).where(Mention.content_hash == content_hash)
            ).scalar_one_or_none()
            if existing_by_hash:
                mentions_duplicate += 1
                continue

            # Check keyword match
            matched_keywords = check_keyword_match(full_text, keywords)

            # Only save if keywords match (or no keywords configured)
            if not matched_keywords and keywords:
                continue

            # Create mention
            mention = Mention(
                source_id=source_id,
                title=article['title'],
                content=article['content'],
                content_hash=content_hash,
                url=article['url'],
                author=article.get('author'),
                published_at=article.get('published_at'),
                collected_at=datetime.now(timezone.utc),
                matched_keywords=matched_keywords if matched_keywords else None,
                is_reviewed=False
            )
            db.add(mention)
            db.flush()  # Get mention.id without committing

            # AI Analysis
            try:
                from app.services.ai_service import analyze_mention as ai_analyze
                analysis_result = ai_analyze(mention.content, mention.title)

                ai_analysis = AIAnalysis(
                    mention_id=mention.id,
                    sentiment=analysis_result['sentiment'],
                    risk_score=analysis_result['risk_score'],
                    crisis_level=analysis_result['crisis_level'],
                    summary_vi=analysis_result.get('summary_vi', ''),
                    suggested_action=analysis_result.get('suggested_action', 'monitor'),
                    responsible_department=analysis_result.get('responsible_department', 'customer_service'),
                    confidence_score=analysis_result.get('confidence_score', 65.0),
                    ai_provider=analysis_result.get('ai_provider', 'dummy'),
                    model_version='1.0',
                    processing_time_ms=analysis_result.get('processing_time_ms', 0)
                )
                db.add(ai_analysis)

                # Create alert if high risk
                if analysis_result['risk_score'] >= 70:
                    severity = AlertSeverity.CRITICAL if analysis_result['risk_score'] >= 85 else AlertSeverity.HIGH
                    alert = Alert(
                        mention_id=mention.id,
                        severity=severity,
                        status=AlertStatus.NEW,
                        title=f"High risk mention: {mention.title or mention.url}",
                        message=f"Risk: {analysis_result['risk_score']}, Crisis: {analysis_result['crisis_level']}"
                    )
                    db.add(alert)

            except Exception as e:
                logger.warning(f"AI analysis failed for mention {mention.id}: {e}")
                # Mention is still saved without AI analysis

            mentions_new += 1

        except Exception as e:
            logger.error(f"Error processing article: {e}")
            continue

    # Commit all new mentions
    if mentions_new > 0:
        db.commit()

    return {
        'mentions_found': mentions_found,
        'mentions_new': mentions_new,
        'mentions_duplicate': mentions_duplicate,
        'error': None
    }
