"""
HTTP client for the Flask sentiment microservice.
"""
import logging
from typing import Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def analyze_sentiment_async(text: str) -> Dict:
    """Call AI sentiment service (async)."""
    url = f"{settings.SENTIMENT_SERVICE_URL.rstrip('/')}/api/ai/sentiment"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json={"text": text})
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.warning(f"Sentiment service error: {e}")
        return {"sentiment": "neutral", "score": 0, "confidence": 0}


def analyze_sentiment(text: str) -> Dict:
    """Call AI sentiment service (sync)."""
    url = f"{settings.SENTIMENT_SERVICE_URL.rstrip('/')}/api/ai/sentiment"
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json={"text": text})
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.warning(f"Sentiment service error: {e}")
        return {"sentiment": "neutral", "score": 0, "confidence": 0}


def map_to_ai_sentiment(simple: str) -> str:
    """Map positive/negative/neutral to platform sentiment enum values."""
    s = (simple or "neutral").lower()
    if s == "positive":
        return "positive"
    if s == "negative":
        return "negative_medium"
    return "neutral"
