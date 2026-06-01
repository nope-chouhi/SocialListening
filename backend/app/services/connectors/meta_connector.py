import logging
import requests
from typing import Dict, List, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class MetaConnector:
    """Official Meta Graph API connector for Facebook and Instagram."""
    
    def __init__(self):
        self.app_id = settings.META_APP_ID
        self.app_secret = settings.META_APP_SECRET
        self.redirect_uri = settings.META_REDIRECT_URI
        self.graph_url = "https://graph.facebook.com/v19.0"
        
    def validate_config(self) -> bool:
        """Check if Meta App is configured."""
        return bool(self.app_id and self.app_secret)
        
    def get_auth_url(self, state: str) -> str:
        """Generate OAuth URL for user to grant permissions."""
        if not self.validate_config():
            raise Exception("Meta App is not configured")
            
        scopes = [
            "public_profile",
            "pages_show_list",
            "pages_read_engagement",
            "pages_read_user_content",
            "instagram_basic",
            "instagram_manage_comments",
        ]
        
        return (
            f"https://www.facebook.com/v19.0/dialog/oauth"
            f"?client_id={self.app_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&state={state}"
            f"&scope={','.join(scopes)}"
            f"&response_type=code"
        )
        
    def exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange auth code for access token."""
        url = f"{self.graph_url}/oauth/access_token"
        params = {
            "client_id": self.app_id,
            "redirect_uri": self.redirect_uri,
            "client_secret": self.app_secret,
            "code": code
        }
        
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        
        data = resp.json()
        short_token = data.get("access_token")
        
        # Exchange for long-lived token
        return self.get_long_lived_token(short_token)
        
    def get_long_lived_token(self, short_token: str) -> Dict[str, Any]:
        """Exchange short-lived token for long-lived token (60 days)."""
        url = f"{self.graph_url}/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": self.app_id,
            "client_secret": self.app_secret,
            "fb_exchange_token": short_token
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_user_accounts(self, access_token: str) -> List[Dict[str, Any]]:
        """List Facebook Pages and connected Instagram Business accounts."""
        url = f"{self.graph_url}/me/accounts"
        params = {
            "access_token": access_token,
            "fields": "id,name,access_token,instagram_business_account{id,username,profile_picture_url}"
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        
        data = resp.json()
        accounts = []
        for page in data.get("data", []):
            accounts.append({
                "platform": "facebook",
                "id": page["id"],
                "name": page["name"],
                "page_access_token": page.get("access_token")
            })
            ig = page.get("instagram_business_account")
            if ig:
                accounts.append({
                    "platform": "instagram",
                    "id": ig["id"],
                    "name": ig.get("username", ""),
                    "page_id": page["id"]
                })
        return accounts

    def test_connection(self, access_token: str) -> bool:
        """Verify if the token is valid by making a simple request to Meta API."""
        url = f"{self.graph_url}/me"
        params = {
            "access_token": access_token,
            "fields": "id"
        }
        try:
            resp = requests.get(url, params=params, timeout=10)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Meta token validation failed: {e}")
            return False
