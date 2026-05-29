import sqlite3
import os

db_path = 'social_listening.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

columns = [
    ("urgency", "VARCHAR(50)"),
    ("response_type", "VARCHAR(100)"),
    ("recommended_owner", "VARCHAR(100)"),
    ("deadline_suggestion", "VARCHAR(100)"),
    ("escalation_needed", "BOOLEAN DEFAULT 0"),
    ("why_it_matters", "TEXT")
]

for col_name, col_type in columns:
    try:
        cursor.execute(f"ALTER TABLE ai_analysis ADD COLUMN {col_name} {col_type}")
        print(f"Added {col_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column {col_name} already exists")
        else:
            print(f"Error adding {col_name}: {e}")

conn.commit()
conn.close()
print("Done")
