import re

file_path = "backend/app/services/social_crawler_service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'self.user_agent = "SocialListeningBot/1.0"',
    'self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("User agent fixed")
