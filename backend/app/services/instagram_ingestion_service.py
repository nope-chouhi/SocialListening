import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.meta_integration_service import MetaIntegrationService
from app.core.crypto import decrypt_token

logger = logging.getLogger(__name__)

class InstagramIngestionService:
    """
    Service for ingesting data from Instagram Business accounts according to permissions.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.meta_service = MetaIntegrationService(db)

    def list_business_media(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch media/posts from all selected Instagram Business accounts for a user.
        """
        if not self.meta_service.has_capability(user_id, ["instagram_basic"]):
            raise ValueError("Thiếu quyền 'instagram_basic' để đọc dữ liệu Instagram Business.")
            
        token = self.meta_service.get_active_token(user_id)
        if not token:
            raise ValueError("Không tìm thấy Access Token hợp lệ cho Meta integration.")

        accounts = self.meta_service.get_selected_accounts(user_id, "instagram_business")
        if not accounts:
            logger.info(f"User {user_id} has no selected Instagram Business accounts.")
            return []

        all_media = []
        for account in accounts:
            try:
                media = self.meta_service.connector.get_ig_media(token, account.external_id, limit)
                for item in media:
                    item["_source_account_id"] = account.id
                    item["_source_username"] = account.name
                all_media.extend(media)
            except Exception as e:
                logger.error(f"Error fetching media for IG account {account.external_id}: {e}")
                
        return all_media

    def search_instagram_hashtag(self, user_id: int, keyword: str) -> List[Dict[str, Any]]:
        """
        Skeleton method to search Instagram by hashtag.
        This requires Instagram Public Content Access which is subject to Meta App Review.
        """
        if not self.meta_service.has_capability(user_id, ["instagram_basic"]): # Usually requires more specific App Review approval
            raise ValueError("Thiếu quyền hoặc cấu hình App Review để tìm kiếm hashtag Instagram công khai.")
        
        # Placeholder for future implementation once App Review supports it
        logger.info(f"search_instagram_hashtag called for #{keyword}")
        return []
