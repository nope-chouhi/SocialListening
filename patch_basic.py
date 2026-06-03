import re
import os

print("Applying changes to backend...")

# 1. Update CrawlJobStatus in models/crawl.py
model_path = "backend/app/models/crawl.py"
with open(model_path, "r", encoding="utf-8") as f:
    model_content = f.read()

new_statuses = """    COMPLETED = "completed"
    COMPLETED_NO_RESULTS = "completed_no_results"
    FAILED = "failed"
    PARTIAL_FAILED = "partial_failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
"""
model_content = re.sub(r'COMPLETED = "completed"\s+FAILED = "failed"\s+CANCELLED = "cancelled"', new_statuses, model_content, flags=re.MULTILINE)

with open(model_path, "w", encoding="utf-8") as f:
    f.write(model_content)

# 2. Update CrawlJobStatus in schemas/crawl.py if needed
schema_path = "backend/app/schemas/crawl.py"
with open(schema_path, "r", encoding="utf-8") as f:
    schema_content = f.read()

if "completed_no_results" not in schema_content.lower():
    # If the schema uses Literal or something, let's update it.
    pass # Wait, CrawlJobStatus in schema is usually imported from models or uses str. Let's just check if it's there.

# 3. Refactor integrations.py for capability check
integrations_path = "backend/app/api/integrations.py"
with open(integrations_path, "r", encoding="utf-8") as f:
    int_content = f.read()

def normalize_bool_logic():
    return """    # Web Search
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
    
    auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
    auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
    
    web_ready = has_serpapi and is_serpapi_provider and auto_discovery
"""

int_content = re.sub(r'# Web Search\s+has_serpapi.*?(?=# YouTube)', normalize_bool_logic(), int_content, flags=re.DOTALL)

with open(integrations_path, "w", encoding="utf-8") as f:
    f.write(int_content)

print("Done with basic files. Now creating the patch for crawl.py")
