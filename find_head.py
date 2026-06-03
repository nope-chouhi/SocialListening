import os
import re

versions_dir = "backend/alembic/versions"
files = [f for f in os.listdir(versions_dir) if f.endswith(".py")]

revisions = {}
down_revisions = set()

for file in files:
    with open(os.path.join(versions_dir, file), "r", encoding="utf-8") as f:
        content = f.read()
        
        rev_match = re.search(r"revision\s*=\s*['\"]([^'\"]+)['\"]", content)
        rev = rev_match.group(1) if rev_match else None
        
        # Match strings or tuples
        down_rev_line = re.search(r"down_revision\s*=\s*(.*)", content)
        if down_rev_line:
            val = down_rev_line.group(1).strip()
            # extract all strings in quotes
            down_revs = re.findall(r"['\"]([^'\"]+)['\"]", val)
            for dr in down_revs:
                down_revisions.add(dr)
        
        if rev:
            revisions[rev] = file

heads = [r for r in revisions.keys() if r not in down_revisions]
print("HEADS:", heads)
