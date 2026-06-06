import sys

# Read current crawl.py
with open('backend/app/api/crawl.py', encoding='utf-8') as f:
    content = f.read()

start_marker = '''        def is_timeout():
            return (time.time() - start_time) > 120

        # -------------- WEB ADAPTER --------------'''

end_marker = '''    except Exception as e:
        if 'job' in locals() and job:'''

idx_start = content.find(start_marker)
idx_end   = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print("ERROR: markers not found!", file=sys.stderr)
    sys.exit(1)

replacement = '''        def is_timeout():
            return (time.time() - start_time) > 120

        # ── PARALLEL ADAPTER EXECUTION ────────────────────────────────────────
        # Adapters fetch data concurrently (no DB writes inside threads).
        # All DB writes happen after threads complete, in one atomic block.
        from concurrent.futures import ThreadPoolExecutor, as_completed

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
                        social_crawler_service.crawl_keywords(keyword_texts, _social_types)
                    )
                finally:
                    loop.close()
                return [("social", r) for r in results]
            except Exception as e:
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
        commit_summary()

        # Launch all adapters in parallel
        all_raw_results = []
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(run_web_adapter): "web",
                executor.submit(run_youtube_adapter): "youtube",
                executor.submit(run_social_adapter): "social",
            }
            for future in as_completed(futures):
                name = futures[future]
                try:
                    results = future.result(timeout=110)
                    all_raw_results.extend(results)
                    if not summary[name].get("error"):
                        summary[name]["status"] = "COMPLETED"
                except Exception as e:
                    summary["errors"].append(f"{name}: {e}")
                    summary[name]["error"] = str(e)
                    summary[name]["status"] = "ERROR"

        # ── WRITE ALL RESULTS TO DB (single-threaded, safe) ──────────────────
        for (adapter_name, r) in all_raw_results:
            url = r.get("url")
            if not url:
                continue
            url = str(url).lower().strip()
            title = str(r.get("title") or "")
            snippet = str(r.get("snippet") if adapter_name == "web" else r.get("content") or "")

            # Count raw
            if adapter_name == "web":
                summary["serpapi_result_count"] += 1
                summary["web"]["raw_results_count"] += 1
            elif adapter_name == "youtube":
                summary["youtube"]["raw_results_count"] += 1
            else:
                summary["social"]["raw_results_count"] += 1

            # Keyword match
            matched_kw = None
            search_text = strip_accents((title + " " + snippet + " " + url).lower())
            for kw in keyword_texts:
                if strip_accents(kw.lower()) in search_text:
                    matched_kw = kw
                    break
            if not matched_kw:
                continue

            if adapter_name == "web":
                summary["web"]["results_after_keyword_match"] = (
                    summary["web"].get("results_after_keyword_match", 0) + 1
                )

            content_hash = hashlib.sha256(
                f"{project_id}_{matched_kw}_{url}_{title}".encode()
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
            parsed_domain = urlparse(url).netloc

            if adapter_name == "web":
                src_type, platform, author, published_at = "web", "web", "", None
            elif adapter_name == "youtube":
                src_type, platform = "video", "youtube"
                parsed_domain = "youtube.com"
                author = (r.get("author") or "")[:500]
                published_at = r.get("published_at")
            else:
                src_type = r.get("source_type", "social")
                platform = r.get("platform", "social")
                parsed_domain = platform + ".com"
                author = (r.get("author") or "")[:500]
                published_at = r.get("timestamp")

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
                content_hash=content_hash,
                collected_at=datetime.now(timezone.utc),
                is_reviewed=False,
                author=author,
                published_at=published_at,
            )
            db.add(mention)
            summary[adapter_name]["mentions_created"] += 1
            summary["new_mentions_created"] += 1

        db.flush()
        commit_summary()
        db.commit()

        job.completed_at = datetime.now(timezone.utc)
        job.mentions_found = summary["new_mentions_created"]
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
        elif summary["new_mentions_created"] == 0 and summary["duplicates_skipped"] == 0:
            job.status = CrawlJobStatus.COMPLETED_NO_RESULTS
        else:
            job.status = CrawlJobStatus.COMPLETED

        db.commit()

    except Exception as e:
        if 'job' in locals() and job:'''

new_content = content[:idx_start] + replacement + content[idx_end + len(end_marker):]

with open('backend/app/api/crawl.py', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(new_content)

print(f"Done. New file size: {len(new_content)} chars")

# Quick syntax check
import ast, sys
try:
    ast.parse(new_content)
    print("Syntax OK")
except SyntaxError as se:
    print(f"SYNTAX ERROR: {se}", file=sys.stderr)
    sys.exit(1)
