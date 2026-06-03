import re

file_path = "backend/app/api/mentions.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix indentation around line 298
bad_block_1 = """            if search_query and not job_id:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Mention.title.ilike(search_pattern),
                    Mention.content.ilike(search_pattern),
                    Mention.author.ilike(search_pattern),
                    Mention.url.ilike(search_pattern)
                )
            )"""

good_block_1 = """            if search_query and not job_id:
                search_pattern = f"%{search_query}%"
                query = query.where(
                    or_(
                        Mention.title.ilike(search_pattern),
                        Mention.content.ilike(search_pattern),
                        Mention.author.ilike(search_pattern),
                        Mention.url.ilike(search_pattern)
                    )
                )"""

content = content.replace(bad_block_1, good_block_1)

# Fix indentation around line 309
bad_block_2 = """            if q and not job_id:
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    Mention.title.ilike(search_term),
                    Mention.content.ilike(search_term),
                    Mention.author.ilike(search_term),
                    Mention.url.ilike(search_term)
                )
            )"""

good_block_2 = """            if q and not job_id:
                search_term = f"%{q}%"
                query = query.filter(
                    or_(
                        Mention.title.ilike(search_term),
                        Mention.content.ilike(search_term),
                        Mention.author.ilike(search_term),
                        Mention.url.ilike(search_term)
                    )
                )"""

content = content.replace(bad_block_2, good_block_2)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Indentation fixed")
