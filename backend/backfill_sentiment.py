import sys
import os

# Add the backend to the python path
backend_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.core.database import SessionLocal
from app.models.mention import Mention, AIAnalysis

from sqlalchemy import text

def backfill():
    db = SessionLocal()
    try:
        # Standardize old negative values using raw SQL to bypass SQLAlchemy Enum validation
        
        # Update mentions table
        db.execute(text("UPDATE mentions SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        
        # Update ai_analysis table
        db.execute(text("UPDATE ai_analysis SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        
        # Fill missing Mention.sentiment from AIAnalysis if exists
        db.execute(text("""
            UPDATE mentions
            SET sentiment = (
                SELECT sentiment FROM ai_analysis 
                WHERE ai_analysis.mention_id = mentions.id
                LIMIT 1
            )
            WHERE sentiment IS NULL OR sentiment = ''
        """))
        
        # Default remaining nulls to neutral
        db.execute(text("UPDATE mentions SET sentiment = 'neutral' WHERE sentiment IS NULL OR sentiment = ''"))
        
        db.commit()
        print("Successfully backfilled sentiment values via raw SQL.")
    except Exception as e:
        db.rollback()
        print(f"Error backfilling: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
