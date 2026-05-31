"""Final Production Smoke Test"""
import sys, warnings
sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings("ignore")

import passlib.handlers.bcrypt as _bcrypt_mod
try:
    import bcrypt
    _bcrypt_mod._bcrypt = bcrypt
except:
    pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.keyword import KeywordGroup, Keyword
from app.models.source import Source
from app.models.user import User
from sqlalchemy import select

client = TestClient(app, raise_server_exceptions=False)
db = SessionLocal()

print("=" * 60)
print("FINAL PRODUCTION SMOKE TEST")
print("=" * 60)

# Create user if not exists
existing = db.execute(select(User).where(User.email == "smoke_prod@test.com")).scalar_one_or_none()
if not existing:
    from app.core.security import get_password_hash
    u = User(email="smoke_prod@test.com", hashed_password=get_password_hash("Test1234!"), full_name="Smoke", is_active=True, role="admin")
    db.add(u)
    db.commit()

# Get auth token
login_resp = client.post("/api/auth/login", data={"username": "smoke_prod@test.com", "password": "Test1234!"})
token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 1. Create Keyword Group & Keyword
print("1. Creating Keyword...")
kw_group_resp = client.post("/api/keywords/groups", json={
    "name": "Smoke Test",
    "description": "Smoke test keyword group"
}, headers=headers)
kw_group_id = kw_group_resp.json()["id"]

kw_resp = client.post("/api/keywords", json={
    "group_id": kw_group_id,
    "keyword": "Thế giới", # High chance of hitting VnExpress RSS
    "match_type": "exact"
}, headers=headers)
if kw_resp.status_code not in (200, 201):
    print(f"   FAIL: Keyword create failed: {kw_resp.status_code} {kw_resp.text}")
kw_id = kw_resp.json()["id"]
print(f"   Created group ID {kw_group_id}, keyword ID {kw_id}")

# 2. Create RSS Source
print("2. Creating RSS Source...")
source_resp = client.post("/api/sources", json={
    "name": "Smoke Test Source",
    "url": "https://vnexpress.net/rss/tin-moi-nhat.rss",
    "source_type": "rss",
    "crawl_frequency": "manual"
}, headers=headers)
if source_resp.status_code == 409:
    existing_source = db.execute(select(Source).where(Source.url == "https://vnexpress.net/rss/tin-moi-nhat.rss")).scalars().first()
    source_id = existing_source.id
else:
    source_id = source_resp.json()["id"]
print(f"   Created source ID {source_id}")

# 3. Run Manual Scan
print("3. Running Manual Scan...")
scan_resp = client.post("/api/crawl/manual-scan", json={
    "keyword_group_ids": [kw_group_id],
    "source_ids": [source_id]
}, headers=headers)
scan_result = scan_resp.json()
print(f"   Scan result: {scan_result.get('message', 'No message')}")
print(f"   Mentions found: {scan_result.get('mentions_found', 0)}")
print(f"   Mentions created: {scan_result.get('mentions_created', 0)}")
job_id = scan_result.get('job_id')

# 4. Confirm crawl_job created
print("4. Checking Crawl Jobs...")
jobs_resp = client.get("/api/crawl/jobs", headers=headers)
jobs = jobs_resp.json()["items"]
found_job = next((j for j in jobs if j["id"] == job_id), None)
if found_job:
    print(f"   Job {job_id} exists. Status: {found_job['status']}")
else:
    print(f"   FAIL: Job {job_id} not found in API")

# 5. Confirm real mention created if matched
print("5. Checking Mentions Page Data...")
mentions_resp = client.get("/api/mentions", headers=headers)
mentions_data = mentions_resp.json()
total_mentions = mentions_data["total"]
print(f"   Total mentions: {total_mentions}")
if total_mentions > 0:
    first_mention = mentions_data["items"][0]
    print(f"   Latest Mention Title: {first_mention['title'][:60]}")
    print(f"   Matched Keywords: {first_mention['matched_keywords']}")
    ai_status = first_mention.get('ai_analysis', {}).get('ai_provider')
    print(f"   AI Provider: {ai_status}")

# 6. Confirm dashboard updates
print("6. Checking Dashboard Data...")
dash_resp = client.get("/api/dashboard/summary", headers=headers)
dash_data = dash_resp.json()
print(f"   Dashboard Mentions Today: {dash_data['mentions_today']}")
print(f"   Dashboard Total Mentions: {dash_data['total_mentions']}")

# 7. Clean check
print("7. Checking for fake content...")
clean = True
for key in ['title', 'content']:
    for m in mentions_data.get('items', []):
        text = str(m.get(key, '')).lower()
        for word in ["giả lập", "simulated", "fake", "demo"]:
            if word in text:
                print(f"   FAIL: '{word}' found in mention {m['id']}")
                clean = False
if clean:
    print("   PASS: No fake content found in any mentions.")

db.close()
print("=" * 60)
