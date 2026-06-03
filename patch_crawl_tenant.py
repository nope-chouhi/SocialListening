import os

def patch_crawl():
    file_path = "backend/app/api/crawl.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "apply_tenant_filter" not in content:
        content = content.replace(
            "from app.core.database import get_db, SessionLocal",
            "from app.core.database import get_db, SessionLocal\nfrom app.core.tenant import apply_tenant_filter"
        )

    # For scan-history
    content = content.replace(
        "select(Mention)",
        "apply_tenant_filter(select(Mention), Mention, current_user)"
    )
    content = content.replace(
        "select(func.count(Mention.id))",
        "apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)"
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patched crawl.py")

if __name__ == "__main__":
    patch_crawl()
