from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import hashlib

from app.core.database import get_db, SessionLocal
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.source import Source
from app.models.keyword import Keyword
from app.models.source_item import SourceItem
from app.models.mention import Mention
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# --- HELPER: Matching Engine ---
def match_and_create_mentions(db: Session, source_item: SourceItem, active_keywords: List[Keyword], project_id: Optional[int] = None) -> int:
    """Run matching engine for a source_item against keywords and create Mentions."""
    mentions_created = 0
    search_text = f"{source_item.title or ''} {source_item.snippet or ''} {source_item.content or ''}".lower()
    
    for kw in active_keywords:
        kw_text = kw.keyword.lower().strip()
        if not kw_text: continue
        
        # If project_id is provided, only match for that project
        if project_id and kw.project_id != project_id:
            continue
            
        if kw_text in search_text:
            # Check duplication: project_id + keyword_text + normalized_url
            existing = db.execute(
                select(Mention).where(
                    and_(
                        Mention.project_id == kw.project_id,
                        Mention.keyword_text == kw_text,
                        Mention.url == source_item.url
                    )
                )
            ).scalar_one_or_none()
            
            if existing:
                # Duplicate: Update seen count/last_seen_at if fields existed, skipping for now as requested
                continue
                
            # Create Mention
            mention = Mention(
                project_id=kw.project_id,
                keyword_id=kw.id,
                keyword_text=kw_text,
                source_id=source_item.source_id,
                source_type=source_item.source_type,
                platform=source_item.platform,
                domain=source_item.domain,
                title=source_item.title,
                content=source_item.content,
                snippet=source_item.snippet,
                url=source_item.url,
                author=source_item.author,
                published_at=source_item.published_at,
                collected_at=source_item.collected_at,
                content_hash=source_item.content_hash, # This will conflict on unique if another project has same hash? 
                # Wait, content_hash unique constraint in Mention table is across whole DB!
                # We need to make it project-specific or catch the integrity error.
                # Since content_hash is unique in Mention, let's use hash(url + project_id)
            )
            # Fix content_hash for Mention deduplication
            mention.content_hash = hashlib.sha256(f"{source_item.url}_{kw.project_id}".encode()).hexdigest()
            db.add(mention)
            mentions_created += 1
            
    source_item.status = "matched" if mentions_created > 0 else "discarded"
    return mentions_created

# --- RSS COLLECTOR ---
def run_rss_collector_api(project_id: Optional[int] = None) -> Dict[str, Any]:
    from app.services.rss_collector import run_rss_collector as service_run_rss
    db = SessionLocal()
    try:
        return service_run_rss(db)
    finally:
        db.close()

# --- SERPAPI COLLECTOR ---
def run_serpapi_collector(project_id: Optional[int] = None) -> Dict[str, Any]:
    db = SessionLocal()
    result = {"status": "READY", "source_items_created": 0, "mentions_created": 0, "duplicates_skipped": 0, "errors": []}
    if not getattr(settings, "SERPAPI_API_KEY", ""):
        result["status"] = "CONFIG_REQUIRED"
        return result
        
    try:
        from app.services.serpapi_provider import search
        query = select(Keyword).where(Keyword.is_active == True)
        if project_id:
            query = query.where(Keyword.project_id == project_id)
        keywords = db.execute(query).scalars().all()
        
        result["status"] = "COMPLETED"
        for kw in keywords:
            try:
                serp_res = search(keywords=[kw.keyword], language="vi", country="vn", limit=20, date_range="last_24_hours")
                for r in serp_res:
                    url = r.get("url", "").lower().strip()
                    if not url: continue
                    title = r.get("title", "")
                    snippet = r.get("snippet", "")
                    content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                    
                    existing_item = db.execute(select(SourceItem).where(SourceItem.content_hash == content_hash)).scalar_one_or_none()
                    if existing_item:
                        result["duplicates_skipped"] += 1
                        continue
                        
                    from urllib.parse import urlparse
                    item = SourceItem(
                        source_type="web",
                        platform="web",
                        url=url,
                        normalized_url=url,
                        domain=urlparse(url).netloc,
                        title=title,
                        snippet=snippet,
                        content_hash=content_hash,
                        status="collected"
                    )
                    db.add(item)
                    db.flush()
                    result["source_items_created"] += 1
                    
                    m_count = match_and_create_mentions(db, item, keywords, project_id)
                    result["mentions_created"] += m_count
            except Exception as e:
                result["errors"].append(f"SerpAPI kw {kw.keyword}: {e}")
                
        db.commit()
    except Exception as e:
        result["status"] = "FAILED"
        result["errors"].append(str(e))
    finally:
        db.close()
    return result

