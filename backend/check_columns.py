import sqlite3

def check_missing_user_id():
    conn = sqlite3.connect('nope.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    
    missing = []
    has = []
    
    for t in tables:
        cursor.execute(f"PRAGMA table_info({t})")
        columns = [r[1] for r in cursor.fetchall()]
        if 'user_id' not in columns:
            missing.append(t)
        else:
            has.append(t)
            
    print("Tables WITH user_id:", has)
    print("Tables WITHOUT user_id:", missing)

if __name__ == '__main__':
    check_missing_user_id()
