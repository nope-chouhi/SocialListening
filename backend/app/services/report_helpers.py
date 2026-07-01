import json
from datetime import datetime, timedelta

def safe_pct_change(current: float, previous: float) -> str:
    """Safely calculates percentage change between two periods."""
    if previous == 0:
        if current > 0:
            return "+100%"
        return "0%"
    
    change = ((current - previous) / previous) * 100
    sign = "+" if change > 0 else ""
    return f"{sign}{change:.1f}%"

def aggregate_period_data(mentions, analyses_dict):
    """Aggregates raw mentions into report metrics."""
    metrics = {
        "total_mentions": len(mentions),
        "total_reach": 0,
        "social_reach": 0,
        "non_social_reach": 0,
        "interactions": 0,
        "sentiment": {"positive": 0, "negative": 0, "neutral": 0},
        "sources": {},
        "daily_trend": {},
        "top_mentions": [],
        "tags": {}
    }
    
    if not mentions:
        return metrics
        
    for m in mentions:
        # Reach
        reach = m.reach_estimate or 0
        metrics["total_reach"] += reach
        
        # Interactions
        inter = (m.likes_count or 0) + (m.shares_count or 0) + (m.comments_count or 0) + (m.views_count or 0)
        metrics["interactions"] += inter
        
        # Social vs Non-Social (Basic heuristic: if platform is empty or 'web', non-social)
        st = (m.source_type or 'web').lower()
        if st in ['web', 'news', 'blog', 'forum']:
            metrics["non_social_reach"] += reach
        else:
            metrics["social_reach"] += reach
            
        # Sources
        domain = m.domain or m.platform or 'Unknown'
        metrics["sources"][domain] = metrics["sources"].get(domain, 0) + 1
        
        # Sentiment
        analysis = analyses_dict.get(m.id)
        sent_val = "neutral"
        if analysis:
            sent_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
            if sent_val == 'negative_medium':
                sent_val = 'negative'
            if sent_val in metrics["sentiment"]:
                metrics["sentiment"][sent_val] += 1
            else:
                metrics["sentiment"]["neutral"] += 1
        else:
            metrics["sentiment"]["neutral"] += 1
            
        # Daily trend
        if m.published_at:
            date_str = m.published_at.strftime('%Y-%m-%d')
            if date_str not in metrics["daily_trend"]:
                metrics["daily_trend"][date_str] = {"count": 0, "positive": 0, "negative": 0, "neutral": 0, "reach": 0}
            metrics["daily_trend"][date_str]["count"] += 1
            metrics["daily_trend"][date_str][sent_val] += 1
            metrics["daily_trend"][date_str]["reach"] += reach
            
        # Tags
        tags = []
        if isinstance(m.tags_json, list):
            tags = m.tags_json
        elif isinstance(m.tags_json, str):
            try:
                tags = json.loads(m.tags_json)
                if not isinstance(tags, list): tags = []
            except:
                pass
        for t in tags:
            tag_name = t.lower().strip()
            metrics["tags"][tag_name] = metrics["tags"].get(tag_name, 0) + 1
            
        # Select top mentions (add all, sort later)
        metrics["top_mentions"].append({
            "id": m.id,
            "title": m.title,
            "snippet": m.snippet or m.content,
            "domain": domain,
            "sentiment": sent_val,
            "reach": reach,
            "url": m.url,
            "published_at": m.published_at
        })
        
    # Sort top mentions by reach
    metrics["top_mentions"] = sorted(metrics["top_mentions"], key=lambda x: x["reach"], reverse=True)[:10]
    
    # Sort sources
    sorted_sources = [{"name": k, "count": v} for k, v in metrics["sources"].items()]
    sorted_sources.sort(key=lambda x: x["count"], reverse=True)
    metrics["sources_list"] = sorted_sources
    
    # Sort tags
    sorted_tags = [{"name": k, "count": v} for k, v in metrics["tags"].items()]
    sorted_tags.sort(key=lambda x: x["count"], reverse=True)
    metrics["tags_list"] = sorted_tags[:15]
    
    return metrics

def calculate_period_comparison(current, previous):
    """Calculates all comparison metrics."""
    return {
        "mentions_change": safe_pct_change(current["total_mentions"], previous["total_mentions"]),
        "reach_change": safe_pct_change(current["total_reach"], previous["total_reach"]),
        "interactions_change": safe_pct_change(current["interactions"], previous["interactions"])
    }

def generate_executive_summary(metrics, comparison):
    """Generates a heuristic-based AI-like summary text."""
    if metrics["total_mentions"] == 0:
        return "Insufficient data to generate an executive summary for this period."
        
    lines = []
    lines.append(f"During this period, the project recorded {metrics['total_mentions']} total mentions with an estimated reach of {metrics['total_reach']:,}.")
    
    sent = metrics["sentiment"]
    total = metrics["total_mentions"]
    if total > 0:
        pos_pct = (sent["positive"] / total) * 100
        neg_pct = (sent["negative"] / total) * 100
        if pos_pct > 50:
            lines.append(f"The overall sentiment is predominantly positive ({pos_pct:.1f}%), indicating strong audience reception.")
        elif neg_pct > 30:
            lines.append(f"Attention is required due to a significant portion of negative sentiment ({neg_pct:.1f}%).")
        else:
            lines.append("The discussion remains largely neutral or balanced.")
            
    if comparison["mentions_change"] != "0%":
        lines.append(f"Mention volume changed by {comparison['mentions_change']} compared to the previous equivalent period.")
        
    top_domain = metrics["sources_list"][0]["name"] if metrics.get("sources_list") else "various sources"
    lines.append(f"The most active platform was {top_domain}.")
    
    return " ".join(lines)
