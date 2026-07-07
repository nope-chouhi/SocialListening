import time
import hashlib
import unicodedata
import logging
from typing import List, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm.attributes import flag_modified
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.database import SessionLocal
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.models.mention import Mention
from app.core.config import settings
from app.services.url_utils import clean_final_url, domain_from_url

logger = logging.getLogger(__name__)

_EXPANDED_KEYWORDS_CACHE = {}

def expand_scan_keyword(q: str):
    q_lower = q.lower().strip()
    expansions = [q_lower] if q_lower else []
    provider = "fallback"

    if not q_lower:
        return expansions, provider

    try:
        cache_key = f"expand_keyword_v2:{q_lower}"
        cached_expansions = None

        try:
            from app.core.config import settings
            import redis
            import json
            if getattr(settings, "REDIS_URL", None):
                r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                cached_val = r.get(cache_key)
                if cached_val:
                    cached_expansions = json.loads(cached_val)
        except ImportError:
            pass
        except Exception:
            pass

        if cached_expansions is None and q_lower in _EXPANDED_KEYWORDS_CACHE:
            timestamp, cached_val = _EXPANDED_KEYWORDS_CACHE[q_lower]
            if time.time() - timestamp < 86400:
                cached_expansions = cached_val

        if cached_expansions is None:
            from app.services.ai_service import expand_keyword as ai_expand_keyword
            cached_expansions = ai_expand_keyword(q)[:8]
            provider = "AI_Manager"
            _EXPANDED_KEYWORDS_CACHE[q_lower] = (time.time(), cached_expansions or [])
        else:
            provider = "cache"

        for item in cached_expansions or []:
            item_lower = str(item or "").lower().strip()
            if item_lower and item_lower not in expansions:
                expansions.append(item_lower)
    except Exception as e:
        import logging
        logging.error(f"AI expansion failed in background scan: {e}")

    return list(dict.fromkeys(expansions)), provider



