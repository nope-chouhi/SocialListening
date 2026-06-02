"""
Social platform crawler: Twitter, Reddit, News API.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SocialCrawlerService:
    """Fetch mentions from Twitter, Reddit, and News APIs."""

    def __init__(self):
        self.timeout = 30.0
        self.user_agent = "SocialListeningBot/1.0"

    async def crawl_twitter(self, keyword: str) -> List[Dict[str, Any]]:
        token = settings.TWITTER_BEARER_TOKEN or os.getenv("TWITTER_BEARER_TOKEN", "")
        if not token:
            logger.info("Twitter crawl skipped: TWITTER_BEARER_TOKEN not set")
            return []

        url = "https://api.twitter.com/2/tweets/search/recent"
        params = {
            "query": keyword,
            "max_results": 50,
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

    async def crawl_reddit(self, keyword: str) -> List[Dict[str, Any]]:
        url = "https://www.reddit.com/search.json"
        params = {"q": keyword, "limit": 50, "sort": "new"}
        headers = {"User-Agent": self.user_agent}

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

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

    async def crawl_news(self, keyword: str) -> List[Dict[str, Any]]:
        api_key = settings.NEWS_API_KEY or os.getenv("NEWS_API_KEY", "")
        if not api_key:
            logger.info("News crawl skipped: NEWS_API_KEY not set")
            return []

        url = "https://newsapi.org/v2/everything"
        params = {"q": keyword, "pageSize": 50, "apiKey": api_key, "sortBy": "publishedAt"}

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
    ) -> List[Dict[str, Any]]:
        platforms = platforms or ["twitter", "reddit", "news"]
        mentions: List[Dict[str, Any]] = []

        for keyword in keywords:
            for platform in platforms:
                try:
                    if platform == "twitter":
                        batch = await self.crawl_twitter(keyword)
                    elif platform == "reddit":
                        batch = await self.crawl_reddit(keyword)
                    elif platform == "news":
                        batch = await self.crawl_news(keyword)
                    else:
                        continue
                    for m in batch:
                        m["keyword"] = keyword
                    mentions.extend(batch)
                except Exception as e:
                    logger.error(f"Error crawling {platform} for '{keyword}': {e}")

        return mentions


social_crawler_service = SocialCrawlerService()
