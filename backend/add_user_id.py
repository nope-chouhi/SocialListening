import sqlite3
import os

db_path = 'nope.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = [
    "keyword_groups",
    "source_groups",
    "sources",
    "mentions",
    "crawl_jobs",
    "scan_schedules",
    "alerts",
    "incidents"
]

for table in tables:
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER")
        print(f"Added user_id to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column user_id already exists in {table}")
        else:
            print(f"Error adding user_id to {table}: {e}")

conn.commit()
conn.close()
print("Done")
