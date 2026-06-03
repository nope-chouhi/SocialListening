import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from app.core.database import SessionLocal

def run_queries():
    db = SessionLocal()
    try:
        # 2. Check the mentions table RIGHT NOW
        count_all = db.execute(text("SELECT COUNT(*) FROM mentions;")).scalar()
        print(f"MENTION COUNT TOTAL: {count_all}")
        
        count_recent = db.execute(text("SELECT COUNT(*) FROM mentions WHERE created_at > NOW() - INTERVAL '7 days';")).scalar()
        print(f"RECENT MENTIONS (7 days): {count_recent}")
        
        # 3. Check scan jobs
        print("SCAN JOB STATUS:")
        jobs = db.execute(text("SELECT id, status, platform, keyword, created_at, error_message FROM scan_jobs ORDER BY created_at DESC LIMIT 10;")).fetchall()
        if not jobs:
            print("No scan jobs found.")
        for job in jobs:
            print(f"- Job {job[0]} ({job[2]} - {job[3]}): {job[1]} at {job[4]} | Error: {job[5]}")
            
    except Exception as e:
        print(f"Error running queries: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    run_queries()