# --- YOUTUBE COLLECTOR ---
def run_youtube_collector(project_id: Optional[int] = None) -> Dict[str, Any]:
    db = SessionLocal()
    result = {"status": "READY", "source_items_created": 0, "mentions_created": 0, "duplicates_skipped": 0, "errors": []}
    if not getattr(settings, "YOUTUBE_API_KEY", ""):
        result["status"] = "CONFIG_REQUIRED"
        return result
        
    try:
        from app.services.connectors.youtube_connector import YouTubeConnector
        yt = YouTubeConnector()
        if not yt.validate_config():
            result["status"] = "CONFIG_REQUIRED"
            return result
            
        query = select(Keyword).where(Keyword.is_active == True)
        if project_id:
            query = query.where(Keyword.project_id == project_id)
        keywords = db.execute(query).scalars().all()
        
        result["status"] = "COMPLETED"
        for kw in keywords:
            try:
                yt_res = yt.search_keywords(keywords=[kw.keyword], max_results=10)
                for r in yt_res:
                    url = r.get("url", "").lower().strip()
                    if not url: continue
                    title = r.get("title", "")
                    content_hash = hashlib.sha256(f"{url}_{title}".encode()).hexdigest()
                    
                    existing_item = db.execute(select(SourceItem).where(SourceItem.content_hash == content_hash)).scalar_one_or_none()
                    if existing_item:
                        result["duplicates_skipped"] += 1
                        continue
                        
                    item = SourceItem(
                        source_type="video",
                        platform="youtube",
                        url=url,
                        normalized_url=url,
                        domain="youtube.com",
                        title=title,
                        snippet=r.get("content", ""),
                        author=r.get("author", ""),
                        published_at=r.get("published_at"),
                        content_hash=content_hash,
                        status="collected"
                    )
                    db.add(item)
                    db.flush()
                    result["source_items_created"] += 1
                    
                    m_count = match_and_create_mentions(db, item, keywords, project_id)
                    result["mentions_created"] += m_count
            except Exception as e:
                result["errors"].append(f"YT kw {kw.keyword}: {e}")
                
        db.commit()
    except Exception as e:
        result["status"] = "FAILED"
        result["errors"].append(str(e))
    finally:
        db.close()
    return result

# --- ENDPOINTS ---
@router.post("/run")
def run_all_collectors(project_id: Optional[int] = Query(None), current_user: User = Depends(get_current_active_user)):
    rss_res = run_rss_collector_api(project_id)
    serp_res = run_serpapi_collector(project_id)
    yt_res = run_youtube_collector(project_id)
    
    total_items = rss_res["source_items_created"] + serp_res["source_items_created"] + yt_res["source_items_created"]
    total_mentions = rss_res["mentions_created"] + serp_res["mentions_created"] + yt_res["mentions_created"]
    
    return {
        "status": "COMPLETED",
        "project_id": project_id,
        "source_items_created": total_items,
        "mentions_created": total_mentions,
        "results": {
            "rss": rss_res,
            "web": serp_res,
            "youtube": yt_res
        }
    }

@router.post("/run/rss")
def run_rss(project_id: Optional[int] = Query(None), current_user: User = Depends(get_current_active_user)):
    return run_rss_collector_api(project_id)

@router.post("/run/serpapi")
def run_serpapi(project_id: Optional[int] = Query(None), current_user: User = Depends(get_current_active_user)):
    return run_serpapi_collector(project_id)

@router.post("/run/youtube")
def run_youtube(project_id: Optional[int] = Query(None), current_user: User = Depends(get_current_active_user)):
    return run_youtube_collector(project_id)
