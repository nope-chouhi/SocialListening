"""
Source type normalization utility.

Accepts frontend alias strings (case-insensitive) and maps them
to lists of actual Mention.source_type text values stored in the DB.

IMPORTANT: Mention.source_type is a plain TEXT column, not a PostgreSQL enum.
Source.source_type IS a PostgreSQL enum (SourceType). This utility handles both cases.
"""
from typing import Optional, List

# Frontend alias → list of backend Mention.source_type text values
_MENTION_SOURCE_TYPE_MAP: dict[str, list[str]] = {
    "web":      ["web", "website", "web_search", "article", "unknown", "global_search"],
    "news":     ["news", "newspaper", "article_news"],
    "blog":     ["blog", "forum", "blogs_forums", "blogs/forums"],
    "rss":      ["rss", "feed", "rss_feed"],
    "video":    ["video", "videos", "youtube", "yt"],
    "youtube":  ["video", "videos", "youtube", "yt"],
    "facebook": ["facebook", "facebook_page", "facebook_group", "facebook_profile"],
    "instagram": ["instagram", "instagram_business"],
    "twitter":  ["twitter"],
    "tiktok":   ["tiktok"],
    "podcast":  ["podcast"],
    "manual_url": ["manual_url"],
}

# Frontend alias → actual SourceType enum value(s) for Source.source_type
_SOURCE_TYPE_ENUM_MAP: dict[str, list[str]] = {
    "web":       ["website", "global_search", "manual_url"],
    "news":      ["news"],
    "blog":      ["forum"],
    "rss":       ["rss"],
    "video":     ["youtube_channel", "youtube_video"],
    "youtube":   ["youtube_channel", "youtube_video"],
    "facebook":  ["facebook_page", "facebook_group", "facebook_profile"],
    "instagram": ["instagram_business"],
}

_KNOWN_ALIASES = set(_MENTION_SOURCE_TYPE_MAP.keys()) | {
    "facebook_page", "facebook_group", "facebook_profile",
    "instagram_business", "youtube_channel", "youtube_video",
    "website", "global_search", "manual_url", "rss", "forum",
}


def normalize_source_type_for_mention(source_type: Optional[str]) -> Optional[List[str]]:
    """
    Map a frontend source_type alias to list of Mention.source_type text values.
    Returns None if source_type is None/empty.
    Accepts comma-separated multiple types.
    """
    if not source_type:
        return None
    aliases = [s.strip().lower() for s in source_type.split(",") if s.strip()]
    result: set[str] = set()
    for alias in aliases:
        if alias in _MENTION_SOURCE_TYPE_MAP:
            result.update(_MENTION_SOURCE_TYPE_MAP[alias])
        else:
            # Pass through unknown aliases as-is (maybe actual stored value)
            result.add(alias)
    return list(result) if result else None


def normalize_source_type_for_source_model(source_type: Optional[str]) -> Optional[List[str]]:
    """
    Map a frontend source_type alias to a list of SourceType enum string values
    suitable for filtering Source.source_type (PostgreSQL enum column).
    Returns None if source_type is None/empty.
    Raises ValueError for completely unknown types.
    """
    if not source_type:
        return None
    alias = source_type.strip().lower()
    if alias in _SOURCE_TYPE_ENUM_MAP:
        return _SOURCE_TYPE_ENUM_MAP[alias]
    # If the alias is already a valid enum value, accept it directly
    valid_enum_values = {
        "facebook_page", "facebook_group", "facebook_profile",
        "instagram_business", "youtube_channel", "youtube_video",
        "website", "news", "rss", "forum", "manual_url", "global_search"
    }
    if alias in valid_enum_values:
        return [alias]
    raise ValueError(f"Unknown source type: '{source_type}'")


def is_web_type(alias: str) -> bool:
    """Check if the alias is one of the 'web' family."""
    return alias.strip().lower() in _MENTION_SOURCE_TYPE_MAP.get("web", []) or alias.strip().lower() == "web"
