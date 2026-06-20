import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import unicodedata
import feedparser
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.source import Source, SourceType
from app.models.source_item import SourceItem
from app.models.keyword import Keyword, KeywordGroup
from app.models.mention import Mention
from app.core.config import settings
from app.services.url_utils import clean_final_url, domain_from_url, extract_google_news_embedded_url, is_google_news_discovery_url

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; SocialListeningBot/1.0; +https://nope.com)"
REQUEST_TIMEOUT = 15

def validate_rss_feed(url: str) -> tuple[bool, str, str]:
    """
    Validate if a URL is a valid RSS/Atom feed.
    """
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return False, "timeout", "Kết nối hết hạn."
    except Exception as e:
        return False, "fetch_failed", f"Lỗi lấy dữ liệu: {e}"

    content_type = response.headers.get("content-type", "").lower()
    
    # Try parsing
    feed = feedparser.parse(response.content)
    if feed.bozo and not feed.entries:
        return False, "invalid_xml", "URL không chứa XML/RSS hợp lệ."
        
    return True, "", ""

def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    if not url: return ""
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"
    except Exception:
        return url.strip()

def clean_html(raw_html: str) -> str:
    if not raw_html: return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=' ', strip=True)
    
def strip_accents(s: str) -> str:
    if not s: return ""
    s = s.replace('đ', 'd').replace('Đ', 'D')
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def generate_content_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()

def fetch_and_parse_feed(url: str) -> Dict:
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        if feed.bozo and not feed.entries:
            return {"success": False, "error": f"Parse error: {getattr(feed, 'bozo_exception', 'Unknown')}"}
            
        items = []
        for entry in feed.entries:
            title = entry.get('title', '').strip()
            link = entry.get('link', '').strip()
            guid = entry.get('id', '') or entry.get('guid', '') or link
            final_link = clean_final_url(link) or extract_google_news_embedded_url(link)
            if not final_link:
                logger.info("Skipping RSS entry with invalid/discovery/media URL: %s", link)
                continue
            discovery_url = link if is_google_news_discovery_url(link) else None
            
            # Content / description
            description = entry.get('summary', '') or entry.get('description', '')
            if entry.get('content'):
                description = entry.content[0].get('value', description)
            
            snippet = clean_html(description)[:1000]
            
            # Dates
            published_at = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                try:
                    published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                except:
                    pass
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                try:
                    published_at = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
                except:
                    pass
                    
            # Media
            image_url = None
            media_url = None
            media_thumbnail = None
            
            # Check enclosures
            if entry.get('enclosures'):
                for enc in entry.enclosures:
                    if 'image' in enc.get('type', ''):
                        image_url = enc.get('href')
                    elif 'video' in enc.get('type', ''):
                        media_url = enc.get('href')
                        
            # Check media namespace (VnE GO uses this)
            if hasattr(entry, 'media_content') and len(entry.media_content) > 0:
                media_url = entry.media_content[0].get('url')
            if hasattr(entry, 'media_thumbnail') and len(entry.media_thumbnail) > 0:
                media_thumbnail = entry.media_thumbnail[0].get('url')
                
            # If no image found, try extracting from description HTML
            if not image_url and not media_thumbnail and description:
                soup = BeautifulSoup(description, "html.parser")
                img = soup.find("img")
                if img and img.get("src"):
                    image_url = img["src"]
            
            items.append({
                "title": title,
                "url": final_link,
                "canonical_url": final_link,
                "original_url": discovery_url,
                "domain": domain_from_url(final_link),
                "guid": guid,
                "snippet": snippet,
                "html_description": description,
                "published_at": published_at,
                "image_url": image_url,
                "media_url": media_url,
                "media_thumbnail": media_thumbnail,
                "author": entry.get('author', '')
            })
            
        return {"success": True, "items": items}
    except Exception as e:
        return {"success": False, "error": str(e)}

