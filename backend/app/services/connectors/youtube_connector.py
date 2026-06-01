import logging
import requests
from typing import Dict, List, Any
from datetime import datetime, timezone
from app.core.config import settings
from app.models.keyword import KeywordGroup

logger = logging.getLogger(__name__)

class YouTubeConnector:
    """Real YouTube Data API v3 connector."""
    
    def __init__(self):
        self.api_key = settings.YOUTUBE_API_KEY
        self.base_url = "https://www.googleapis.com/youtube/v3"
        
    def validate_config(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key and self.api_key.strip())
        
    def get_limitations(self) -> str:
        return "Tìm kiếm tối đa 50 video mỗi lần quét (bảo vệ Quota YouTube). Kết quả dựa trên YouTube Data API."

    def search_keywords(self, keywords: List[str], max_results: int = 50) -> List[Dict[str, Any]]:
        """
        Search YouTube videos by keywords using official Data API.
        """
        if not self.validate_config():
            return []
            
        if not keywords:
            return []
            
        # Combine keywords for a single query to save quota
        # e.g., "keyword1" OR "keyword2"
        q = " | ".join([f'"{k}"' for k in keywords])
        
        search_url = f"{self.base_url}/search"
        params = {
            "part": "snippet",
            "q": q,
            "type": "video",
            "maxResults": min(max_results, 50),
            "order": "date",
            "key": self.api_key
        }
        
        try:
            response = requests.get(search_url, params=params, timeout=10)
            if response.status_code == 403:
                error_msg = response.json().get("error", {}).get("message", "")
                if "quotaExceeded" in error_msg:
                    logger.warning("YouTube API Quota Exceeded.")
                    raise Exception("Đã vượt giới hạn YouTube API quota.")
                    
            response.raise_for_status()
            data = response.json()
            
            videos = []
            for item in data.get("items", []):
                vid = item.get("id", {}).get("videoId")
                if not vid:
                    continue
                snippet = item.get("snippet", {})
                
                # Fetch statistics (costs 1 extra quota per batch, but let's just use snippet for now to save quota)
                # We can fetch stats later if needed, for now store None for engagements
                
                videos.append(self.normalize_item(vid, snippet))
                
            return videos
            
        except Exception as e:
            logger.error(f"YouTube search error: {e}")
            raise
            
    def normalize_item(self, video_id: str, snippet: dict) -> Dict[str, Any]:
        """Convert YouTube raw snippet to standard format."""
        return {
            "platform": "youtube",
            "source_type": "social_video",
            "source_id": snippet.get("channelId"),
            "source_name": snippet.get("channelTitle"),
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "title": snippet.get("title", ""),
            "content": snippet.get("description", ""),
            "author": snippet.get("channelTitle"),
            "published_at": snippet.get("publishedAt"),
            "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url")
        }
