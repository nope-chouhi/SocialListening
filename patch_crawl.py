import re

with open('backend/app/api/crawl.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace run_manual_scan_task
new_task_code = """
def run_manual_scan_task(job_id: int, project_id: int, keyword_texts: List[str], mode: str, max_results: int):
    from app.core.database import SessionLocal
    from app.models.crawl import CrawlJob, CrawlJobStatus
    from app.models.mention import Mention
    from app.core.config import settings
    import hashlib
    
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
                            "platform": "google",
                            "published_at": None,
                            "author": ""
                        })
                except Exception as e:
                    summary["errors"].append(f"SerpAPI: {e}")

            # YouTube (if configured)
            try:
                from app.services.connectors.youtube_connector import YouTubeConnector
                yt = YouTubeConnector()
                if yt.validate_config():
                    summary["adapters_ready"].append("youtube")
                    yt_res = yt.search_keywords(keywords=keyword_texts, max_results=10)
                    for r in yt_res:
                        results.append({
                            "url": r["url"],
                            "title": r.get("title", ""),
                            "snippet": r.get("content", ""),
                            "source_type": "video",
                            "platform": "youtube",
                            "published_at": r.get("published_at"),
                            "author": r.get("author", "")
                        })
            except Exception as e:
                pass

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
                    title=res["title"][:500] if res["title"] else None,
                    snippet=res["snippet"][:1000] if res["snippet"] else None,
                    content=res["snippet"][:10000] if res["snippet"] else None,
                    url=url,
                    content_hash=content_hash,
                    collected_at=datetime.now(timezone.utc),
                    is_reviewed=False,
                    author=res.get("author", "")[:500],
                    published_at=res.get("published_at")
                )
                db.add(mention)
                db.flush()
                summary["new_mentions_created"] += 1
            except Exception as e:
                summary["errors"].append(f"DB Insert error: {e}")

        db.commit()

        job.status = CrawlJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
        job.mentions_found = summary["new_mentions_created"]
        db.commit()
    except Exception as e:
        if 'job' in locals() and job:
            job.status = CrawlJobStatus.FAILED
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()
"""

new_manual_scan_code = """
@router.post("/manual-scan")
def manual_scan(
    body: ManualScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    \"\"\"
    Manual scan: Live pipeline for API adapters.
    \"\"\"
    keyword_texts = []
    if body.keywords:
        for kw in body.keywords:
            kw_lower = kw.lower().strip()
            if kw_lower and kw_lower not in keyword_texts:
                keyword_texts.append(kw_lower)

    if not keyword_texts:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp ít nhất một từ khóa (qua keywords)")

    mode = getattr(body, "mode", "HYBRID") or "HYBRID"
    project_id = body.project_id
    max_results = body.max_results or 50

    job = CrawlJob(
        job_type='manual',
        status=CrawlJobStatus.PENDING,
        total_sources=0,
        processed_sources=0,
        mentions_found=0,
        started_at=datetime.now(timezone.utc),
        meta_data={"project_id": project_id, "mode": mode, "keywords": keyword_texts}
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_manual_scan_task, job.id, project_id, keyword_texts, mode, max_results)

    return {
        "job_id": job.id,
        "status": "QUEUED",
        "mode": mode,
        "project_id": project_id,
        "keywords": keyword_texts
    }
"""

new_get_job_code = """
@router.get("/jobs/{job_id}")
def get_crawl_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    meta = job.meta_data or {}
    
    return {
        "job_id": job.id,
        "status": job.status.value if hasattr(job.status, 'value') else job.status,
        "project_id": meta.get("project_id"),
        "keywords": meta.get("keywords", []),
        "summary": meta.get("summary", {})
    }
"""

# Apply the regex substitution safely
content = re.sub(
    r'@router\.post\("/manual-scan"\).*?def crawl_source\(',
    new_manual_scan_code + "\n" + new_task_code + "\ndef crawl_source(",
    content,
    flags=re.DOTALL
)

# Insert get_crawl_job after get_crawl_jobs route
content = re.sub(
    r'(@router\.post\("/jobs/\{job_id\}/retry"\))',
    new_get_job_code + "\n" + r'\1',
    content
)

with open('backend/app/api/crawl.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated backend/app/api/crawl.py")
