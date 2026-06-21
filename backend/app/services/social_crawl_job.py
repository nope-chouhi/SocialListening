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
from app.services.ai_service import analyze_mention
from app.services.notification_service import notify_high_risk_mention
from app.services.url_utils import clean_final_url, domain_from_url, is_google_news_discovery_url

logger = logging.getLogger(__name__)
crawler_service = CrawlerService()

DEFAULT_PLATFORMS = ["reddit", "news", "google_news"]  # twitter needs bearer token


def _risk_from_sentiment(sentiment: str, risk_score: float) -> float:
    # Use the real risk score provided by AI, fallback logic below
    return max(0.0, min(100.0, float(risk_score)))


def _persist_mentions(db, raw_mentions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Save new mentions and return list of created mention dicts for broadcast."""
    created = []
    success_count = 0
    error_count = 0
    errors = []

    for raw in raw_mentions:
        try:
            raw_url = raw.get("canonical_url") or raw.get("url")
            url = clean_final_url(raw_url)
            if not url:
                if is_google_news_discovery_url(raw.get("url") or raw.get("original_url")):
                    logger.info("[PERSIST] Skipped unresolved Google News discovery URL: %s", raw.get("url") or raw.get("original_url"))
                continue

            existing = db.execute(
                select(Mention).where(Mention.url == url).order_by(Mention.id.desc())
            ).scalars().first()
            if existing:
                continue

            content = raw.get("content") or raw.get("title") or ""
            if not content.strip():
                continue

            content_hash = crawler_service.calculate_content_hash(content)
            dup = db.execute(
                select(Mention).where(Mention.content_hash == content_hash).order_by(Mention.id.desc())
            ).scalars().first()
            if dup:
                continue

            text_for_ai = f"{raw.get('title') or ''} {content}".strip()
            
            try:
                analysis_result = analyze_mention(text_for_ai)
                simple_sentiment = analysis_result.get("sentiment", "neutral")
                confidence = float(analysis_result.get("confidence_score", 80.0))
                risk_score_raw = analysis_result.get("risk_score", 0.0)
                crisis_level = int(analysis_result.get("crisis_level", 1))
                summary_vi = analysis_result.get("summary_vi", content[:200])
                suggested_action = analysis_result.get("suggested_action", "monitor")
                responsible_department = analysis_result.get("responsible_department", "PR")
                ai_provider = analysis_result.get("ai_provider", "openai")
            except Exception as sentiment_error:
                logger.warning(f"[SENTIMENT] Failed for {url}: {sentiment_error}")
                # AI failed. Do not record neutral metrics. Let it remain unanalyzed.
                analysis_result = {}
                simple_sentiment = None
                confidence = None
                risk_score_raw = None
                crisis_level = None
                summary_vi = ""
                suggested_action = None
                responsible_department = None
                ai_provider = "failed"

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
                original_url=raw.get("original_url"),
                canonical_url=url,
                domain=domain_from_url(url),
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
                meta_data=raw.get("metadata", {}),
                verification_status="failed" if ai_provider == "failed" else "verified",
                verification_error="AI analysis failed" if ai_provider == "failed" else None
            )
            db.add(mention)
            db.flush()

            risk = 0.0
            if ai_provider != "failed":
                risk = _risk_from_sentiment(simple_sentiment, risk_score_raw)

                try:
                    sent_enum = SentimentScore(simple_sentiment) if simple_sentiment in [e.value for e in SentimentScore] else SentimentScore.NEUTRAL
                except ValueError:
                    sent_enum = SentimentScore.NEUTRAL

                analysis = AIAnalysis(
                    mention_id=mention.id,
                    sentiment=sent_enum,
                    risk_score=risk,
                    crisis_level=crisis_level,
                    summary_vi=summary_vi,
                    suggested_action=suggested_action,
                    responsible_department=responsible_department,
                    confidence_score=confidence,
                    ai_provider=ai_provider,
                    model_version="1.0",
                    processing_time_ms=0
                )
                db.add(analysis)
            db.flush()

            # Trigger notification if high risk or crisis
            if risk >= 80 or (crisis_level and crisis_level >= 4):
                try:
                    # Provide analysis result dictionary to avoid circular dependency / DB refresh issues inside notification
                    notify_high_risk_mention(db, mention.id, {
                        "risk_score": risk,
                        "crisis_level": crisis_level,
                        "sentiment": simple_sentiment,
                        "summary_vi": summary_vi,
                        "suggested_action": suggested_action
                    })
                except Exception as notify_err:
                    logger.error(f"Failed to notify high risk mention {mention.id}: {notify_err}")

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
            success_count += 1
            
        except Exception as item_error:
            db.rollback()
            error_count += 1
            errors.append({
                "url": raw.get("url", "unknown"),
                "error": str(item_error)
            })
            logger.error(f"[PERSIST] Failed item url={raw.get('url')}: {item_error}")
            continue

    try:
        if created:
            db.commit()
            logger.info(f"[PERSIST] Done: {success_count} inserted, {error_count} failed")
    except Exception as commit_error:
        db.rollback()
        logger.error(f"[PERSIST] Commit failed: {commit_error}")

    return success_count, error_count, errors, created


def run_social_crawl_sync():
    """Synchronous entry for APScheduler."""
    db = SessionLocal()
    try:
        from app.services.scheduler_service import scheduler_lock
        with scheduler_lock(db, 1002, "run_social_crawl_sync") as acquired:
            if not acquired:
                return

            keywords = db.execute(
                select(Keyword.keyword).where(Keyword.is_active == True)
            ).scalars().all()
            if not keywords:
                logger.info("[SocialCrawl] No active keywords")
                return

            keyword_list = list({k.strip() for k in keywords if k and k.strip()})[:20]
            platforms = DEFAULT_PLATFORMS.copy()
            from app.core.config import settings
            if settings.TWITTER_BEARER_TOKEN:
                platforms.insert(0, "twitter")

            logger.info(f"[SocialCrawl] Crawling {len(keyword_list)} keywords on {platforms}")

            raw = asyncio.run(social_crawler_service.crawl_keywords(keyword_list, platforms))
            if not raw:
                logger.warning("No active crawl provider configured or all providers failed/returned 0 results.")
                return

            success_count, error_count, errors, created = _persist_mentions(db, raw)
            logger.info(f"[SocialCrawl] {success_count} inserted, {error_count} failed from {len(raw)} fetched")

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

            # Update metrics
            try:
                from app.models.system_settings import WorkerStatus
                status = db.query(WorkerStatus).first()
                if status:
                    status.last_success_at = datetime.now(timezone.utc)
                    status.last_scan_count = (status.last_scan_count or 0) + success_count
                    db.commit()
            except:
                db.rollback()

    except Exception as e:
        logger.error(f"[SocialCrawl] Failed: {e}")
        db.rollback()
    finally:
        db.close()
