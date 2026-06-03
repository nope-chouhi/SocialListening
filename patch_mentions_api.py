import re

mentions_path = "backend/app/api/mentions.py"
with open(mentions_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace q filter block
q_block = r"if q:[\s\S]*?domain\.ilike\(search_term\),[\s\S]*?\)\s*\)"
new_q_block = """if q and not job_id:
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    Mention.title.ilike(search_term),
                    Mention.snippet.ilike(search_term),
                    Mention.content.ilike(search_term),
                    Mention.url.ilike(search_term),
                    Mention.domain.ilike(search_term),
                )
            )"""
content = re.sub(q_block, new_q_block, content)

# Replace date_from block
date_from_block = r"if date_from:\s*query = query\.where\(Mention\.collected_at >= date_from\)"
new_date_from_block = "if date_from and not job_id:\n            query = query.where(Mention.collected_at >= date_from)"
content = re.sub(date_from_block, new_date_from_block, content)

# Replace date_to block
date_to_block = r"if date_to:\s*query = query\.where\(Mention\.collected_at <= date_to\)"
new_date_to_block = "if date_to and not job_id:\n            query = query.where(Mention.collected_at <= date_to)"
content = re.sub(date_to_block, new_date_to_block, content)

# Replace search_query block
search_query_block = r"if search_query:[\s\S]*?Mention\.url\.ilike\(search_pattern\)[\s\S]*?\)\s*\)"
new_search_query_block = """if search_query and not job_id:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Mention.title.ilike(search_pattern),
                    Mention.content.ilike(search_pattern),
                    Mention.author.ilike(search_pattern),
                    Mention.url.ilike(search_pattern)
                )
            )"""
content = re.sub(search_query_block, new_search_query_block, content)

with open(mentions_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Mentions API patched for job_id override")
