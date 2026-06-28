import logging
from typing import Dict
from app.services.ai_service import analyze_mention

logger = logging.getLogger(__name__)

def analyze_sentiment(text: str) -> dict:
    """
    Analyzes sentiment utilizing the centralized AI Service.
    Safe fallback to neutral if AI is unconfigured or fails.
    """
    try:
        result = analyze_mention(content=text)
        return {
            "sentiment": result.get("sentiment", "neutral"),
            "sentiment_score": result.get("risk_score", 50) / 100.0,
            "reason": result.get("summary_vi", "AI Analysis complete.")
        }
    except Exception as e:
        logger.warning(f"AI Sentiment Analysis failed or unconfigured, falling back to neutral: {e}")
        return {
            "sentiment": "neutral",
            "sentiment_score": 0.5,
            "reason": "AI Service unavailable or unconfigured."
        }
