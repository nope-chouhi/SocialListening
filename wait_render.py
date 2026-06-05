import requests
import time

base_url = 'https://social-listening-backend.onrender.com/api'

# 1. Login
data = {'username': 'test1234@example.com', 'password': 'Password123!'}
res = requests.post(f"{base_url}/auth/login", data=data)
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)
token = res.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

project_id = 1

while True:
    scan_payload = {
        'project_id': project_id,
        'query': 'poll',
        'source_types': ['web'],
        'expand_keywords': False,
        'mode': 'AUTO_DISCOVERY',
        'max_results': 1
    }
    scan_res = requests.post(f"{base_url}/crawl/manual-scan", json=scan_payload, headers=headers)
    if 'has no attribute' not in scan_res.text:
        print("Backend updated! Response:", scan_res.text)
        break
    print("Waiting for deployment...")
    time.sleep(10)
