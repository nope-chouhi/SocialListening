"""
Scheduled social platform crawl — runs every 5 minutes when scheduler is enabled.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.keyword import Keyword
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.services.crawler_service import CrawlerService
from app.services.social_crawler_service import social_crawler_service
from app.services.sentiment_client import analyze_sentiment, map_to_ai_sentiment

logger = logging.getLogger(__name__)
crawler_service = CrawlerService()

DEFAULT_PLATFORMS = ["reddit", "news"]  # twitter needs bearer token


def _risk_from_sentiment(sentiment: str, score: float) -> float:
    if sentiment == "negative":
        return min(95.0, 50 + score * 45)
    if sentiment == "positive":
        return max(5.0, 20 - score * 15)
    return 25.0


def _persist_mentions(db, raw_mentions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Save new mentions and return list of created mention dicts for broadcast."""
    created = []

    for raw in raw_mentions:
        url = raw.get("url")
        if not url:
            continue

        existing = db.execute(
            select(Mention).where(Mention.url == url)
        ).scalar_one_or_none()
        if existing:
            continue

        content = raw.get("content") or raw.get("title") or ""
        if not content.strip():
            continue

        content_hash = crawler_service.calculate_content_hash(content)
        dup = db.execute(
            select(Mention).where(Mention.content_hash == content_hash)
        ).scalar_one_or_none()
        if dup:
            continue

        text_for_ai = f"{raw.get('title') or ''} {content}".strip()
        sentiment_result = analyze_sentiment(text_for_ai)
        simple_sentiment = sentiment_result.get("sentiment", "neutral")
        ai_sentiment = map_to_ai_sentiment(simple_sentiment)
        confidence = float(sentiment_result.get("confidence", 0) or 0) * 100

        interactions = int(raw.get("interactions") or 0)
        reach = int(raw.get("reach_estimate") or interactions * 5 or 0)

        mention = Mention(
            keyword_text=raw.get("keyword"),
            source_type=raw.get("source_type"),
            platform=raw.get("platform"),
            title=raw.get("title"),
            content=content,
            content_hash=content_hash,
            url=url,
            author=raw.get("author"),
            published_at=raw.get("timestamp"),
            collected_at=datetime.now(timezone.utc),
            sentiment=simple_sentiment,
            sentiment_confidence=confidence,
            reach_estimate=reach,
            likes_count=interactions,
            influence_score=float(interactions),
            platform_post_id=raw.get("platform_post_id"),
            extraction_source="social_crawler",
            matched_keywords=[{"keyword": raw.get("keyword")}] if raw.get("keyword") else None,
        )
        db.add(mention)
        db.flush()

        risk = _risk_from_sentiment(simple_sentiment, float(sentiment_result.get("score", 0) or 0))
        crisis = 4 if simple_sentiment == "negative" and risk >= 70 else (2 if simple_sentiment == "negative" else 1)

        try:
            sent_enum = SentimentScore(ai_sentiment) if ai_sentiment in [e.value for e in SentimentScore] else SentimentScore.NEUTRAL
        except ValueError:
            sent_enum = SentimentScore.NEUTRAL

        analysis = AIAnalysis(
            mention_id=mention.id,
            sentiment=sent_enum,
            risk_score=risk,
            crisis_level=crisis,
            summary_vi=content[:200],
            suggested_action="monitor" if risk < 60 else "respond",
            responsible_department="PR",
            confidence_score=confidence,
            ai_provider="distilbert-sentiment",
            model_version="distilbert-sst-2",
            processing_time_ms=0,
        )
        db.add(analysis)

        created.append({
            "id": mention.id,
            "author": mention.author,
            "content": (mention.content or "")[:300],
            "platform": mention.platform,
            "source_type": mention.source_type,
            "sentiment": simple_sentiment,
            "reach": reach,
            "interactions": interactions,
            "timestamp": mention.collected_at.isoformat() if mention.collected_at else None,
            "url": mention.url,
        })

    if created:
        db.commit()
    return created


def run_social_crawl_sync():
    """Synchronous entry for APScheduler."""
    db = SessionLocal()
    try:
        keywords = db.execute(
            select(Keyword).where(Keyword.is_active == True)
        ).scalars().all()
        if not keywords:
            logger.info("[SocialCrawl] No active keywords")
            return

        keyword_list = list({k.keyword.strip() for k in keywords if k.keyword and k.keyword.strip()})[:20]
        platforms = DEFAULT_PLATFORMS.copy()
        from app.core.config import settings
        if settings.TWITTER_BEARER_TOKEN:
            platforms.insert(0, "twitter")

        logger.info(f"[SocialCrawl] Crawling {len(keyword_list)} keywords on {platforms}")

        raw = asyncio.run(social_crawler_service.crawl_keywords(keyword_list, platforms))
        created = _persist_mentions(db, raw)
        logger.info(f"[SocialCrawl] {len(created)} new mentions from {len(raw)} fetched")

        if created:
            try:
                from app.services.realtime_manager import realtime_manager
                loop = asyncio.new_event_loop()
                for item in created:
                    loop.run_until_complete(
                        realtime_manager.broadcast("new-mention", item)
                    )
                loop.close()
            except Exception as e:
                logger.warning(f"[SocialCrawl] WebSocket broadcast failed: {e}")

    except Exception as e:
        logger.error(f"[SocialCrawl] Failed: {e}")
        db.rollback()
    finally:
        db.close()
