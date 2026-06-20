import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.meta_integration_service import MetaIntegrationService
from app.core.crypto import decrypt_token

logger = logging.getLogger(__name__)

class FacebookIngestionService:
    """
    Service for ingesting data from Facebook Pages according to permissions.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.meta_service = MetaIntegrationService(db)

    def list_page_posts(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch posts from all selected Facebook Pages for a user.
        Raises ValueError if required permissions are missing.
        """
        if not self.meta_service.has_capability(user_id, ["pages_read_engagement", "pages_read_user_content"]):
            raise ValueError("Thiếu quyền 'pages_read_engagement' hoặc 'pages_read_user_content' để đọc nội dung Facebook Page.")
            
        token = self.meta_service.get_active_token(user_id)
        if not token:
            raise ValueError("Không tìm thấy Access Token hợp lệ cho Meta integration.")

        accounts = self.meta_service.get_selected_accounts(user_id, "page")
        if not accounts:
            logger.info(f"User {user_id} has no selected Facebook Pages.")
            return []

        all_posts = []
        for account in accounts:
            try:
                # If page specific token exists, use it, else fallback to user token
                page_token = token
                if account.metadata_json and account.metadata_json.get("page_access_token"):
                    decrypted_page_token = decrypt_token(account.metadata_json["page_access_token"])
                    if decrypted_page_token:
                        page_token = decrypted_page_token

                posts = self.meta_service.connector.get_page_feed(page_token, account.external_id, limit)
                for post in posts:
                    post["_source_account_id"] = account.id
                    post["_source_page_name"] = account.name
                all_posts.extend(posts)
            except Exception as e:
                logger.error(f"Error fetching posts for page {account.external_id}: {e}")
                
        return all_posts

    def list_page_comments(self, user_id: int, page_id: str, post_id: str) -> List[Dict[str, Any]]:
        """
        Skeleton method to fetch comments for a specific post.
        Would require additional graph API endpoints in connector.
        """
        if not self.meta_service.has_capability(user_id, ["pages_read_engagement"]):
            raise ValueError("Thiếu quyền để đọc comment Facebook Page.")
        
        # Placeholder for future implementation
        logger.info(f"list_page_comments called for {post_id}")
        return []
