import psycopg2

try:
    conn = psycopg2.connect('postgresql://social_listening_db_v2_user:6F6oJaZmFDi5xIDGd4lvALUkQIpsxVkQ@dpg-d7vfpv3rjlhs73dnrgf0-a.oregon-postgres.render.com/social_listening_db_v2?sslmode=require')
    cur = conn.cursor()
    cur.execute("SELECT id, email, is_active FROM users WHERE email='honguyenhung2010@gmail.com'")
    result = cur.fetchall()
    if result:
        print("User found:", result)
        # Force set password for this user using bcrypt
        import bcrypt
        hashed = bcrypt.hashpw('Hungnguyen@1515'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET hashed_password=%s WHERE id=%s", (hashed, result[0][0]))
        conn.commit()
        print("Password reset to Hungnguyen@1515 successfully!")
    else:
        print("User NOT found in database!")
except Exception as e:
    print("Error:", e)
