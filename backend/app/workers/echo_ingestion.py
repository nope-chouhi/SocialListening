import logging
import random
from datetime import datetime
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import SessionLocal
from app.models.echomind import EchoKeyword, EchoMention
from app.services.echo_sentiment import analyze_sentiment

logger = logging.getLogger(__name__)

def generate_mock_mentions():
    """Generates mock mentions for all active keywords."""
    db = SessionLocal()
    try:
        keywords = db.query(EchoKeyword).all()
        if not keywords:
            return

        sources = ['X', 'Reddit', 'Blog']
        templates = [
            "Just got my hands on the new {kw}, and it's absolutely amazing!",
            "I'm having terrible issues with {kw}. Worst experience ever.",
            "Can someone help me figure out how to use {kw}?",
            "{kw} just released a new update. It's okay, nothing special.",
            "I love the design of {kw}, great work team!",
            "Why is {kw} so broken today? Very frustrating.",
            "Thinking about trying {kw}, any thoughts?",
            "Just wrote a blog post about my journey with {kw}. Check it out!"
        ]

        # Generate 1-3 mentions per cycle randomly
        num_mentions = random.randint(1, 3)
        
        for _ in range(num_mentions):
            kw = random.choice(keywords).keyword
            source = random.choice(sources)
            content = random.choice(templates).format(kw=kw)
            
            # Use sentiment engine
            sentiment_result = analyze_sentiment(content)
            
            new_mention = EchoMention(
                keyword=kw,
                source=source,
                content=content,
                author=f"User{random.randint(1000, 9999)}",
                sentiment=sentiment_result['sentiment'],
                sentiment_score=sentiment_result['sentiment_score']
            )
            db.add(new_mention)
        
        db.commit()
        logger.info(f"EchoMind Worker: Generated {num_mentions} mock mentions.")
    except Exception as e:
        logger.error(f"EchoMind Worker Error: {e}")
    finally:
        db.close()

def register_echo_ingestion(scheduler):
    """Registers the 30-second ingestion job."""
    scheduler.add_job(
        generate_mock_mentions,
        IntervalTrigger(seconds=30),
        id='echo_mock_ingestion',
        name='EchoMind Mock Ingestion',
        replace_existing=True
    )
    logger.info("EchoMind Ingestion Worker registered.")
