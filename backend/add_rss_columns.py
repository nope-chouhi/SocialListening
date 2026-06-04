import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nope.db")
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Add to sources
    try:
        conn.execute(text("ALTER TABLE sources ADD COLUMN platform VARCHAR(100)"))
        print("Added platform to sources")
    except Exception as e:
        print("platform already exists or error:", e)
        
    try:
        conn.execute(text("ALTER TABLE sources ADD COLUMN category VARCHAR(100)"))
        print("Added category to sources")
    except Exception as e:
        print("category already exists or error:", e)
        
    try:
        conn.execute(text("ALTER TABLE sources ADD COLUMN domain VARCHAR(500)"))
        print("Added domain to sources")
    except Exception as e:
        print("domain already exists or error:", e)

    # Add to source_items
    try:
        conn.execute(text("ALTER TABLE source_items ADD COLUMN guid VARCHAR(500)"))
        print("Added guid to source_items")
    except Exception as e:
        print("guid already exists or error:", e)
        
    try:
        conn.execute(text("ALTER TABLE source_items ADD COLUMN image_url TEXT"))
        print("Added image_url to source_items")
    except Exception as e:
        print("image_url already exists or error:", e)
        
    try:
        conn.execute(text("ALTER TABLE source_items ADD COLUMN media_url TEXT"))
        print("Added media_url to source_items")
    except Exception as e:
        print("media_url already exists or error:", e)
        
    try:
        conn.execute(text("ALTER TABLE source_items ADD COLUMN media_thumbnail TEXT"))
        print("Added media_thumbnail to source_items")
    except Exception as e:
        print("media_thumbnail already exists or error:", e)
        
print("Migration completed.")
