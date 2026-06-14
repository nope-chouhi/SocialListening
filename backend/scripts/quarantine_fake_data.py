import os
import sys
from datetime import datetime, timezone

# Add backend directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.mention import Mention
from sqlalchemy import select, update

def is_synthetic_domain(domain: str) -> bool:
    if not domain:
        return True
    domain_lower = domain.lower()
    synthetic_domains = ["news.com", "example.com", "test.com", "placeholder.com"]
    return domain_lower in synthetic_domains or "localhost" in domain_lower or "127.0.0.1" in domain_lower

def run_quarantine():
    print("Starting quarantine of fake data...")
    db = SessionLocal()
    try:
        # We will fetch all mentions and check them
        mentions = db.execute(select(Mention)).scalars().all()
        quarantined_count = 0
        reliable_count = 0
        
        for m in mentions:
            original_status = m.verification_status
            
            # Check domain
            if is_synthetic_domain(m.domain):
                m.verification_status = "synthetic"
                m.verification_error = "Quarantined placeholder data"
            elif m.url is None or m.url.strip() == "":
                m.verification_status = "synthetic"
                m.verification_error = "Missing URL"
            elif m.verification_status == "synthetic" and not is_synthetic_domain(m.domain):
                # If it was marked synthetic but it's a real domain (e.g. from SerpAPI but we couldn't fetch)
                # It should be reliable or verified. We'll set it to reliable if it doesn't have full content
                if not m.content or len(m.content) < 500: # heuristic
                    m.verification_status = "reliable"
                    m.verification_error = "Could not fetch original page content"
                else:
                    m.verification_status = "verified"
                    m.verification_error = None
            
            if m.verification_status == "synthetic" and original_status != "synthetic":
                quarantined_count += 1
            elif m.verification_status == "reliable" and original_status == "synthetic":
                reliable_count += 1
        
        db.commit()
        print(f"Quarantine complete. Quarantined {quarantined_count} fake mentions.")
        print(f"Restored {reliable_count} mentions to reliable/verified.")
    except Exception as e:
        db.rollback()
        print(f"Error during quarantine: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_quarantine()
