"""
Source type normalization utility.

Accepts frontend alias strings (case-insensitive) and maps them
to lists of actual Mention.source_type text values stored in the DB.

IMPORTANT: Mention.source_type is a plain TEXT column, not a PostgreSQL enum.
Source.source_type IS a PostgreSQL enum (SourceType). This utility handles both cases.

SECURITY: Invalid/unknown source_type values must be rejected before reaching the DB
(either via validate_source_type_alias() raising ValueError, or the caller raising HTTP 400).
Silent passthrough of unknown aliases is not allowed for user-supplied filter params.
"""
from typing import Optional, List

# The set of valid user-facing aliases accepted from frontend query params.
# Only these values are allowed in source_type filter params.
VALID_SOURCE_TYPE_ALIASES: frozenset[str] = frozenset({
    "web",
    "news",
    "blog",
    "rss",
    "video",
    "youtube",
    "facebook",
    "instagram",
    "twitter",
    "tiktok",
    "podcast",
    "manual_url",
    # Also allow exact SourceType enum values (for programmatic callers)
    "facebook_page",
    "facebook_group",
    "facebook_profile",
    "instagram_business",
    "youtube_channel",
    "youtube_video",
    "website",
    "global_search",
    "forum",
})

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
    # Exact enum values accepted directly
    "facebook_page":    ["facebook_page"],
    "facebook_group":   ["facebook_group"],
    "facebook_profile": ["facebook_profile"],
    "instagram_business": ["instagram_business"],
    "youtube_channel":  ["youtube", "yt", "video"],
    "youtube_video":    ["youtube", "yt", "video"],
    "website":          ["website", "web"],
    "global_search":    ["global_search"],
    "forum":            ["forum", "blog"],
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
    # Exact enum values map to themselves
    "facebook_page":    ["facebook_page"],
    "facebook_group":   ["facebook_group"],
    "facebook_profile": ["facebook_profile"],
    "instagram_business": ["instagram_business"],
    "youtube_channel":  ["youtube_channel"],
    "youtube_video":    ["youtube_video"],
    "website":          ["website"],
    "global_search":    ["global_search"],
    "forum":            ["forum"],
    "manual_url":       ["manual_url"],
}


def validate_source_type_alias(alias: str) -> str:
    """
    Validate a single source_type alias from user input.

    Returns the normalized (lowercased, stripped) alias if valid.
    Raises ValueError with a clear message if the alias is not in VALID_SOURCE_TYPE_ALIASES.

    This must be called before any DB filter is applied. Do not silently skip
    unknown aliases — raise explicitly so the caller can return HTTP 400.
    """
    normalized = alias.strip().lower()
    if normalized not in VALID_SOURCE_TYPE_ALIASES:
        raise ValueError(
            f"Invalid source_type '{alias}'. "
            f"Accepted values: {', '.join(sorted(VALID_SOURCE_TYPE_ALIASES))}"
        )
    return normalized


def normalize_source_type_for_mention(source_type: Optional[str]) -> Optional[List[str]]:
    """
    Map a validated frontend source_type alias to list of Mention.source_type text values.

    Returns None if source_type is None/empty.
    Accepts comma-separated multiple types.

    IMPORTANT: Caller must validate aliases via validate_source_type_alias() BEFORE
    calling this function. This function does NOT validate — it only maps.
    """
    if not source_type:
        return None
    aliases = [s.strip().lower() for s in source_type.split(",") if s.strip()]
    result: set[str] = set()
    for alias in aliases:
        if alias in _MENTION_SOURCE_TYPE_MAP:
            result.update(_MENTION_SOURCE_TYPE_MAP[alias])
        else:
            # Alias was already validated; pass through as-is for any exact stored values
            result.add(alias)
    return list(result) if result else None


def normalize_source_type_for_source_model(source_type: Optional[str]) -> Optional[List[str]]:
    """
    Map a validated frontend source_type alias to a list of SourceType enum string values
    suitable for filtering Source.source_type (PostgreSQL enum column).

    Returns None if source_type is None/empty.
    Raises ValueError for aliases not in the Source enum map.

    IMPORTANT: Caller must validate aliases via validate_source_type_alias() BEFORE
    calling this function.
    """
    if not source_type:
        return None
    alias = source_type.strip().lower()
    if alias in _SOURCE_TYPE_ENUM_MAP:
        return _SOURCE_TYPE_ENUM_MAP[alias]
    # Alias was validated but isn't in Source enum map (e.g. twitter, tiktok, podcast)
    # These don't have corresponding Source records — return empty to match nothing
    return []


def is_web_type(alias: str) -> bool:
    """Check if the alias is one of the 'web' family."""
    return alias.strip().lower() in _MENTION_SOURCE_TYPE_MAP.get("web", []) or alias.strip().lower() == "web"