def run_rss_collector(db: Session, source_ids: List[int] = None, ad_hoc_keywords: List[str] = None, ad_hoc_project_id: int = None) -> Dict:
    """Run RSS collection for given sources or all active RSS sources."""
    query = select(Source).where(Source.is_active == True, Source.source_type == 'rss')
    if source_ids:
        query = query.where(Source.id.in_(source_ids))
        
    sources = db.execute(query).scalars().all()
    
    result = {
        "status": "COMPLETED",
        "sources_scanned": len(sources),
        "items_seen": 0,
        "source_items_created": 0,
        "duplicates_skipped": 0,
        "mentions_created": 0,
        "errors": []
    }
    
    active_keywords = db.execute(select(Keyword).where(Keyword.is_active == True, Keyword.is_excluded == False)).scalars().all()
    
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    for source in sources:
        try:
            feed_data = fetch_and_parse_feed(source.url)
            if not feed_data["success"]:
                source.last_error = feed_data["error"]
                source.error_count = (source.error_count or 0) + 1
                result["errors"].append({"source_id": source.id, "error": feed_data["error"]})
                result["status"] = "PARTIAL_FAILED"
                db.commit()
                continue
                
            source.last_success_at = datetime.now(timezone.utc)
            source.last_error = None
            source.error_count = 0
            
            items = feed_data["items"]
            result["items_seen"] += len(items)
            
            for item in items:
                # Deduplication logic
                norm_url = normalize_url(item["url"])
                content_for_hash = f"{item['title']} {item['snippet']}"
                content_hash = generate_content_hash(content_for_hash)
                
                # Check if exists in source_items
                exists = db.execute(
                    select(SourceItem.id).where(
                        (SourceItem.normalized_url == norm_url) |
                        ((SourceItem.guid == item["guid"]) & (SourceItem.guid != '')) |
                        (SourceItem.content_hash == content_hash)
                    )
                ).scalar_one_or_none()
                
                if exists:
                    result["duplicates_skipped"] += 1
                    continue
                    
                # Date filtering (skip old items)
                pub_date = item["published_at"] or datetime.now(timezone.utc)
                if pub_date < thirty_days_ago:
                    result["duplicates_skipped"] += 1
                    continue
                    
                # Save to source_items
                source_item = SourceItem(
                    source_type="rss",
                    platform=source.platform or "web",
                    source_id=source.id,
                    source_name=source.name,
                    url=item["url"],
                    normalized_url=norm_url,
                    domain=item.get("domain"),
                    title=item["title"],
                    snippet=item["snippet"],
                    author=item["author"],
                    published_at=item["published_at"],
                    collected_at=datetime.now(timezone.utc),
                    guid=item["guid"],
                    image_url=item["image_url"],
                    media_url=item["media_url"],
                    media_thumbnail=item["media_thumbnail"],
                    raw_payload_json={"discovery_url": item.get("original_url")} if item.get("original_url") else None,
                    content_hash=content_hash,
                    status="collected"
                )
                db.add(source_item)
                db.flush()
                result["source_items_created"] += 1
                
                # Matching engine
                matched_kws = []
                text_to_match = strip_accents(f"{item['title']} {item['snippet']}".lower())
                
                project_id = None
                
                # Match ad-hoc keywords first
                for kw in (ad_hoc_keywords or []):
                    kw_norm = strip_accents(kw.lower())
                    if kw_norm in text_to_match:
                        matched_kws.append({"keyword": kw, "count": text_to_match.count(kw_norm)})
                        if not project_id and ad_hoc_project_id:
                            project_id = ad_hoc_project_id

                for kw in active_keywords:
                    kw_norm = strip_accents(kw.keyword.lower())
                    if kw_norm in text_to_match:
                        matched_kws.append({"keyword": kw.keyword, "count": text_to_match.count(kw_norm)})
                        
                if matched_kws and not project_id:
                    # Assign to the project of the first matched keyword
                    first_kw = active_keywords[0]
                    kw_group = db.query(KeywordGroup).get(first_kw.group_id)
                    project_id = kw_group.project_id if kw_group else None
                    
                # Always create mention so user can search for broader keywords on the web
                m_exists = db.execute(
                    select(Mention.id).where(
                        Mention.url == norm_url
                    )
                ).scalar_one_or_none()
                
                if not m_exists and matched_kws:
                    mention = Mention(
                        project_id=project_id,
                        keyword_text=matched_kws[0]["keyword"],
                        source_id=source.id,
                        source_type="rss",
                        platform=source.platform or "web",
                        domain=item.get("domain"),
                        title=item["title"],
                        url=norm_url,
                        canonical_url=item.get("canonical_url") or norm_url,
                        original_url=item.get("original_url"),
                        snippet=item["snippet"],
                        content=item["html_description"],
                        content_hash=content_hash,
                        published_at=item["published_at"],
                        collected_at=datetime.now(timezone.utc),
                        extraction_source="rss",
                        sentiment="neutral",
                        confidence="medium",
                        matched_keywords=matched_kws if matched_kws else None,
                        meta_data={
                            "image_url": item.get("image_url"),
                            "media_url": item.get("media_url"),
                            "media_thumbnail": item.get("media_thumbnail")
                        }
                    )
                    db.add(mention)
                    result["mentions_created"] += 1
                    source_item.status = "matched" if matched_kws else "collected"
                
            db.commit()
            
        except Exception as e:
            logger.error(f"Error processing RSS source {source.id}: {e}")
            result["errors"].append({"source_id": source.id, "error": str(e)})
            result["status"] = "PARTIAL_FAILED"
            db.rollback()
            
    return result
