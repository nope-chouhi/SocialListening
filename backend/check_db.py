import os
from app.core.database import SessionLocal
from app.models.keyword import Keyword, KeywordGroup

db = SessionLocal()
groups = db.query(KeywordGroup).all()
for g in groups:
    kws = db.query(Keyword).where(Keyword.group_id == g.id).all()
    print(f"Group: {g.name} (ID: {g.id}), Keywords count: {len(kws)}")
    for k in kws:
        print(f"  - [{k.id}] {k.keyword} (Type: {k.keyword_type})")
