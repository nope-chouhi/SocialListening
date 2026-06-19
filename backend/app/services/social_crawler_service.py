"""
Social platform crawler: Twitter, Reddit, News API.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import xml.etree.ElementTree as ET
import urllib.parse
import email.utils
import re
import html

from app.core.config import settings
from app.services.url_utils import (
    clean_final_url,
    domain_from_url,
    extract_google_news_embedded_url,
    is_google_news_discovery_url,
)

logger = logging.getLogger(__name__)


class SocialCrawlerService:
    """Fetch mentions from Twitter, Reddit, and News APIs."""

    def __init__(self):
        self.timeout = 30.0
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        self._url_cache = {}

    async def _resolve_news_url(self, client: httpx.AsyncClient, url: str) -> Optional[str]:
        if url in self._url_cache:
            return self._url_cache[url]

        embedded_url = extract_google_news_embedded_url(url)
        if embedded_url:
            self._url_cache[url] = embedded_url
            return embedded_url

        direct_url = clean_final_url(url)
        if direct_url:
            self._url_cache[url] = direct_url
            return direct_url

        try:
            # Fallback to HTTP redirect resolution
            response = await client.get(url, timeout=8.0, follow_redirects=True, headers={"User-Agent": self.user_agent})
            final_url = clean_final_url(str(response.url))
            if final_url:
                self._url_cache[url] = final_url
                return final_url

            if is_google_news_discovery_url(url):
                candidates = re.findall(r"https?://[^\"'<>\\\s]+", response.text or "")
                for raw_candidate in candidates:
                    possible_url = html.unescape(urllib.parse.unquote(raw_candidate)).rstrip(").,;]")
                    final_url = clean_final_url(possible_url)
                    if final_url:
                        self._url_cache[url] = final_url
                        return final_url
        except Exception as e:
            logger.debug(f"Failed to resolve URL {url}: {e}")

        self._url_cache[url] = None
        return None

    async def crawl_twitter(self, keyword: str, limit: int = 50) -> List[Dict[str, Any]]:
        token = settings.TWITTER_BEARER_TOKEN or os.getenv("TWITTER_BEARER_TOKEN", "")
        if not token:
            logger.debug("Twitter crawl skipped: TWITTER_BEARER_TOKEN not set")
            return []

        url = "https://api.twitter.com/2/tweets/search/recent"
        params = {
            "query": keyword,
            "max_results": limit,
            "tweet.fields": "created_at,public_metrics,author_id",
        }
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

        tweets = data.get("data") or []
        results = []
        for tweet in tweets:
            metrics = tweet.get("public_metrics") or {}
            interactions = (
                (metrics.get("retweet_count") or 0)
                + (metrics.get("like_count") or 0)
                + (metrics.get("reply_count") or 0)
            )
            created = tweet.get("created_at")
            results.append({
                "source": "twitter",
                "platform": "twitter",
                "source_type": "twitter",
                "author": str(tweet.get("author_id", "unknown")),
                "title": None,
                "content": tweet.get("text", ""),
                "url": f"https://twitter.com/i/web/status/{tweet.get('id')}",
                "timestamp": datetime.fromisoformat(created.replace("Z", "+00:00")) if created else datetime.now(timezone.utc),
                "interactions": interactions,
                "reach_estimate": interactions * 10,
                "platform_post_id": tweet.get("id"),
            })
        return results

    async def crawl_reddit(self, keyword: str, limit: int = 50) -> List[Dict[str, Any]]:
        url = "https://www.reddit.com/search.json"
        params = {"q": keyword, "limit": limit, "sort": "new"}
        # Reddit strictly blocks generic browser User-Agents for API/JSON endpoints
        headers = {"User-Agent": "python:sociallistening:v1.0.0 (by /u/sociallistening)"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            logger.debug(f"Reddit crawler blocked or failed for '{keyword}'. Skipping Reddit. (Reason: {e})")
            return []

        children = (data.get("data") or {}).get("children") or []
        results = []
        for post in children:
            d = post.get("data") or {}
            interactions = (d.get("score") or 0) + (d.get("num_comments") or 0)
            results.append({
                "source": "reddit",
                "platform": "reddit",
                "source_type": "reddit",
                "author": d.get("author", "unknown"),
                "title": d.get("title"),
                "content": d.get("selftext") or d.get("title") or "",
                "url": f"https://www.reddit.com{d.get('permalink', '')}",
                "timestamp": datetime.fromtimestamp(d.get("created_utc", 0), tz=timezone.utc),
                "interactions": interactions,
                "reach_estimate": max(interactions * 5, 1),
                "platform_post_id": d.get("id"),
            })
        return results

    async def crawl_google_news(self, keyword: str) -> List[Dict[str, Any]]:
        encoded_kw = urllib.parse.quote(keyword)
        url = f"https://news.google.com/rss/search?q={encoded_kw}&hl=vi&gl=VN&ceid=VN:vi"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                response.raise_for_status()
                xml_data = response.text
        except Exception as e:
            logger.debug(f"Google News crawler failed for '{keyword}'. Reason: {e}")
            return []
            
        try:
            root = ET.fromstring(xml_data)
            items = root.findall('.//item')
            
            async def process_item(client, item):
                title = item.findtext('title', '')
                original_link = item.findtext('link', '')
                pubDate = item.findtext('pubDate', '')
                description = item.findtext('description', '')
                source = item.find('source')
                source_name = source.text if source is not None else 'Google News'
                source_url = source.attrib.get('url') if source is not None else None
                
                ts = datetime.now(timezone.utc)
                if pubDate:
                    try:
                        parsed_time = email.utils.parsedate_to_datetime(pubDate)
                        ts = parsed_time.astimezone(timezone.utc)
                    except Exception:
                        pass
                        
                clean_description = html.unescape(re.sub(r'<[^>]+>', '', description)) if description else ''
                clean_content = clean_description or title
                
                final_link = await self._resolve_news_url(client, original_link) if original_link else None
                link_resolution_failed = bool(original_link and is_google_news_discovery_url(original_link) and not final_link)
                
                domain = domain_from_url(final_link) or domain_from_url(source_url) or ""
                metadata = {"discovery_url": original_link}
                if link_resolution_failed:
                    metadata.update({
                        "link_resolution_failed": True,
                        "visit_url_invalid_reason": "Google News RSS discovery URL could not be resolved to the publisher article URL",
                    })
                        
                return {
                    "source": "google_news",
                    "platform": "news",
                    "source_type": "news",
                    "author": source_name,
                    "title": title,
                    "content": clean_content,
                    "url": final_link,
                    "original_url": original_link,
                    "canonical_url": final_link,
                    "domain": domain,
                    "metadata": metadata,
                    "timestamp": ts,
                    "interactions": 0,
                    "reach_estimate": 500,
                    "platform_post_id": None,
                }
            
            import asyncio
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as resolve_client:
                coros = [process_item(resolve_client, item) for item in items[:30]] # Limit to 30 to avoid hanging
                results = await asyncio.gather(*coros)
            
            return list(results)
        except Exception as e:
            logger.warning(f"Google News XML parse/resolve failed for '{keyword}'. Reason: {e}")
            return []

    async def crawl_news(self, keyword: str, limit: int = 50) -> List[Dict[str, Any]]:
        api_key = settings.NEWS_API_KEY or os.getenv("NEWS_API_KEY", "")
        if not api_key:
            logger.debug("News crawl skipped: NEWS_API_KEY not set")
            return []

        url = "https://newsapi.org/v2/everything"
        params = {"q": keyword, "pageSize": limit, "apiKey": api_key, "sortBy": "publishedAt"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        articles = data.get("articles") or []
        results = []
        for article in articles:
            published = article.get("publishedAt")
            ts = datetime.now(timezone.utc)
            if published:
                try:
                    ts = datetime.fromisoformat(published.replace("Z", "+00:00"))
                except ValueError:
                    pass
            results.append({
                "source": "news",
                "platform": "news",
                "source_type": "news",
                "author": article.get("author") or "Unknown",
                "title": article.get("title"),
                "content": article.get("description") or article.get("content") or article.get("title") or "",
                "url": article.get("url"),
                "timestamp": ts,
                "interactions": 0,
                "reach_estimate": 100,
                "platform_post_id": None,
            })
        return results

    async def crawl_keywords(
        self,
        keywords: List[str],
        platforms: Optional[List[str]] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        platforms = platforms or ["twitter", "reddit", "news", "google_news"]
        mentions: List[Dict[str, Any]] = []

        import asyncio
        tasks = []
        for keyword in keywords:
            for platform in platforms:
                if platform == "twitter":
                    tasks.append((platform, keyword, self.crawl_twitter(keyword, limit=limit)))
                elif platform == "reddit":
                    tasks.append((platform, keyword, self.crawl_reddit(keyword, limit=limit)))
                elif platform == "news":
                    tasks.append((platform, keyword, self.crawl_news(keyword, limit=limit)))
                elif platform == "google_news":
                    # Google News RSS limits aren't easily controlled via URL params here, it returns around 100 max
                    tasks.append((platform, keyword, self.crawl_google_news(keyword)))
                    
        if not tasks:
            return []

        coros = [t[2] for t in tasks]
        results = await asyncio.gather(*coros, return_exceptions=True)
        
        for (platform, keyword, _), batch in zip(tasks, results):
            if isinstance(batch, Exception):
                logger.error(f"Error crawling {platform} for '{keyword}': {batch}")
            elif batch:
                for m in batch:
                    m["keyword"] = keyword
                mentions.extend(batch)

        return mentions


social_crawler_service = SocialCrawlerService()
