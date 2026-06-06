import requests
import time
import io
import sys
import json

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

base_url = 'https://social-listening-backend.onrender.com/api'

def safe_print(*args):
    try:
        print(*args)
    except UnicodeEncodeError:
        text = ' '.join(str(a) for a in args)
        print(text.encode('ascii', errors='replace').decode('ascii'))

def login():
    res = requests.post(f"{base_url}/auth/login", data={'username': 'test1234@example.com', 'password': 'Password123!'})
    if res.status_code == 200:
        token = res.json().get('access_token')
        safe_print("Login OK")
        return token
    safe_print(f"Login failed: {res.status_code} {res.text[:200]}")
    sys.exit(1)

def get_context(token):
    """Get or create a valid project_id (= KeywordGroup.id) for this user"""
    h = {'Authorization': f'Bearer {token}'}
    
    # Get /auth/me
    me = requests.get(f"{base_url}/auth/me", headers=h)
    if me.status_code == 200:
        user = me.json()
        safe_print(f"User: id={user.get('id')} email={user.get('email')} role={user.get('role')}")
    
    # Try to get existing keyword groups
    for path in ['/keywords/groups', '/keywords/groups/', '/keywords/groups?limit=10']:
        r = requests.get(f"{base_url}{path}", headers=h)
        if r.status_code == 200:
            data = r.json()
            groups = data if isinstance(data, list) else data.get('items', data.get('groups', []))
            if groups:
                pid = groups[0].get('id')
                safe_print(f"KeywordGroup found: id={pid} name='{groups[0].get('name')}'")
                return pid
            break  # endpoint works but no groups yet
    
    # Create a KeywordGroup for this user
    safe_print("No keyword groups found, creating one...")
    r = requests.post(f"{base_url}/keywords/groups", json={
        'name': 'Test Group',
        'description': 'Auto-created for production testing'
    }, headers={**h, 'Content-Type': 'application/json'})
    if r.status_code in (200, 201):
        pid = r.json().get('id')
        safe_print(f"Created KeywordGroup id={pid}")
        return pid
    safe_print(f"Create group failed: {r.status_code} {r.text[:200]}")
    
    safe_print("Fallback: using project_id=1")
    return 1


def run_test(q, token, project_id):
    h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    safe_print(f"\n{'='*55}")
    safe_print(f"Query: '{q}'  |  project_id={project_id}")
    safe_print(f"{'='*55}")
    
    # Before count
    r = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'page': 1, 'page_size': 1}, headers=h)
    before = r.json().get('total', 'N/A') if r.status_code == 200 else f"Err{r.status_code}"
    safe_print(f"  Before: {before} mentions")

    # Trigger scan
    scan_res = requests.post(f"{base_url}/crawl/manual-scan", json={
        'project_id': project_id,
        'query': q,
        'source_types': ['web', 'youtube', 'news'],
        'expand_keywords': True,
        'mode': 'AUTO_DISCOVERY',
        'max_results': 10
    }, headers=h)
    
    if scan_res.status_code != 200:
        safe_print(f"  Scan error {scan_res.status_code}: {scan_res.text[:300]}")
        return
    
    sd = scan_res.json()
    job_id = sd.get('job_id')
    safe_print(f"  Job ID: {job_id}")
    safe_print(f"  Keywords: {sd.get('keywords', [])}")
    safe_print(f"  Status: {sd.get('status')}")
    if sd.get('message'):
        safe_print(f"  Message: {sd.get('message')}")
    
    # Poll
    start = time.time()
    while True:
        if time.time() - start > 200:
            safe_print("  => TIMEOUT 200s")
            break
        jr = requests.get(f"{base_url}/crawl/jobs/{job_id}", headers=h)
        if jr.status_code != 200:
            safe_print(f"  Poll error {jr.status_code}")
            break
        jd = jr.json()
        status = jd.get('status', '').lower()
        safe_print(f"  Polling... {status}")
        if status not in ['queued', 'pending', 'running']:
            s = jd.get('summary', {})
            safe_print(f"  STATUS:        {status}")
            safe_print(f"  Keywords:      {jd.get('keywords', [])}")
            safe_print(f"  Adapters:      {s.get('adapters_ready', [])}")
            safe_print(f"  SerpAPI raw:   {s.get('serpapi_result_count', 'N/A')}")
            safe_print(f"  New mentions:  {s.get('new_mentions_created', 'N/A')}")
            safe_print(f"  Dupes:         {s.get('duplicates_skipped', 'N/A')}")
            safe_print(f"  Errors:        {s.get('errors', [])}")
            web = s.get('web', {})
            if web:
                safe_print(f"  [web]  provider={web.get('provider')} raw={web.get('raw_results_count')} new={web.get('mentions_created')} dupes={web.get('duplicates_skipped')}")
            yt = s.get('youtube', {})
            if yt:
                safe_print(f"  [yt]   raw={yt.get('raw_results_count')} new={yt.get('mentions_created')} dupes={yt.get('duplicates_skipped')}")
            
            # Count by job_id
            r2 = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'job_id': job_id, 'page': 1, 'page_size': 1}, headers=h)
            job_count = r2.json().get('total', 'N/A') if r2.status_code == 200 else f"Err{r2.status_code}"
            safe_print(f"  API mentions (job_id={job_id}): {job_count}")
            
            # Total after
            r3 = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'page': 1, 'page_size': 1}, headers=h)
            after = r3.json().get('total', 'N/A') if r3.status_code == 200 else f"Err{r3.status_code}"
            safe_print(f"  After total:   {after}")
            delta = (after - before) if isinstance(after, int) and isinstance(before, int) else 'N/A'
            safe_print(f"  Delta:         {delta}")
            break
        time.sleep(5)

if __name__ == '__main__':
    token = login()
    
    # Worker check
    r = requests.get(f"{base_url}/crawl/worker-status", headers={'Authorization': f'Bearer {token}'})
    if r.status_code == 200:
        w = r.json()
        safe_print(f"Worker: running={w.get('scheduler_running')} active_sources={w.get('active_sources')} running_jobs={w.get('running_jobs')}")
    
    project_id = get_context(token)
    safe_print(f"=> Using project_id={project_id}")
    
    run_test('Shopee', token, project_id)
    run_test('Vinamilk', token, project_id)
    run_test('TTH', token, project_id)
    
    safe_print("\n=== CACHE TEST: Shopee lần 2 (expect dedup hoặc new job) ===")
    run_test('Shopee', token, project_id)
