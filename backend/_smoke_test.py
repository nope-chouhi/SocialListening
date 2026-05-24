"""Production API smoke test v2 — uses existing DB user."""
import sys, os, warnings
sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings("ignore")

# Fix passlib bcrypt issue
import passlib.handlers.bcrypt as _bcrypt_mod
try:
    import bcrypt
    _bcrypt_mod._bcrypt = bcrypt
except:
    pass

from fastapi.testclient import TestClient
from app.core.database import engine, Base, SessionLocal
from sqlalchemy import select, text
Base.metadata.create_all(bind=engine)

from app.main import app
client = TestClient(app, raise_server_exceptions=False)

print("=" * 60)
print("PRODUCTION API VERIFICATION")
print("=" * 60)

# Check if any user exists
db = SessionLocal()
from app.models.user import User
user = db.execute(select(User).limit(1)).scalar_one_or_none()
db.close()

if not user:
    # Create user directly in DB
    from app.core.security import get_password_hash
    db = SessionLocal()
    u = User(email="smoke@test.com", hashed_password=get_password_hash("Test1234!"), full_name="Smoke", is_active=True, role="admin")
    db.add(u)
    db.commit()
    db.close()
    print("Created test user")

# Login
login_resp = client.post("/api/auth/login", data={"username": user.email if user else "smoke@test.com", "password": "Test1234!"})
if login_resp.status_code != 200:
    # Try all possible test passwords
    for pwd in ["Admin1234!", "admin123", "password", "test1234"]:
        login_resp = client.post("/api/auth/login", data={"username": user.email, "password": pwd})
        if login_resp.status_code == 200:
            break

if login_resp.status_code != 200:
    print(f"Cannot login (status {login_resp.status_code}). Creating fresh user...")
    from app.core.security import get_password_hash
    db = SessionLocal()
    # Check if smoke user already exists
    existing = db.execute(select(User).where(User.email == "smoke_prod@test.com")).scalar_one_or_none()
    if not existing:
        u = User(email="smoke_prod@test.com", hashed_password=get_password_hash("Test1234!"), full_name="Smoke", is_active=True, role="admin")
        db.add(u)
        db.commit()
    db.close()
    login_resp = client.post("/api/auth/login", data={"username": "smoke_prod@test.com", "password": "Test1234!"})

if login_resp.status_code != 200:
    print(f"FATAL: Cannot login. {login_resp.status_code} {login_resp.text[:200]}")
    sys.exit(1)

token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Auth: OK")
print()

# Test each endpoint
endpoints = [
    ("GET", "/health"),
    ("GET", "/api/dashboard/summary"),
    ("GET", "/api/dashboard/trends?range=7d"),
    ("GET", "/api/dashboard/sentiment-summary?range=7d"),
    ("GET", "/api/dashboard/latest-mentions?limit=10"),
    ("GET", "/api/dashboard/latest-alerts?limit=10"),
    ("GET", "/api/dashboard/sidebar-badges"),
    ("GET", "/api/dashboard/hot-keywords?range=today"),
    ("GET", "/api/mentions"),
    ("GET", "/api/crawl/jobs"),
    ("GET", "/api/crawl/worker-status"),
    ("GET", "/api/sources"),
    ("GET", "/api/keywords/groups"),
    ("GET", "/api/alerts"),
]

all_pass = True
for method, path in endpoints:
    hdrs = None if path == "/health" else headers
    resp = client.get(path, headers=hdrs)
    status = resp.status_code
    body = resp.text[:200]

    has_error = "sqlalchemy" in body.lower() or "operationalerror" in body.lower() or "traceback" in body.lower()

    if status == 200 and not has_error:
        # Show key data
        try:
            j = resp.json()
            if isinstance(j, dict):
                keys = list(j.keys())[:5]
                print(f"  PASS  {status}  {path:50s}  keys={keys}")
            elif isinstance(j, list):
                print(f"  PASS  {status}  {path:50s}  items={len(j)}")
            else:
                print(f"  PASS  {status}  {path:50s}")
        except:
            print(f"  PASS  {status}  {path:50s}")
    else:
        print(f"  FAIL  {status}  {path:50s}")
        print(f"        {body}")
        all_pass = False

print()

# Check AI provider status
ai_provider = os.getenv("AI_PROVIDER", "dummy")
openai_key = os.getenv("OPENAI_API_KEY", "")
gemini_key = os.getenv("GEMINI_API_KEY", "")
print(f"AI Provider: {ai_provider}")
print(f"OpenAI key configured: {bool(openai_key)}")
print(f"Gemini key configured: {bool(gemini_key)}")
print()

# Check for fake words in responses
print("Checking for fake/simulated content...")
clean = True
for path in ["/api/dashboard/summary", "/api/mentions"]:
    resp = client.get(path, headers=headers)
    body = resp.text.lower()
    for word in ["giả lập", "simulated", "fake mention", "demo mention"]:
        if word in body:
            print(f"  WARN: '{word}' found in {path}")
            clean = False

if clean:
    print("  No fake/simulated content detected")

print()
if all_pass:
    print("=== ALL API CHECKS PASSED ===")
else:
    print("=== SOME CHECKS FAILED ===")
