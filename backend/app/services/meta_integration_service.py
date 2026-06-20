import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone

from app.models.integration import SocialIntegration, SocialIntegrationAccount
from app.services.connectors.meta_connector import MetaConnector
from app.core.crypto import decrypt_token

logger = logging.getLogger(__name__)

class MetaIntegrationService:
    """
    High-level service managing Meta integrations.
    Handles credential validation and capability checks.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.connector = MetaConnector()
        
    def get_integration(self, user_id: int) -> Optional[SocialIntegration]:
        """Fetch the active Meta integration for a user."""
        return self.db.execute(
            select(SocialIntegration).where(
                SocialIntegration.user_id == user_id,
                SocialIntegration.provider == "meta",
                SocialIntegration.status.in_(["active", "limited"])
            )
        ).scalar_one_or_none()

    def get_active_token(self, user_id: int) -> Optional[str]:
        """Get and decrypt the active access token for a user."""
        integration = self.get_integration(user_id)
        if not integration:
            return None
        
        # Check token expiration
        if integration.token_expires_at and integration.token_expires_at < datetime.now(timezone.utc):
            logger.warning(f"Meta token for user {user_id} has expired.")
            return None
            
        plain_token = decrypt_token(integration.token_encrypted)
        return plain_token

    def has_capability(self, user_id: int, required_scopes: List[str]) -> bool:
        """Check if the integration has the required scopes."""
        integration = self.get_integration(user_id)
        if not integration:
            return False
            
        granted = set(integration.granted_scopes_json or [])
        return all(scope in granted for scope in required_scopes)

    def get_selected_accounts(self, user_id: int, account_type: str) -> List[SocialIntegrationAccount]:
        """Get the selected monitoring accounts for a specific type (e.g. 'page' or 'instagram_business')."""
        integration = self.get_integration(user_id)
        if not integration:
            return []
            
        return self.db.execute(
            select(SocialIntegrationAccount).where(
                SocialIntegrationAccount.integration_id == integration.id,
                SocialIntegrationAccount.account_type == account_type,
                SocialIntegrationAccount.selected == True
            )
        ).scalars().all()
