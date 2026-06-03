import os

def patch_mentions():
    file_path = "backend/app/api/mentions.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "apply_tenant_filter" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.tenant import apply_tenant_filter"
        )

    replacements = {
        "select(Mention)": "apply_tenant_filter(select(Mention), Mention, current_user)",
        "select(func.count(Mention.id))": "apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)"
    }

    for old, new in replacements.items():
        content = content.replace(old, new)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patched mentions.py")

if __name__ == "__main__":
    patch_mentions()
