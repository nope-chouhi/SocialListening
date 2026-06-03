import os
import re

def patch_keywords():
    file_path = "backend/app/api/keywords.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Add import
    if "apply_tenant_filter" not in content:
        import_stmt = "from app.core.tenant import apply_tenant_filter\n"
        content = content.replace("from typing import List\n", f"from typing import List\n{import_stmt}")
    
    # 2. list_keyword_groups
    content = content.replace(
        "query = select(KeywordGroup)",
        "query = apply_tenant_filter(select(KeywordGroup), KeywordGroup, current_user)"
    )
    
    # 3. create_keyword_group
    content = content.replace(
        "group = KeywordGroup(**group_data.dict())",
        "group = KeywordGroup(**group_data.dict())\n    group.user_id = current_user.id"
    )
    
    # 4. get_keyword_group, update_keyword_group, delete_keyword_group, list_keywords_in_group, delete_all_keywords_in_group, create_keyword, create_keywords_bulk
    # We replace select(KeywordGroup).where(KeywordGroup.id == group_id) 
    # with apply_tenant_filter(select(KeywordGroup).where(KeywordGroup.id == group_id), KeywordGroup, current_user)
    content = content.replace(
        "select(KeywordGroup).where(KeywordGroup.id == group_id)",
        "apply_tenant_filter(select(KeywordGroup).where(KeywordGroup.id == group_id), KeywordGroup, current_user)"
    )
    content = content.replace(
        "select(KeywordGroup).where(KeywordGroup.id == keyword_data.group_id)",
        "apply_tenant_filter(select(KeywordGroup).where(KeywordGroup.id == keyword_data.group_id), KeywordGroup, current_user)"
    )
    content = content.replace(
        "select(KeywordGroup).where(KeywordGroup.id == bulk_data.group_id)",
        "apply_tenant_filter(select(KeywordGroup).where(KeywordGroup.id == bulk_data.group_id), KeywordGroup, current_user)"
    )
    
    # 5. get_keyword, update_keyword, delete_keyword
    # For Keyword, we need to join KeywordGroup.
    # select(Keyword).where(Keyword.id == keyword_id) 
    # -> select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id).where(Keyword.id == keyword_id)
    # Then wrap in apply_tenant_filter(..., KeywordGroup, current_user)
    old_kw_query = "query = select(Keyword).where(Keyword.id == keyword_id)"
    new_kw_query = "query = apply_tenant_filter(select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id).where(Keyword.id == keyword_id), KeywordGroup, current_user)"
    content = content.replace(old_kw_query, new_kw_query)
    
    # For list_keywords_in_group, there's already group_id in url. But the query is select(Keyword).where(Keyword.group_id == group_id)
    # Since we did not check if the group belongs to the user, we MUST check it.
    # We can join KeywordGroup to Keyword.
    old_kw_list = "query = select(Keyword).where(Keyword.group_id == group_id)"
    new_kw_list = "query = apply_tenant_filter(select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id).where(Keyword.group_id == group_id), KeywordGroup, current_user)"
    content = content.replace(old_kw_list, new_kw_list)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched keywords.py")

if __name__ == "__main__":
    patch_keywords()