def execute_scan(job_id: int, project_id: int, keyword_texts: List[str], mode: str, max_results: int, source_types: List[str] = None):
    from app.core.database import SessionLocal
    from app.models.crawl import CrawlJob, CrawlJobStatus
    from app.models.mention import Mention
    from app.core.config import settings
    from app.services.url_utils import clean_final_url, domain_from_url
    from sqlalchemy.orm.attributes import flag_modified
    import hashlib
    import time
    import unicodedata

    def strip_accents(s: str) -> str:
        if not s: return ""
        s = s.replace('đ', 'd').replace('Đ', 'D')
        return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

    db = SessionLocal()
    start_time = time.time()

    try:
        job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
        if not job: return

        job.status = CrawlJobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)

        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            "MANUAL_SCAN_START: job_id=%s project_id=%s keywords_count=%d mode=%s",
            job_id, project_id, len(keyword_texts), mode
        )

        current_meta = job.meta_data or {}
        original_query = current_meta.get("query")
        provider_used = current_meta.get("provider", "none")
        if current_meta.get("expand_keywords") and original_query:
            expanded_keywords, provider_used = expand_scan_keyword(original_query)
            for expanded_kw in expanded_keywords:
                if expanded_kw and expanded_kw not in keyword_texts:
                    keyword_texts.append(expanded_kw)

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
                "invalid_links_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not web_ready else None
            },
            "youtube": {
                "status": "READY" if has_youtube else "CONFIG_REQUIRED",
                "called": False,
                "raw_results_count": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "invalid_links_skipped": 0,
                "error": None,
                "skip_reason": "Not configured" if not has_youtube else None
            },
            "social": {
                "status": "READY",
                "called": False,
                "raw_results_count": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "invalid_links_skipped": 0,
                "error": None,
                "skip_reason": None
            },
            "rss": {
                "status": "READY",
                "called": False,
                "raw_results_count": 0,
                "mentions_created": 0,
                "duplicates_skipped": 0,
                "invalid_links_skipped": 0,
                "error": None,
                "skip_reason": None
            },
            "adapters_ready": [],
            "serpapi_result_count": 0,
            "urls_crawled": 0,
            "new_mentions_created": 0,
            "duplicates_skipped": 0,
            "invalid_links_skipped": 0,
            "old_mentions_existing": 0,
            "errors": []
        }

        # Ensure we keep existing keys from DB meta_data
        current_meta.update({
            "summary": summary,
            "project_id": project_id,
            "keywords": keyword_texts,
            "provider": provider_used,
            "started_at": job.started_at.isoformat() if job.started_at else None
        })
        if original_query:
            current_meta["query"] = original_query
        job.meta_data = current_meta
        db.commit()

        seen_hashes = set()

        run_discovery = mode in ("AUTO_DISCOVERY", "HYBRID")

        def commit_summary():
            cur = job.meta_data or {}
            # Update summary but keep all other fields intact
            cur["summary"] = summary
            job.meta_data = cur
            flag_modified(job, "meta_data")
            db.commit()
        if run_discovery:
            # Prevent discovery spam: Only trigger if there's no recent discovery job for this keyword
            from app.models.discovery import DiscoveryJob
            last_job = db.execute(
                select(DiscoveryJob)
                .filter(DiscoveryJob.project_id == project_id)
                .order_by(DiscoveryJob.created_at.desc())
                .limit(1)
            ).scalar_one_or_none()

            # Cooldown of 6 hours (21600 seconds)
            if not last_job or (datetime.now(timezone.utc) - last_job.created_at).total_seconds() > 21600:
                from app.services.discovery_service import create_discovery_job, run_discovery_job
                try:
                    from app.models.user import User
                    first_user = db.query(User).first()
                    user_id = first_user.id if first_user else 1
                    req_data = {
                        "keywords": keyword_texts,
                        "limit": max_results,
                        "language": "",
                        "country": "",
                        "project_id": project_id
                    }
                    disc_job = create_discovery_job(db, user_id=user_id, request_data=req_data)
                    db.commit()
                    def _run_discovery_bg(d_id):
                        from app.core.database import SessionLocal
                        bg_db = SessionLocal()
                        try:
                            run_discovery_job(bg_db, d_id)
                        finally:
                            bg_db.close()
                    import threading
                    threading.Thread(target=_run_discovery_bg, args=(disc_job.id,)).start()
                except Exception as e:
                    db.rollback()
                    import logging
                    logging.getLogger(__name__).error(f"Failed to create discovery job from scan: {e}")
            else:
                logger.info(f"Skipping auto-discovery for project {project_id} due to 6h cooldown.")

        def is_timeout():
            return (time.time() - start_time) > 120

        # ── PARALLEL ADAPTER EXECUTION ────────────────────────────────────────
        # Adapters fetch data concurrently. DB writes inside threads use local sessions.
        # All result merging and main DB writes happen after threads complete.
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from threading import Lock
        
        summary_lock = Lock()

        def run_web_adapter():
            if not web_ready:
                return []
            if source_types and "web" not in source_types:
                return []
            try:
                from app.services.serpapi_provider import search
                results = search(
                    keywords=keyword_texts, language="", country="",
                    limit=max_results, date_range=""
                )
                return [("web", r) for r in results]
            except Exception as e:
                with summary_lock:
                    summary["errors"].append(f"WebSearch: {e}")
                    summary["web"]["error"] = str(e)
                    summary["web"]["status"] = "ERROR"
                return []

        def run_youtube_adapter():
            if not has_youtube:
                return []
            if source_types and "youtube" not in source_types:
                return []
            try:
                from app.services.connectors.youtube_connector import YouTubeConnector
                yt = YouTubeConnector()
                if not yt.validate_config():
                    return []
                results = yt.search_keywords(keywords=keyword_texts, max_results=max_results)
                return [("youtube", r) for r in results]
            except Exception as e:
                with summary_lock:
                    summary["errors"].append(f"YouTube: {e}")
                    summary["youtube"]["error"] = str(e)
                    summary["youtube"]["status"] = "ERROR"
                return []

        def run_social_adapter():
            _social_types = ["reddit", "news", "google_news"]
            if source_types:
                _social_types = [st for st in _social_types if st in source_types]
            if source_types and len(_social_types) == 0:
                return []
            try:
                from app.services.social_crawler_service import social_crawler_service
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    results = loop.run_until_complete(
                        social_crawler_service.crawl_keywords(keyword_texts, _social_types, limit=max_results)
                    )
                finally:
                    loop.close()
                return [("social", r) for r in results]
            except Exception as e:
                with summary_lock:
                    summary["errors"].append(f"Social: {e}")
                    summary["social"]["error"] = str(e)
                    summary["social"]["status"] = "ERROR"
                return []

        # Mark adapters as running before launching threads
        if web_ready and (not source_types or "web" in source_types):
            summary["adapters_ready"].append("web")
            summary["web"]["called"] = True
            summary["web"]["status"] = "RUNNING"
        if has_youtube and (not source_types or "youtube" in source_types):
            summary["adapters_ready"].append("youtube")
            summary["youtube"]["called"] = True
            summary["youtube"]["status"] = "RUNNING"
        _sc = ["reddit", "news", "google_news"]
        if source_types:
            _sc = [st for st in _sc if st in source_types]
        if not source_types or len(_sc) > 0:
            summary["adapters_ready"].append("social")
            summary["social"]["called"] = True
            summary["social"]["status"] = "RUNNING"

        if not source_types or "rss" in source_types:
            summary["adapters_ready"].append("rss")
            summary["rss"]["called"] = True
            summary["rss"]["status"] = "RUNNING"

        # Mark Serper/Tavily chain as running
        summary["adapters_ready"].append("search_chain")
        summary["search_chain"] = {
            "status": "RUNNING",
            "called": True,
            "providers": {},
            "raw_results_count": 0,
            "mentions_created": 0,
            "duplicates_skipped": 0,
            "invalid_links_skipped": 0
        }
        commit_summary()

        # Launch all adapters in parallel
        all_raw_results = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            def run_rss_adapter():
                if source_types and "rss" not in source_types:
                    return []
                try:
                    from app.services.rss_collector import run_rss_collector
                    from app.core.database import SessionLocal
                    local_db = SessionLocal()
                    try:
                        res = run_rss_collector(
                            local_db,
                            ad_hoc_keywords=keyword_texts,
                            ad_hoc_project_id=project_id
                        )
                        with summary_lock:
                            summary["rss"]["raw_results_count"] = res.get("items_seen", 0)
                            summary["rss"]["mentions_created"] = res.get("mentions_created", 0)
                            summary["rss"]["duplicates_skipped"] = res.get("duplicates_skipped", 0)
                            summary["new_mentions_created"] += res.get("mentions_created", 0)
                            summary["duplicates_skipped"] += res.get("duplicates_skipped", 0)
                        return []
                    finally:
                        local_db.close()
                except Exception as e:
                    with summary_lock:
                        summary["errors"].append(f"RSS: {e}")
                        summary["rss"]["error"] = str(e)
                        summary["rss"]["status"] = "ERROR"
                    return []

            def run_search_chain_adapter():
                if source_types and "search_chain" not in source_types and "web" not in source_types:
                    return []
                try:
                    from app.services.search_providers import run_provider_chain
                    chain_results, chain_summaries = run_provider_chain(
                        keywords=keyword_texts,
                        project_id=project_id,
                        db_session_factory=SessionLocal,
                        max_results=settings.SEARCH_PROVIDER_MAX_RESULTS,
                        timeout_s=settings.SEARCH_PROVIDER_TIMEOUT_SECONDS,
                    )
                    with summary_lock:
                        summary["search_chain"]["providers"] = chain_summaries
                        summary["search_chain"]["status"] = "COMPLETED"
                        summary["search_chain"]["raw_results_count"] = sum(s.get("raw_results", 0) for s in chain_summaries.values())
                        summary["search_chain"]["duplicates_skipped"] = sum(s.get("duplicate_skipped", 0) for s in chain_summaries.values())
                        summary["search_chain"]["invalid_links_skipped"] = sum(s.get("invalid_url_skipped", 0) for s in chain_summaries.values())
                    # mentions_created is tracked below in the DB insert loop

                    # Wrap results with adapter tag for downstream processing
                    return [("search_chain", r) for r in chain_results]
                except Exception as e:
                    with summary_lock:
                        summary["errors"].append(f"SearchChain: {e}")
                        summary["search_chain"]["error"] = str(e)
                        summary["search_chain"]["status"] = "ERROR"
                    return []

            futures = {
                executor.submit(run_web_adapter): "web",
                executor.submit(run_youtube_adapter): "youtube",
                executor.submit(run_social_adapter): "social",
                executor.submit(run_rss_adapter): "rss",
                executor.submit(run_search_chain_adapter): "search_chain",
            }
            for future in as_completed(futures):
                name = futures[future]
                try:
                    results = future.result(timeout=110)
                    all_raw_results.extend(results)
                    with summary_lock:
                        if name not in ("rss", "search_chain") and not summary[name].get("error"):
                            summary[name]["status"] = "COMPLETED"
                except Exception as e:
                    with summary_lock:
                        summary["errors"].append(f"{name}: {e}")
                        if name in summary:
                            summary[name]["error"] = str(e)
                            summary[name]["status"] = "ERROR"


        # ── WRITE ALL RESULTS TO DB (single-threaded, safe) ──────────────────
        for (adapter_name, r) in all_raw_results:
            # search_chain results are pre-validated; use url directly
            if adapter_name == "search_chain":
                url = r.get("url")  # already passed clean_final_url in provider
                title = str(r.get("title") or "")
                snippet = str(r.get("snippet") or "")
            else:
                raw_url = r.get("canonical_url") or r.get("url")
                url = clean_final_url(raw_url)
                title = str(r.get("title") or "")
                snippet = str(r.get("snippet") if adapter_name == "web" else r.get("content") or "")

            # Count raw (only for legacy adapters)
            if adapter_name == "web":
                summary["serpapi_result_count"] += 1
                summary["web"]["raw_results_count"] += 1
            elif adapter_name == "youtube":
                summary["youtube"]["raw_results_count"] += 1
            elif adapter_name == "social":
                summary["social"]["raw_results_count"] += 1
            # search_chain counts tracked in chain_summaries

            if not url:
                if adapter_name != "search_chain" and (r.get("url") or r.get("original_url")):
                    if adapter_name in summary and isinstance(summary.get(adapter_name), dict):
                        summary[adapter_name]["invalid_links_skipped"] = summary[adapter_name].get("invalid_links_skipped", 0) + 1
                    summary["invalid_links_skipped"] += 1
                continue

            # Keyword match
            matched_kw = None
            search_text = strip_accents((title + " " + snippet).lower())
            if adapter_name == "search_chain":
                # Provider already matched this keyword to generate the result, don't drop it.
                matched_kw = r.get("matched_keyword")
                if not matched_kw and keyword_texts:
                    matched_kw = keyword_texts[0]
            else:
                # Local exact match for other adapters
                for kw in keyword_texts:
                    kw_norm = strip_accents(kw.lower())
                    if kw_norm in search_text:
                        matched_kw = kw
                        break

            if not matched_kw:
                summary[adapter_name]["invalid_links_skipped"] += 1
                continue

            if adapter_name == "web":
                summary["web"]["results_after_keyword_match"] = (
                    summary["web"].get("results_after_keyword_match", 0) + 1
                )

            content_hash = hashlib.sha256(
                f"{project_id}_{matched_kw}_{url.lower()}_{title}".encode()
            ).hexdigest()

            if content_hash in seen_hashes:
                summary[adapter_name]["duplicates_skipped"] += 1
                summary["duplicates_skipped"] += 1
                continue

            existing = db.execute(
                select(Mention).where(Mention.content_hash == content_hash)
            ).scalar_one_or_none()
            if existing:
                summary[adapter_name]["duplicates_skipped"] += 1
                summary["duplicates_skipped"] += 1
                summary["old_mentions_existing"] += 1
                seen_hashes.add(content_hash)
                continue

            seen_hashes.add(content_hash)
            parsed_domain = domain_from_url(url)

            if adapter_name == "web":
                src_type, platform, author, published_at = "web", "web", "", None
            elif adapter_name == "youtube":
                src_type, platform = "video", "youtube"
                parsed_domain = "youtube.com"
                author = (r.get("author") or "")[:500]
                published_at = r.get("published_at")
            elif adapter_name == "search_chain":
                src_type = "news"
                platform = r.get("provider", "web")
                author = ""
                published_at = r.get("published_at")
            else:
                src_type = r.get("source_type", "social")
                platform = r.get("platform", "social")
                author = (r.get("author") or "")[:500]
                published_at = r.get("timestamp")

            m_data = r.get("metadata") or {}
            if r.get("source_provenance"):
                m_data["source_provenance"] = r["source_provenance"]
            if r.get("relevance_score") is not None:
                m_data["relevance_score"] = r["relevance_score"]

            mention = Mention(
                project_id=project_id,
                job_id=job_id,
                keyword_text=matched_kw,
                source_type=src_type,
                platform=platform,
                domain=parsed_domain,
                title=title[:500] if title else None,
                snippet=snippet[:1000] if snippet else None,
                content=snippet[:10000] if snippet else None,
                url=url,
                original_url=r.get("original_url"),
                canonical_url=url,
                content_hash=content_hash,
                collected_at=datetime.now(timezone.utc),
                is_reviewed=False,
                author=author,
                published_at=published_at,
                matched_keywords=[{"keyword": matched_kw}],
                meta_data=m_data,
            )
            db.add(mention)
            summary[adapter_name]["mentions_created"] += 1
            summary["new_mentions_created"] += 1

        db.flush()
        commit_summary()

        # Final status
        if is_timeout():
            job.status = CrawlJobStatus.TIMEOUT
            job.error_message = "Scan timeout: adapters did not complete within 120 seconds."
        elif summary["errors"] and len(summary["errors"]) == len(summary["adapters_ready"]):
            job.status = CrawlJobStatus.FAILED
            job.error_message = "All adapters failed: " + "; ".join(summary["errors"])
        elif summary["errors"]:
            job.status = CrawlJobStatus.PARTIAL_FAILED
            job.error_message = "Some adapters failed: " + "; ".join(summary["errors"])
        elif summary["new_mentions_created"] == 0 and summary["duplicates_skipped"] == 0:
            job.status = CrawlJobStatus.COMPLETED_NO_RESULTS
        else:
            job.status = CrawlJobStatus.COMPLETED

        # Update strict metadata fields
        meta_data_final = job.meta_data or {}
        meta_data_final["normalized_query"] = meta_data_final.get("query", "").strip().lower()
        meta_data_final["expanded_keywords"] = keyword_texts
        meta_data_final["requested_max_results_per_source"] = max_results
        meta_data_final["actual_raw_results_count"] = sum(s.get("raw_results_count", 0) for k, s in summary.items() if isinstance(s, dict) and "raw_results_count" in s)
        meta_data_final["raw_results_count"] = meta_data_final["actual_raw_results_count"]
        meta_data_final["created_mentions_count"] = summary.get("new_mentions_created", 0)
        meta_data_final["duplicate_mentions_count"] = summary.get("duplicates_skipped", 0)
        meta_data_final["invalid_links_skipped"] = summary.get("invalid_links_skipped", 0)
        meta_data_final["skipped_low_relevance_count"] = max(
            0,
            meta_data_final["actual_raw_results_count"]
            - meta_data_final["created_mentions_count"]
            - meta_data_final["duplicate_mentions_count"]
            - meta_data_final["invalid_links_skipped"]
        )
        meta_data_final["failed_sources"] = summary["errors"]
        meta_data_final["duration_seconds"] = time.time() - start_time
        meta_data_final["status"] = job.status.name

        # Temporary admin/debug-safe fields
        meta_data_final["provider_summary"] = summary.get("search_chain", {})
        meta_data_final["last_error"] = job.error_message

        # Count visible mentions for the query
        try:
            visible_count = db.execute(
                select(func.count(Mention.id))
                .where(Mention.project_id == project_id)
                .where(
                    or_(
                        Mention.title.ilike(f"%{keyword_texts[0]}%"),
                        Mention.snippet.ilike(f"%{keyword_texts[0]}%"),
                        Mention.content.ilike(f"%{keyword_texts[0]}%"),
                        Mention.keyword_text.ilike(f"%{keyword_texts[0]}%")
                    )
                )
                .where(Mention.is_muted == False)
                .where(Mention.is_deleted == False)
            ).scalar() or 0
            meta_data_final["visible_mentions_for_query"] = visible_count
        except Exception as e:
            meta_data_final["visible_mentions_for_query"] = -1

        job.meta_data = meta_data_final
        job.completed_at = datetime.now(timezone.utc)
        job.mentions_found = meta_data_final["created_mentions_count"]
        flag_modified(job, "meta_data")
        db.commit()

        # Comprehensive logging
        job_type = job.job_type.upper() if getattr(job, "job_type", None) else "SCAN"
        duration = (job.completed_at - job.started_at.replace(tzinfo=timezone.utc)).total_seconds() if job.started_at else 0
        total_collected = sum(meta_data_final.get("adapter_mentions", {}).values())
        
        logger.info(
            f"[{job_type}_COMPLETE] job_id={job_id} project_id={project_id} "
            f"duration={duration:.1f}s keywords={len(keyword_texts)} "
            f"collected={total_collected} new_inserted={meta_data_final['created_mentions_count']} "
            f"duplicates_skipped={total_collected - meta_data_final['created_mentions_count']} "
            f"errors={len(summary['errors'])} alerts_created=N/A status={job.status.name}"
        )

    except Exception as e:
        if 'job' in locals() and job:
            db.rollback()
            try:
                # Need to fetch job again because session was rolled back
                job = db.execute(select(CrawlJob).where(CrawlJob.id == job_id)).scalar_one_or_none()
                if job:
                    job.status = CrawlJobStatus.FAILED
                    job.error_message = str(e)[:2000]
                    # Also populate meta_data with error code
                    if not job.meta_data: job.meta_data = {}
                    meta = dict(job.meta_data)
                    meta["error_code"] = "BACKEND_EXCEPTION"
                    job.meta_data = meta
                    db.commit()
            except:
                pass
    finally:
        db.close()
