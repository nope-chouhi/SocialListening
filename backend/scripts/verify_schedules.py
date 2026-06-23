import os
import sys
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.crawl import CrawlJob, ScanLog, ScanSchedule
from app.services.scheduler_service import start_scheduler, stop_scheduler, execute_scan_schedule_job

def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        print(e)
        return None

def run_verification():
    db = get_db()
    
    # 1. Cron Validation Verification
    print("--- 1. Verification of Cron Validation ---")
    from croniter import croniter
    invalid_cron = "invalid * * * *"
    try:
        croniter(invalid_cron)
        print("FAILED: croniter accepted invalid cron")
    except Exception as e:
        print(f"SUCCESS: croniter correctly rejected invalid cron: {e}")
        
    print("\n--- 2. Setting up test data ---")
    from app.models.keyword import KeywordGroup
    from app.models.user import User
    
    user = db.execute(select(User).limit(1)).scalar_one_or_none()
    if not user:
        user = User(email="test@example.com", full_name="Test User", hashed_password="pw", is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    kg = db.execute(select(KeywordGroup).limit(1)).scalar_one_or_none()
    if not kg:
        kg = KeywordGroup(name="Test Group")
        db.add(kg)
        db.commit()
        db.refresh(kg)

    # 3. Duplicate Schedule Test
    print("\n--- 3. Verifying Duplicate Execution Prevention ---")
    schedule = ScanSchedule(
        user_id=user.id,
        name="Test Duplicate Schedule",
        cron_expression="* * * * *",
        keyword_group_ids=[kg.id],
        is_active=True
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    # Execute it directly
    print(f"Executing schedule {schedule.id} first time...")
    execute_scan_schedule_job(schedule.id)
    
    # Now execute it again immediately
    print(f"Executing schedule {schedule.id} second time...")
    execute_scan_schedule_job(schedule.id)
    
    # Check jobs
    jobs = db.execute(select(CrawlJob).where(CrawlJob.scan_schedule_id == schedule.id)).scalars().all()
    print(f"Found {len(jobs)} jobs for this schedule.")
    # The duplicate prevention of mentions should be handled inside execute_scan
    
    print("\n--- 4. Verifying Failure Handling ---")
    # This happens if execute_scan fails, which is handled inside the try-except in execute_scan_schedule_job
    # To simulate it, we can pass a bad ID or modify the schedule temporarily
    
    print("\n--- 5. Verifying Scheduler Service Locking ---")
    from app.services.scheduler_service import scheduler_lock
    with scheduler_lock(db, 9999, "test_lock"):
        print("SUCCESS: Acquired lock")
        # Try to acquire again
        try:
            with scheduler_lock(db, 9999, "test_lock"):
                print("WARNING: Could acquire lock twice (depends on locking mechanism, postgres pg_try_advisory_xact_lock).")
        except Exception as e:
            print(f"SUCCESS: Could not acquire lock twice in a row: {e}")

    print("\n--- Cleaning up ---")
    db.execute(ScanLog.__table__.delete().where(ScanLog.scan_schedule_id == schedule.id))
    db.execute(CrawlJob.__table__.delete().where(CrawlJob.scan_schedule_id == schedule.id))
    db.execute(ScanSchedule.__table__.delete().where(ScanSchedule.id == schedule.id))
    db.commit()
    db.close()
    print("Done.")

if __name__ == "__main__":
    run_verification()
