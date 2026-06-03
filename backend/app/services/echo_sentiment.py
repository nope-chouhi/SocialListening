import os
import random

# Future integration hook
AI_API_KEY = os.getenv("AI_API_KEY", "")

def analyze_sentiment(text: str) -> dict:
    """
    Default deterministic rule-based approach for MVP.
    Ready for future LLM integration using AI_API_KEY.
    """
    if AI_API_KEY and False:
        # Placeholder for Gemini/OpenAI integration
        pass

    text_lower = text.lower()
    
    positive_words = ['great', 'awesome', 'good', 'love', 'amazing', 'best', 'excellent', 'happy', 'cool', 'fantastic']
    negative_words = ['bad', 'terrible', 'worst', 'hate', 'awful', 'sucks', 'stupid', 'garbage', 'broken', 'sad']
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count:
        sentiment = 'positive'
        sentiment_score = 0.6 + min(pos_count * 0.1, 0.4)
        reason = f"Found {pos_count} positive keywords"
    elif neg_count > pos_count:
        sentiment = 'negative'
        sentiment_score = max(0.0, 0.4 - min(neg_count * 0.1, 0.4))
        reason = f"Found {neg_count} negative keywords"
    else:
        # Default to neutral with a slight random variation
        sentiment = 'neutral'
        sentiment_score = 0.5 + random.uniform(-0.05, 0.05)
        reason = "Balanced or no clear sentiment keywords"
        
    return {
        "sentiment": sentiment,
        "sentiment_score": round(sentiment_score, 2),
        "reason": reason
    }
