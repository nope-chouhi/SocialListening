import re

filepath = "backend/app/api/mentions.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Define caching logic
cache_imports_and_globals = """import time
import json
import hashlib

_MENTIONS_SEARCH_CACHE = {}
"""

if "_MENTIONS_SEARCH_CACHE" not in content:
    content = content.replace("router = APIRouter()", cache_imports_and_globals + "\nrouter = APIRouter()")

# We want to insert the cache checking at the beginning of `list_mentions` inside the try block
old_list_mentions_start = """    import logging
    logger = logging.getLogger(__name__)
    try:
        from sqlalchemy import or_"""

new_list_mentions_start = """    import logging
    logger = logging.getLogger(__name__)
    try:
        # Cache implementation
        cache_key = None
        if q and not job_id:
            try:
                # Create a deterministic key based on search parameters
                params_str = f"{project_id}_{q}_{source_types}_{sentiment}_{date_from}_{date_to}_{page}_{page_size}_{sort_by}"
                cache_key = f"mentions_search:{hashlib.md5(params_str.encode()).hexdigest()}"
                
                # Check redis first
                try:
                    from app.core.config import settings
                    import redis
                    if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
                        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                        cached_val = r.get(cache_key)
                        if cached_val:
                            return json.loads(cached_val)
                except Exception:
                    pass
                
                # Fallback to in-memory cache
                if cache_key in _MENTIONS_SEARCH_CACHE:
                    timestamp, cached_val = _MENTIONS_SEARCH_CACHE[cache_key]
                    if time.time() - timestamp < 60: # 60 seconds TTL
                        return cached_val
            except Exception as e:
                logger.error(f"Cache check error: {e}")

        from sqlalchemy import or_"""

content = content.replace(old_list_mentions_start, new_list_mentions_start)

# We want to cache the return value before returning
old_return = """        total_pages = ceil(total / page_size) if total > 0 else 1

        return {
            "items": result_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }"""

new_return = """        total_pages = ceil(total / page_size) if total > 0 else 1

        response_data = {
            "items": result_items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
        
        if cache_key:
            try:
                # Save to redis
                try:
                    from app.core.config import settings
                    import redis
                    if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
                        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
                        r.setex(cache_key, 60, json.dumps(response_data))
                except Exception:
                    pass
                
                # Save to in-memory cache
                _MENTIONS_SEARCH_CACHE[cache_key] = (time.time(), response_data)
            except Exception as e:
                logger.error(f"Cache set error: {e}")

        return response_data"""

content = content.replace(old_return, new_return)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Backend Cache Fixed.")
