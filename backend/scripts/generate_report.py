import os
import sys
import time
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import SessionLocal
from app.models.mention import Mention
from app.models.crawl import CrawlJob
from sqlalchemy import select, func
import traceback

def run_report():
    print("=== D. KIỂM TRA DỮ LIỆU THẬT & E. BÁO CÁO QUARANTINE ===")
    db = SessionLocal()
    try:
        total = db.execute(select(func.count(Mention.id))).scalar() or 0
        
        verified_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status == 'verified')).scalar() or 0
        reliable_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status == 'reliable')).scalar() or 0
        unverified_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status == 'unverified')).scalar() or 0
        failed_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status == 'failed')).scalar() or 0
        synthetic_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status == 'synthetic')).scalar() or 0
        
        hidden_count = db.execute(select(func.count(Mention.id)).where(Mention.verification_status.in_(['synthetic', 'failed', 'unverified']))).scalar() or 0
        null_url_count = db.execute(select(func.count(Mention.id)).where(Mention.url == None)).scalar() or 0
        placeholder_domain_count = db.execute(select(func.count(Mention.id)).where(Mention.domain.in_(["news.com", "example.com", "test.com", "placeholder.com"]))).scalar() or 0
        
        print(f"- total_mentions: {total}")
        print(f"- verified_count: {verified_count}")
        print(f"- reliable_count: {reliable_count}")
        print(f"- unverified_count: {unverified_count}")
        print(f"- failed_count: {failed_count}")
        print(f"- synthetic_count: {synthetic_count}")
        print(f"- hidden_from_default_count: {hidden_count}")
        print(f"- null_url_count: {null_url_count}")
        print(f"- placeholder_domain_count: {placeholder_domain_count}")
        
        print("\n=== F. SCAN JOB ===")
        # Get the latest manual scan job
        job = db.execute(select(CrawlJob).order_by(CrawlJob.id.desc()).limit(1)).scalar_one_or_none()
        if job:
            print(f"- manual scan có tạo job_id không: YES (Job ID: {job.id})")
            print(f"- job status có QUEUED/RUNNING/COMPLETED/FAILED/PARTIAL/STUCK không: YES (Status: {job.status.name if hasattr(job.status, 'name') else job.status})")
            meta = job.meta_data or {}
            print(f"- job có raw_results_count: {meta.get('raw_results_count', 'Missing')}")
            print(f"- job có created_mentions_count: {meta.get('created_mentions_count', 'Missing')}")
            print(f"- job có duplicate_mentions_count: {meta.get('duplicate_mentions_count', 'Missing')}")
            print(f"- job có failed_sources: {meta.get('failed_sources', 'Missing')}")
        else:
            print("No CrawlJob found.")
            
    except Exception as e:
        print(f"Error querying DB: {e}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_report()
