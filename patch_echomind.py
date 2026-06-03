import os

def patch_echomind():
    file_path = "backend/app/api/echomind.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "get_current_active_user" not in content:
        content = content.replace(
            "from app.core.database import get_db",
            "from app.core.database import get_db\nfrom app.core.security import get_current_active_user\nfrom app.models.user import User\nfrom app.core.tenant import apply_tenant_filter\nfrom sqlalchemy import select"
        )

    # get_keywords
    content = content.replace(
        "def get_keywords(db: Session = Depends(get_db)):",
        "def get_keywords(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):"
    )
    content = content.replace(
        "return db.query(EchoKeyword).all()",
        "return db.scalars(apply_tenant_filter(select(EchoKeyword), EchoKeyword, current_user)).all()"
    )

    # create_keyword
    content = content.replace(
        "def create_keyword(keyword: EchoKeywordCreate, db: Session = Depends(get_db)):",
        "def create_keyword(keyword: EchoKeywordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):"
    )
    content = content.replace(
        "db_obj = db.query(EchoKeyword).filter(EchoKeyword.keyword == keyword.keyword).first()",
        "db_obj = db.scalars(apply_tenant_filter(select(EchoKeyword).where(EchoKeyword.keyword == keyword.keyword), EchoKeyword, current_user)).first()"
    )
    content = content.replace(
        "new_kw = EchoKeyword(keyword=keyword.keyword)",
        "new_kw = EchoKeyword(keyword=keyword.keyword, user_id=current_user.id)"
    )

    # delete_keyword
    content = content.replace(
        "def delete_keyword(id: int, db: Session = Depends(get_db)):",
        "def delete_keyword(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):"
    )
    content = content.replace(
        "db_obj = db.query(EchoKeyword).filter(EchoKeyword.id == id).first()",
        "db_obj = db.scalars(apply_tenant_filter(select(EchoKeyword).where(EchoKeyword.id == id), EchoKeyword, current_user)).first()"
    )

    # get_mentions
    content = content.replace(
        "def get_mentions(db: Session = Depends(get_db)):",
        "def get_mentions(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):"
    )
    content = content.replace(
        "return db.query(EchoMention).order_by(EchoMention.created_at.desc()).limit(100).all()",
        "return db.scalars(apply_tenant_filter(select(EchoMention).order_by(EchoMention.created_at.desc()).limit(100), EchoMention, current_user)).all()"
    )

    # get_analytics_summary
    content = content.replace(
        "def get_analytics_summary(db: Session = Depends(get_db)):",
        "def get_analytics_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):"
    )
    content = content.replace(
        "mentions = db.query(EchoMention).all()",
        "mentions = db.scalars(apply_tenant_filter(select(EchoMention), EchoMention, current_user)).all()"
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patched echomind.py")

if __name__ == "__main__":
    patch_echomind()
