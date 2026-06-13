"""Production Smoke Test"""
import sys
import warnings
import time
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
from app.models.user import User
from sqlalchemy import select

client = TestClient(app, raise_server_exceptions=False)
db = SessionLocal()

print("Bắt đầu chạy Production Smoke Test...\n")

results = []

def run_test(endpoint_name, test_func):
    try:
        status, response_time, error = test_func()
        results.append({
            "Endpoint": endpoint_name,
            "Status": "✅ PASS" if status else "❌ FAIL",
            "Time": f"{response_time:.2f}s",
            "Details": error or "OK"
        })
    except Exception as e:
        results.append({
            "Endpoint": endpoint_name,
            "Status": "❌ ERROR",
            "Time": "0s",
            "Details": str(e)
        })

# 1. Setup Auth
existing = db.execute(select(User).where(User.email == "smoke_prod@test.com")).scalar_one_or_none()
if not existing:
    from app.core.security import get_password_hash
    u = User(email="smoke_prod@test.com", hashed_password=get_password_hash("Test1234!"), full_name="Smoke", is_active=True, role="admin")
    db.add(u)
    db.commit()

token = ""
headers = {}

def test_auth():
    global token, headers
    start = time.time()
    resp = client.post("/api/auth/login", data={"username": "smoke_prod@test.com", "password": "Test1234!"})
    dur = time.time() - start
    if resp.status_code == 200:
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        return True, dur, None
    return False, dur, f"Code {resp.status_code}"

run_test("POST /api/auth/login", test_auth)

project_id = None

def test_projects():
    global project_id
    start = time.time()
    resp = client.get("/api/project", headers=headers)
    dur = time.time() - start
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            project_id = data[0]["id"]
            return True, dur, f"{len(data)} projects"
        else:
            return False, dur, "No projects found"
    return False, dur, f"Code {resp.status_code}"

run_test("GET /api/project", test_projects)

def test_mentions():
    start = time.time()
    params = {}
    if project_id: params["project_id"] = project_id
    resp = client.get("/api/mentions", params=params, headers=headers)
    dur = time.time() - start
    if resp.status_code == 200:
        data = resp.json()
        return True, dur, f"{data['total']} mentions"
    return False, dur, f"Code {resp.status_code}"

run_test("GET /api/mentions", test_mentions)

def test_dashboard():
    start = time.time()
    params = {"time_range": "30d"}
    if project_id: params["project_id"] = project_id
    resp = client.get("/api/dashboard/summary", params=params, headers=headers)
    dur = time.time() - start
    if resp.status_code == 200:
        return True, dur, "Summary loaded"
    return False, dur, f"Code {resp.status_code}"

run_test("GET /api/dashboard/summary", test_dashboard)

def test_keywords():
    start = time.time()
    resp = client.get("/api/keywords/groups", headers=headers)
    dur = time.time() - start
    if resp.status_code == 200:
        return True, dur, "Keywords loaded"
    return False, dur, f"Code {resp.status_code}"

run_test("GET /api/keywords/groups", test_keywords)

def test_alerts():
    start = time.time()
    resp = client.get("/api/alerts", headers=headers)
    dur = time.time() - start
    if resp.status_code == 200:
        return True, dur, "Alerts loaded"
    return False, dur, f"Code {resp.status_code}"

run_test("GET /api/alerts", test_alerts)

db.close()

# Print Table
col_widths = [25, 10, 8, 40]
print(f"{'Endpoint'.ljust(col_widths[0])} | {'Status'.ljust(col_widths[1])} | {'Time'.ljust(col_widths[2])} | {'Details'.ljust(col_widths[3])}")
print("-" * (sum(col_widths) + 9))
for r in results:
    print(f"{r['Endpoint'].ljust(col_widths[0])} | {r['Status'].ljust(col_widths[1])} | {r['Time'].ljust(col_widths[2])} | {r['Details'].ljust(col_widths[3])}")
