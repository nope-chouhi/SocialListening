import logging
from app.services.ai_service import analyze_mention

logger = logging.getLogger(__name__)

def analyze_sentiment(text: str) -> dict:
    """
    Routes sentiment analysis to the central AI service.
    Returns format expected by legacy callers.
    """
    result = analyze_mention(content=text)
    
    # Map central AI response to legacy schema
    return {
        "sentiment": result.get("sentiment", "neutral"),
        "sentiment_score": result.get("confidence_score", 0) / 100.0,
        "reason": f"AI Status: {result.get('status', 'success')}"
    }
