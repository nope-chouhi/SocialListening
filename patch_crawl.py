import re

with open("backend/app/api/crawl.py", "r", encoding="utf-8") as f:
    content = f.read()

# We need to replace the entire `def run_manual_scan_task(...):` function.
# It ends right before `def crawl_source(`

new_func = """def run_manual_scan_task(job_id: int, project_id: int, keyword_texts: List[str], mode: str, max_results: int):
    from app.core.database import SessionLocal
    from app.models.crawl import CrawlJob, CrawlJobStatus
    from app.models.mention import Mention
    from app.core.config import settings
    import hashlib
    import time
    from urllib.parse import urlparse
    
    db = SessionLocal()
    start_time = time.time()
    
    try:
        job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
        if not job: return
        
        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        
        # Check environment capabilities
        has_serpapi = bool(settings.SERPAPI_API_KEY)
        is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
        auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
        auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
        web_ready = has_serpapi and is_serpapi_provider and auto_discovery
        has_youtube = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
        
        summary = {
            "web": {
                "status": "READY" if web_ready else ("SKIPPED" if not is_serpapi_provider else "CONFIG_REQUIRED"),
                "called": False,
                "provider": getattr(settings, "WEB_SEARCH_PROVIDER", "none"),
                "raw_results_count": 0,
                "results_after_keyword_match": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not web_ready else None
            },
            "youtube": {
                "status": "READY" if has_youtube else "CONFIG_REQUIRED",
                "called": False,
                "raw_results_count": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not has_youtube else None
            },
            "adapters_ready": [],
            "serpapi_result_count": 0,
            "urls_crawled": 0,
            "new_mentions_created": 0,
            "duplicates_skipped": 0,
            "old_mentions_existing": 0,
            "errors": []
        }
        
        job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
        db.commit()

        run_discovery = True # Always run discovery if mode is anything (we force web adapter to run when configured)
        
        def commit_summary():
            db.commit()
            
        def is_timeout():
            return (time.time() - start_time) > 120

        # -------------- WEB ADAPTER --------------
        if web_ready:
            summary["adapters_ready"].append("web")
            summary["web"]["called"] = True
            summary["web"]["status"] = "RUNNING"
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
            try:
                if is_timeout():
                    raise TimeoutError("Scan timeout reached before Web Search")
                
                from app.services.serpapi_provider import search
                serp_results = search(
                    keywords=keyword_texts,
                    language="vi", country="vn",
                    limit=max_results, date_range="last_30_days"
                )
                summary["serpapi_result_count"] += len(serp_results)
                summary["web"]["raw_results_count"] += len(serp_results)
                
                # INSERT IMMEDIATELY
                for r in serp_results:
                    url = r.get("url", "").lower().strip()
                    if not url: continue
                    title = r.get("title", "")
                    snippet = r.get("snippet", "")
                    
                    # Verify keyword match
                    matched = False
                    matched_kw = ""
                    search_text = (title + " " + snippet + " " + url).lower()
                    for kw in keyword_texts:
                        if kw.lower() in search_text:
                            matched = True
                            matched_kw = kw
                            break
                    if not matched: continue
                    
                    summary["web"]["results_after_keyword_match"] += 1
                    content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                    
                    existing = db.execute(select(Mention).where(Mention.project_id == project_id, Mention.url == url)).scalar_one_or_none()
                    if existing:
                        summary["web"]["duplicates_skipped"] += 1
                        summary["duplicates_skipped"] += 1
                        summary["old_mentions_existing"] += 1
                        continue
                        
                    parsed_domain = urlparse(url).netloc
                    
                    mention = Mention(
                        project_id=project_id,
                        job_id=job_id,
                        keyword_text=matched_kw,
                        source_type="web",
                        platform="web",
                        domain=parsed_domain,
                        title=title[:500] if title else None,
                        snippet=snippet[:1000] if snippet else None,
                        content=snippet[:10000] if snippet else None,
                        url=url,
                        content_hash=content_hash,
                        collected_at=datetime.now(timezone.utc),
                        is_reviewed=False,
                        author="",
                        published_at=None
                    )
                    db.add(mention)
                    summary["web"]["mentions_created"] += 1
                    summary["new_mentions_created"] += 1
                db.flush()
                summary["web"]["status"] = "COMPLETED"
            except Exception as e:
                summary["errors"].append(f"WebSearch: {e}")
                summary["web"]["error"] = str(e)
                summary["web"]["status"] = "ERROR"
            
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
        # -------------- YOUTUBE ADAPTER --------------
        if has_youtube:
            summary["adapters_ready"].append("youtube")
            summary["youtube"]["called"] = True
            summary["youtube"]["status"] = "RUNNING"
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()
            
            try:
                if is_timeout():
                    raise TimeoutError("Scan timeout reached before YouTube")
                    
                from app.services.connectors.youtube_connector import YouTubeConnector
                yt = YouTubeConnector()
                if yt.validate_config():
                    yt_res = yt.search_keywords(keywords=keyword_texts, max_results=10)
                    summary["youtube"]["raw_results_count"] += len(yt_res)
                    
                    for r in yt_res:
                        url = r.get("url", "").lower().strip()
                        if not url: continue
                        title = r.get("title", "")
                        snippet = r.get("content", "")
                        
                        matched = False
                        matched_kw = ""
                        search_text = (title + " " + snippet + " " + url).lower()
                        for kw in keyword_texts:
                            if kw.lower() in search_text:
                                matched = True
                                matched_kw = kw
                                break
                        if not matched: continue
                        
                        content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                        
                        existing = db.execute(select(Mention).where(Mention.project_id == project_id, Mention.url == url)).scalar_one_or_none()
                        if existing:
                            summary["youtube"]["duplicates_skipped"] += 1
                            summary["duplicates_skipped"] += 1
                            summary["old_mentions_existing"] += 1
                            continue
                            
                        mention = Mention(
                            project_id=project_id,
                            job_id=job_id,
                            keyword_text=matched_kw,
                            source_type="video",
                            platform="youtube",
                            domain="youtube.com",
                            title=title[:500] if title else None,
                            snippet=snippet[:1000] if snippet else None,
                            content=snippet[:10000] if snippet else None,
                            url=url,
                            content_hash=content_hash,
                            collected_at=datetime.now(timezone.utc),
                            is_reviewed=False,
                            author=r.get("author", "")[:500],
                            published_at=r.get("published_at")
                        )
                        db.add(mention)
                        summary["youtube"]["mentions_created"] += 1
                        summary["new_mentions_created"] += 1
                    db.flush()
                summary["youtube"]["status"] = "COMPLETED"
            except Exception as e:
                summary["errors"].append(f"YouTube: {e}")
                summary["youtube"]["error"] = str(e)
                summary["youtube"]["status"] = "ERROR"
                
            job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
            commit_summary()

        db.commit()

        job.completed_at = datetime.now(timezone.utc)
        job.meta_data = {"summary": summary, "project_id": project_id, "keywords": keyword_texts}
        job.mentions_found = summary["new_mentions_created"]
        
        # Determine final status
        if is_timeout():
            job.status = CrawlJobStatus.TIMEOUT
            job.error_message = "Scan timeout: adapters did not complete within 120 seconds."
        elif len(summary["errors"]) > 0 and len(summary["adapters_ready"]) > 0 and len(summary["errors"]) == len(summary["adapters_ready"]):
            job.status = CrawlJobStatus.FAILED
            job.error_message = "All adapters failed: " + "; ".join(summary["errors"])
        elif len(summary["errors"]) > 0:
            job.status = CrawlJobStatus.PARTIAL_FAILED
        elif summary["new_mentions_created"] == 0 and summary["duplicates_skipped"] == 0:
            job.status = CrawlJobStatus.COMPLETED_NO_RESULTS
        else:
            job.status = CrawlJobStatus.COMPLETED
            
        db.commit()
    except Exception as e:
        if 'job' in locals() and job:
            job.status = CrawlJobStatus.FAILED
            job.error_message = str(e)
            try:
                db.commit()
            except:
                db.rollback()
    finally:
        db.close()

"""

# Regex to replace from `def run_manual_scan_task` to `def crawl_source`
pattern = r"def run_manual_scan_task\(.*?def crawl_source\("
replacement = new_func + "\n\ndef crawl_source("

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("backend/app/api/crawl.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Patch applied to crawl.py successfully.")
