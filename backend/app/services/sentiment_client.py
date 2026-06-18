"""
Compatibility wrapper for sentiment analysis.
Uses real ai_service instead of HTTP calls to a dummy microservice.
"""
import logging
from typing import Dict
from app.services.ai_service import analyze_mention

logger = logging.getLogger(__name__)

async def analyze_sentiment_async(text: str) -> Dict:
    """Call AI sentiment service (async wrapper)."""
    return analyze_sentiment(text)

def analyze_sentiment(text: str) -> Dict:
    """Call AI sentiment service."""
    try:
        # Uses real AI provider configured in the system
        result = analyze_mention(content=text)
        return {
            "sentiment": result.get("sentiment", "neutral"),
            "score": result.get("risk_score", 0.0) / 100.0,
            "confidence": result.get("confidence_score", 0.0) / 100.0,
        }
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        raise ValueError(f"AI Provider error: {e}")

def map_to_ai_sentiment(simple: str) -> str:
    """Map positive/negative/neutral to platform sentiment enum values."""
    s = (simple or "neutral").lower()
    if s == "positive":
        return "positive"
    if s == "negative":
        return "negative_medium"
    return "neutral"
