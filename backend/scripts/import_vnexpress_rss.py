import os
import sys
import logging
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.source import Source, SourceType, SourceGroup
from app.models.source_item import SourceItem
from app.models.keyword import Keyword
from app.models.mention import Mention
from app.services.rss_collector import validate_rss_feed, normalize_url

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure tables exist locally for testing
Base.metadata.create_all(bind=engine)

VNEXPRESS_SOURCES = [
  {
    "name": "VnExpress - Tin mới nhất",
    "url": "https://vnexpress.net/rss/tin-moi-nhat.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "news",
    "group": "Tin mới nhất",
    "enabled": True
  },
  {
    "name": "VnExpress - Tin nổi bật",
    "url": "https://vnexpress.net/rss/tin-noi-bat.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "news",
    "group": "Tin nổi bật",
    "enabled": True
  },
  {
    "name": "VnExpress - Thời sự",
    "url": "https://vnexpress.net/rss/thoi-su.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "news",
    "group": "Thời sự",
    "enabled": True
  },
  {
    "name": "VnExpress - Thế giới",
    "url": "https://vnexpress.net/rss/the-gioi.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "news",
    "group": "Thế giới",
    "enabled": True
  },
  {
    "name": "VnExpress - Kinh doanh",
    "url": "https://vnexpress.net/rss/kinh-doanh.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "business",
    "group": "Kinh doanh",
    "enabled": True
  },
  {
    "name": "VnExpress - Bất động sản",
    "url": "https://vnexpress.net/rss/bat-dong-san.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "real_estate",
    "group": "Bất động sản",
    "enabled": True
  },
  {
    "name": "VnExpress - Giáo dục",
    "url": "https://vnexpress.net/rss/giao-duc.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "education",
    "group": "Giáo dục",
    "enabled": True
  },
  {
    "name": "VnExpress - Sức khỏe",
    "url": "https://vnexpress.net/rss/suc-khoe.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "health",
    "group": "Sức khỏe",
    "enabled": True
  },
  {
    "name": "VnExpress - Khoa học công nghệ",
    "url": "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "technology",
    "group": "Khoa học công nghệ",
    "enabled": True
  },
  {
    "name": "VnExpress - Đời sống",
    "url": "https://vnexpress.net/rss/gia-dinh.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "lifestyle",
    "group": "Đời sống",
    "enabled": True
  },
  {
    "name": "VnExpress - Giải trí",
    "url": "https://vnexpress.net/rss/giai-tri.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "entertainment",
    "group": "Giải trí",
    "enabled": True
  },
  {
    "name": "VnExpress - Pháp luật",
    "url": "https://vnexpress.net/rss/phap-luat.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "law",
    "group": "Pháp luật",
    "enabled": True
  },
  {
    "name": "VnExpress - Góc nhìn",
    "url": "https://vnexpress.net/rss/goc-nhin.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "opinion",
    "group": "Góc nhìn",
    "enabled": True
  },
  {
    "name": "VnExpress - Du lịch",
    "url": "https://vnexpress.net/rss/du-lich.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "travel",
    "group": "Du lịch",
    "enabled": True
  },
  {
    "name": "VnExpress - Xe",
    "url": "https://vnexpress.net/rss/oto-xe-may.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "auto",
    "group": "Xe",
    "enabled": True
  },
  {
    "name": "VnExpress - Tâm sự",
    "url": "https://vnexpress.net/rss/tam-su.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "lifestyle",
    "group": "Tâm sự",
    "enabled": True
  },
  {
    "name": "VnExpress - Thư giãn",
    "url": "https://vnexpress.net/rss/thu-gian.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "entertainment",
    "group": "Thư giãn",
    "enabled": True
  },
  {
    "name": "VnExpress - Thể thao",
    "url": "https://vnexpress.net/rss/the-thao.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "sports",
    "group": "Thể thao",
    "enabled": True
  },
  {
    "name": "VnExpress - VnE GO",
    "url": "https://vnexpress.net/rss/vne-go.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "video",
    "group": "VnE GO",
    "enabled": True,
    "content_format": "video"
  },
  {
    "name": "VnExpress - Spotlight",
    "url": "https://vnexpress.net/rss/spotlight.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "spotlight",
    "group": "Spotlight",
    "enabled": True
  },
  {
    "name": "VnExpress - Tin xem nhiều",
    "url": "https://vnexpress.net/rss/tin-xem-nhieu.rss",
    "source_type": "rss",
    "platform": "web",
    "category": "popular",
    "group": "Tin xem nhiều",
    "enabled": True,
    "note": "This feed may contain old historical items. Must filter by item.pubDate before creating mentions."
  }
]

def import_sources():
    db: Session = SessionLocal()
    
    imported = 0
    active = 0
    failed = 0
    failed_details = []
    
    # 1. Create a general SourceGroup for VnExpress if not exists
    group = db.execute(select(SourceGroup).where(SourceGroup.name == "VnExpress RSS")).scalar_one_or_none()
    if not group:
        group = SourceGroup(name="VnExpress RSS", description="VnExpress RSS Feeds imported automatically", is_active=True)
        db.add(group)
        db.commit()
        db.refresh(group)
        
    group_id = group.id

    try:
        for s in VNEXPRESS_SOURCES:
            logger.info(f"Processing {s['name']} ({s['url']})")
            
            # Validate RSS
            is_valid, err_code, err_msg = validate_rss_feed(s['url'])
            
            # Check duplicate by normalized URL
            norm_url = normalize_url(s['url'])
            
            existing = None
            all_sources = db.execute(select(Source)).scalars().all()
            for src in all_sources:
                if normalize_url(src.url) == norm_url:
                    existing = src
                    break
                    
            if existing:
                existing.name = s['name']
                existing.category = s['category']
                existing.platform = s['platform']
                existing.is_active = is_valid
                if not is_valid:
                    existing.last_error = err_msg
                else:
                    existing.last_error = None
                    active += 1
                logger.info(f"Updated existing source {existing.id}")
            else:
                source = Source(
                    name=s['name'],
                    url=s['url'],
                    source_type=s['source_type'],
                    platform=s['platform'],
                    category=s['category'],
                    domain="vnexpress.net",
                    is_active=is_valid,
                    group_id=group_id,
                    crawl_frequency="hourly",
                    meta_data={"group": s['group'], "note": s.get('note')}
                )
                if not is_valid:
                    source.last_error = err_msg
                    failed += 1
                    failed_details.append(f"{s['name']}: {err_msg}")
                else:
                    active += 1
                    
                db.add(source)
                logger.info(f"Created new source: {s['name']}")
                
            imported += 1
            db.commit()
            
        logger.info("\n=== IMPORT SUMMARY ===")
        logger.info(f"Total processed: {imported}")
        logger.info(f"Total active/valid: {active}")
        logger.info(f"Total failed validation: {failed}")
        if failed_details:
            logger.info("Failed details:")
            for fd in failed_details:
                logger.info(f"  - {fd}")
                
    except Exception as e:
        logger.error(f"Import failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_sources()
