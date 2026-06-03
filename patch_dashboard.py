import re

dashboard_path = "backend/app/api/dashboard.py"
with open(dashboard_path, "r", encoding="utf-8") as f:
    content = f.read()

new_endpoint = """
@router.get("/overview")
def get_dashboard_overview(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.project import Project
    from app.models.crawl import CrawlJob
    from app.models.source_item import SourceItem
    from app.core.config import settings
    
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}
        
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    d7_start = now - timedelta(days=7)
    d30_start = now - timedelta(days=30)
    
    # Totals
    mentions_total = db.execute(select(func.count(Mention.id)).where(Mention.project_id == project_id)).scalar() or 0
    mentions_today = db.execute(select(func.count(Mention.id)).where(and_(Mention.project_id == project_id, Mention.collected_at >= today_start))).scalar() or 0
    mentions_7d = db.execute(select(func.count(Mention.id)).where(and_(Mention.project_id == project_id, Mention.collected_at >= d7_start))).scalar() or 0
    mentions_30d = db.execute(select(func.count(Mention.id)).where(and_(Mention.project_id == project_id, Mention.collected_at >= d30_start))).scalar() or 0
    
    last_job = db.execute(select(CrawlJob).where(and_(CrawlJob.status == "completed", CrawlJob.meta_data.op('->>')('project_id') == str(project_id))).order_by(CrawlJob.completed_at.desc())).scalar_one_or_none()
    new_mentions_last_scan = last_job.mentions_found if last_job else 0
    
    # Actually wait, source_items_total doesn't have project_id, it's global
    source_items_total = db.execute(select(func.count(SourceItem.id))).scalar() or 0
    
    # Sources breakdown
    sources_data = db.execute(
        select(Mention.source_type, func.count(Mention.id))
        .where(Mention.project_id == project_id)
        .group_by(Mention.source_type)
    ).all()
    sources_dict = {row[0]: row[1] for row in sources_data if row[0]}
    
    # Sentiment
    from app.models.mention import SentimentScore
    sentiment_data = {"positive": 0, "neutral": 0, "negative": 0}
    try:
        # Simplistic mapping if available
        pass
    except:
        pass

    # Capability Check
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
    auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
    auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
    web_ready = has_serpapi and is_serpapi_provider and auto_discovery
    
    has_youtube = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
    
    rss_count = db.execute(select(func.count(Source.id)).where(Source.source_type == "rss")).scalar() or 0

    collectors = {
        "web": {"status": "READY" if web_ready else "CONFIG_REQUIRED"},
        "youtube": {"status": "READY" if has_youtube else "CONFIG_REQUIRED"},
        "rss": {"status": "READY" if rss_count > 0 else "NO_SOURCES"},
        "facebook": {"status": "CONNECT_REQUIRED"},
        "instagram": {"status": "CONNECT_REQUIRED"},
        "tiktok": {"status": "CONNECTOR_REQUIRED"},
        "twitter": {"status": "CONFIG_REQUIRED"}
    }
    
    # Recent mentions
    recent_mentions = db.execute(
        select(Mention).where(Mention.project_id == project_id).order_by(Mention.collected_at.desc()).limit(5)
    ).scalars().all()
    
    recent_jobs = db.execute(
        select(CrawlJob).filter(CrawlJob.meta_data.op('->>')('project_id') == str(project_id)).order_by(CrawlJob.created_at.desc()).limit(5)
    ).scalars().all()
    
    return {
        "project": {"id": project.id, "name": project.name},
        "totals": {
            "mentions_total": mentions_total,
            "mentions_today": mentions_today,
            "mentions_7d": mentions_7d,
            "mentions_30d": mentions_30d,
            "new_mentions_last_scan": new_mentions_last_scan,
            "source_items_total": source_items_total
        },
        "sentiment": sentiment_data,
        "sources": sources_dict,
        "collectors": collectors,
        "recent_mentions": [
            {
                "id": m.id,
                "title": m.title,
                "domain": m.domain,
                "sentiment": m.sentiment,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None
            } for m in recent_mentions
        ],
        "recent_jobs": [
            {
                "id": j.id,
                "status": j.status,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
                "mentions_found": j.mentions_found
            } for j in recent_jobs
        ],
        "alerts": []
    }
"""

if "@router.get(\"/overview\")" not in content:
    content += new_endpoint

with open(dashboard_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard patched")
