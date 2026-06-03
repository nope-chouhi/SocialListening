import hashlib
import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel

class ManualScanRequest(BaseModel):
    keyword_group_ids: Optional[List[int]] = []
    keywords: Optional[List[str]] = []
    source_ids: Optional[List[int]] = []
    url: Optional[str] = None
    mode: Optional[str] = "HYBRID"
    project_id: Optional[int] = None
    max_results: Optional[int] = 50

def run_manual_scan_task(job_id: int, project_id: int, keyword_texts: List[str], mode: str, max_results: int):
    from app.core.database import SessionLocal
    from app.models.crawl import CrawlJob, CrawlJobStatus
    from app.models.mention import Mention
    from app.core.config import settings
    
    db = SessionLocal()
    try:
        job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
        if not job: return
        
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        summary = {
            "adapters_ready": [],
            "serpapi_result_count": 0,
            "urls_crawled": 0,
            "new_mentions_created": 0,
            "duplicates_skipped": 0,
            "old_mentions_existing": 0,
            "errors": []
        }

        run_discovery = mode in ("AUTO_DISCOVERY", "HYBRID")
        results = []
        
        if run_discovery:
            # Web Search (SerpAPI)
            if settings.SERPAPI_API_KEY:
                summary["adapters_ready"].append("web")
                try:
                    from app.services.serpapi_provider import search
                    serp_results = search(
                        keywords=keyword_texts,
                        language="vi", country="vn",
                        limit=max_results, date_range="last_30_days"
                    )
                    summary["serpapi_result_count"] += len(serp_results)
                    for r in serp_results:
                        results.append({
                            "url": r["url"],
                            "title": r.get("title", ""),
                            "snippet": r.get("snippet", ""),
                            "source_type": "web",
                            "platform": "google"
                        })
                except Exception as e:
                    summary["errors"].append(f"SerpAPI: {e}")

            # YouTube (if configured)
            from app.services.connectors.youtube_connector import YouTubeConnector
            yt = YouTubeConnector()
            if yt.validate_config():
                summary["adapters_ready"].append("youtube")
                try:
                    yt_res = yt.search_keywords(keywords=keyword_texts, max_results=10)
                    for r in yt_res:
                        results.append({
                            "url": r["url"],
                            "title": r.get("title", ""),
                            "snippet": r.get("content", ""),
                            "source_type": "video",
                            "platform": "youtube"
                        })
                except Exception as e:
                    summary["errors"].append(f"YouTube: {e}")

        # Deduplication and Insertion
        for res in results:
            url = res["url"].lower().strip()
            summary["urls_crawled"] += 1
            
            content_hash = hashlib.sha256(f"{url}_{res['title']}".encode()).hexdigest()
            
            # Check duplication in this project
            existing = db.execute(
                select(Mention).where(
                    Mention.project_id == project_id,
                    Mention.url == url
                )
            ).scalar_one_or_none()
            
            if existing:
                summary["duplicates_skipped"] += 1
                summary["old_mentions_existing"] += 1
                continue
                
            # Create NEW mention
            try:
                mention = Mention(
                    project_id=project_id,
                    job_id=job_id,
                    keyword_text=keyword_texts[0] if keyword_texts else "",
                    source_type=res["source_type"],
                    platform=res["platform"],
                    domain=url.split("/")[2] if "//" in url else url.split("/")[0],
                    title=res["title"][:500],
                    snippet=res["snippet"][:1000],
                    content=res["snippet"][:10000],
                    url=url,
                    content_hash=content_hash,
                    collected_at=datetime.now(timezone.utc),
                    is_reviewed=False
                )
                db.add(mention)
                summary["new_mentions_created"] += 1
            except Exception as e:
                summary["errors"].append(f"DB Insert error: {e}")

        db.commit()

        job.status = CrawlJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.meta_data = {"summary": summary}
        job.mentions_found = summary["new_mentions_created"]
        db.commit()
    except Exception as e:
        if 'job' in locals() and job:
            job.status = CrawlJobStatus.FAILED
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()
