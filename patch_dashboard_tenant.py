import os
import re

def patch_dashboard():
    file_path = "backend/app/api/dashboard.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "apply_tenant_filter" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.tenant import apply_tenant_filter"
        )

    # Dictionary of replacements
    replacements = {
        "select(Mention)": "apply_tenant_filter(select(Mention), Mention, current_user)",
        "select(Alert)": "apply_tenant_filter(select(Alert), Alert, current_user)",
        "select(Incident)": "apply_tenant_filter(select(Incident), Incident, current_user)",
        "select(Source)": "apply_tenant_filter(select(Source), Source, current_user)",
        "select(Keyword)": "apply_tenant_filter(select(Keyword).join(KeywordGroup, Keyword.group_id == KeywordGroup.id), KeywordGroup, current_user) if 'KeywordGroup' in globals() or 'KeywordGroup' in locals() else apply_tenant_filter(select(Keyword), None, current_user)",
        "select(func.count(Mention.id))": "apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)",
        "select(func.count(Alert.id))": "apply_tenant_filter(select(func.count(Alert.id)), Alert, current_user)",
        "select(func.count(Incident.id))": "apply_tenant_filter(select(func.count(Incident.id)), Incident, current_user)",
        "select(func.count(Source.id))": "apply_tenant_filter(select(func.count(Source.id)), Source, current_user)",
    }

    # First ensure KeywordGroup is imported if not there
    if "KeywordGroup" not in content:
        content = content.replace(
            "from app.models.keyword import Keyword",
            "from app.models.keyword import Keyword, KeywordGroup"
        )

    for old, new in replacements.items():
        # Do not replace if it's already patched in some way
        # But a simple replace is fine since we are careful
        content = content.replace(old, new)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patched dashboard.py")

if __name__ == "__main__":
    patch_dashboard()
