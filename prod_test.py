import requests
import time
import sys
import json
import io
import sys

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

base_url = 'https://social-listening-backend.onrender.com/api'
headers = {
    'Authorization': 'Bearer test-or-fetch-token',
    'Content-Type': 'application/json'
}

def safe_print(*args):
    try:
        print(*args)
    except UnicodeEncodeError:
        text = ' '.join(str(a) for a in args)
        print(text.encode('ascii', errors='replace').decode('ascii'))

def login():
    res = requests.post(f"{base_url}/auth/login", data={'username': 'test1234@example.com', 'password': 'Password123!'})
    if res.status_code == 200:
        return res.json().get('access_token')
    else:
        print(f"Login failed: {res.status_code} {res.text[:200]}")
        sys.exit(1)

def get_project_id(token):
    """Get the first project_id belonging to this user/tenant"""
    r = requests.get(f"{base_url}/projects/", headers={'Authorization': f'Bearer {token}'})
    if r.status_code == 200:
        data = r.json()
        projects = data if isinstance(data, list) else data.get('items', [])
        if projects:
            pid = projects[0].get('id')
            safe_print(f"  Using project_id={pid} (name='{projects[0].get('name')}')")
            return pid
    safe_print(f"  Could not get project: {r.status_code} {r.text[:200]}")
    return 1

def run_test(q, token, project_id):
    headers['Authorization'] = f'Bearer {token}'
    safe_print(f"\n{'='*50}")
    safe_print(f"Testing: '{q}' (project_id={project_id})")
    safe_print(f"{'='*50}")
    
    # 1. Count total mentions before scan
    r = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'page': 1, 'page_size': 1}, headers=headers)
    before_count = r.json().get('total', 'N/A') if r.status_code == 200 else f"Err{r.status_code}"
    safe_print(f"  Mentions before (project total): {before_count}")

    # 2. Trigger scan
    scan_payload = {
        'project_id': project_id,
        'query': q,
        'source_types': ['web', 'youtube', 'news'],
        'expand_keywords': True,
        'mode': 'AUTO_DISCOVERY',
        'max_results': 10
    }
    scan_res = requests.post(f"{base_url}/crawl/manual-scan", json=scan_payload, headers=headers)
    if scan_res.status_code != 200:
        safe_print(f"  Scan error {scan_res.status_code}: {scan_res.text[:300]}")
        return
        
    scan_data = scan_res.json()
    job_id = scan_data.get('job_id')
    safe_print(f"  Job ID: {job_id}")
    safe_print(f"  Expanded keywords: {scan_data.get('keywords', [])}")
    safe_print(f"  Initial Status: {scan_data.get('status')}")
    
    if scan_data.get('message') == 'Returned existing running job to prevent duplicate crawl':
        safe_print(f"  => DEDUP: Returning existing job. Tracking that job.")
    
    # 3. Poll to completion
    start = time.time()
    while True:
        if time.time() - start > 200:
            safe_print("  => TIMEOUT after 200s")
            break
        job_res = requests.get(f"{base_url}/crawl/jobs/{job_id}", headers=headers)
        if job_res.status_code != 200:
            safe_print(f"  Poll error {job_res.status_code}")
            break
        job_data = job_res.json()
        status = job_data.get('status', '').lower()
        safe_print(f"  Polling... Status: {status}")
        if status not in ['queued', 'pending', 'running']:
            summary = job_data.get('summary', {})
            meta_kws = job_data.get('keywords', [])
            safe_print(f"  Final Status:         {status}")
            safe_print(f"  Keywords (meta):      {meta_kws}")
            safe_print(f"  Adapters:             {summary.get('adapters_ready', [])}")
            safe_print(f"  SerpAPI raw results:  {summary.get('serpapi_result_count', 'N/A')}")
            safe_print(f"  New mentions:         {summary.get('new_mentions_created', 'N/A')}")
            safe_print(f"  Duplicates skipped:   {summary.get('duplicates_skipped', 'N/A')}")
            safe_print(f"  Errors:               {summary.get('errors', [])}")
            web = summary.get('web', {})
            if web:
                safe_print(f"  [web]   provider={web.get('provider')} raw={web.get('raw_results_count')} created={web.get('mentions_created')} dupes={web.get('duplicates_skipped')} err={web.get('error')}")
            yt = summary.get('youtube', {})
            if yt:
                safe_print(f"  [yt]    raw={yt.get('raw_results_count')} created={yt.get('mentions_created')} dupes={yt.get('duplicates_skipped')} err={yt.get('error')}")
            
            # Count mentions by job
            r2 = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'job_id': job_id, 'page': 1, 'page_size': 1}, headers=headers)
            job_count = r2.json().get('total', 'N/A') if r2.status_code == 200 else f"Err{r2.status_code}"
            safe_print(f"  Mentions via job_id API:  {job_count}")
            
            # Count total after
            r3 = requests.get(f"{base_url}/mentions", params={'project_id': project_id, 'page': 1, 'page_size': 1}, headers=headers)
            after_count = r3.json().get('total', 'N/A') if r3.status_code == 200 else f"Err{r3.status_code}"
            safe_print(f"  Project total after:  {after_count}")
            delta = (after_count - before_count) if isinstance(after_count, int) and isinstance(before_count, int) else 'N/A'
            safe_print(f"  Delta:                {delta}")
            break
        time.sleep(5)

if __name__ == '__main__':
    token = login()
    
    r = requests.get(f"{base_url}/crawl/worker-status", headers={'Authorization': f'Bearer {token}'})
    if r.status_code == 200:
        safe_print(f"Worker: {r.json()}")
    
    project_id = get_project_id(token)
    
    run_test('Shopee', token, project_id)
    run_test('Vinamilk', token, project_id)
    run_test('TTH', token, project_id)
    
    safe_print("\n=== CACHE TEST: Shopee again (expect DEDUP) ===")
    run_test('Shopee', token, project_id)
