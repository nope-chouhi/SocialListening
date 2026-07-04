import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.integration import SocialIntegration, SocialIntegrationAccount, OAuthState
from app.models.source import Source, SourceType
from app.services.connectors.meta_connector import MetaConnector
from app.core.crypto import encrypt_token, decrypt_token
import secrets

logger = logging.getLogger(__name__)
router = APIRouter()

meta_connector = MetaConnector()

# DTOs
class SelectAccountRequest(BaseModel):
    account_id: str
    selected: bool

@router.get("/capabilities")
def get_integrations_capabilities(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from app.core.config import settings
    from app.models.source import Source
    
            # Web Search
    has_serpapi = bool(settings.SERPAPI_API_KEY)
    is_serpapi_provider = getattr(settings, "WEB_SEARCH_PROVIDER", "").lower() == "serpapi"
    
    auto_discovery_val = getattr(settings, "AUTO_DISCOVERY_ENABLED", False)
    auto_discovery = str(auto_discovery_val).lower() in ("true", "1", "yes")
    
    web_ready = has_serpapi and is_serpapi_provider and auto_discovery
# YouTube
    has_youtube = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
    
    # Meta (Facebook/Instagram)
    meta_integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    meta_accounts = []
    if meta_integration:
        meta_accounts = db.execute(
            select(SocialIntegrationAccount).where(
                SocialIntegrationAccount.integration_id == meta_integration.id
            )
        ).scalars().all()
        
    has_fb = any(acc.account_type == "page" for acc in meta_accounts)
    has_ig = any(acc.account_type == "instagram_business" for acc in meta_accounts)
    
    # RSS
    rss_count = db.execute(select(Source).where(Source.source_type == "rss")).scalars().all()
    has_rss = len(rss_count) > 0
    
    # Twitter
    has_twitter = bool(getattr(settings, "TWITTER_API_KEY", ""))
    
    return {
        "web": {
            "status": "READY" if web_ready else "CONFIG_REQUIRED"
        },
        "youtube": {
            "status": "READY" if has_youtube else "CONFIG_REQUIRED"
        },
        "facebook": {
            "status": "READY" if has_fb else "CONNECT_REQUIRED"
        },
        "instagram": {
            "status": "READY" if has_ig else "CONNECT_REQUIRED"
        },
        "rss": {
            "status": "READY" if has_rss else "NO_SOURCES"
        },
        "tiktok": {
            "status": "CONNECTOR_REQUIRED"
        },
        "twitter": {
            "status": "READY" if has_twitter else "CONFIG_REQUIRED"
        }
    }

@router.get("/meta/status")
def get_meta_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Check Meta integration status and return account details."""
    if not meta_connector.validate_config():
        return {
            "status": "config_required", 
            "label": "Cần cấu hình Meta App", 
            "message": "Cần thiết lập META_APP_ID và META_APP_SECRET.",
            "accounts": []
        }
        
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    if not integration:
        return {
            "status": "oauth_required", 
            "label": "Cần kết nối tài khoản Meta", 
            "message": "Sử dụng luồng xác thực OAuth chính thức của Meta.",
            "accounts": []
        }
    
    accounts = db.execute(
        select(SocialIntegrationAccount).where(
            SocialIntegrationAccount.integration_id == integration.id
        )
    ).scalars().all()

    # Determine limitation status based on granted scopes
    required_scopes = {"pages_read_engagement", "pages_read_user_content"}
    granted = set(integration.granted_scopes_json or [])
    missing = required_scopes - granted

    # Check if a selected account exists
    has_selected = any(acc.selected for acc in accounts)
    
    status = "limited" if missing else "active"
    label = "Đã kết nối — dữ liệu bị giới hạn theo quyền" if missing else "Hoạt động"
    limitations = "Meta không cho phép quét tự do toàn bộ Facebook/Instagram công khai. Nope360 chỉ thu thập dữ liệu trong phạm vi tài khoản, Page hoặc Instagram Business được kết nối và các quyền được cấp."

    if not has_selected and status != "limited":
        status = "oauth_required"
        label = "Cần chọn tài khoản theo dõi"
        
    # Also verify token validity
    if status in ["active", "limited"]:
        plain_token = decrypt_token(integration.token_encrypted)
        if not plain_token or not meta_connector.test_connection(plain_token):
            status = "oauth_required"
            label = "Kết nối hết hạn hoặc không hợp lệ"
            limitations = "Vui lòng kết nối lại Meta để tiếp tục thu thập dữ liệu."

    return {
        "status": status, 
        "label": label, 
        "message": limitations,
        "granted_scopes": list(granted),
        "missing_scopes": list(missing),
        "accounts": [
            {
                "id": acc.id,
                "provider": acc.provider,
                "account_type": acc.account_type,
                "external_id": acc.external_id,
                "name": acc.name,
                "username": acc.username,
                "selected": acc.selected
            } for acc in accounts
        ]
    }

@router.get("/meta/auth-url")
def get_meta_auth_url(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Get OAuth URL to redirect user."""
    if not meta_connector.validate_config():
        raise HTTPException(status_code=400, detail="Meta App chưa được cấu hình.")
    
    # Generate secure random state
    state_token = secrets.token_urlsafe(32)
    
    # Store state securely
    oauth_state = OAuthState(
        state_token=state_token,
        user_id=current_user.id,
        provider="meta",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    db.add(oauth_state)
    db.commit()
    
    auth_url = meta_connector.get_auth_url(state_token)
    return {"url": auth_url}

@router.get("/meta/callback")
def meta_callback(
    code: str = Query(...), 
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """Handle OAuth callback from Meta."""
    # Validate state
    oauth_state = db.execute(
        select(OAuthState).where(OAuthState.state_token == state)
    ).scalar_one_or_none()
    
    if not oauth_state:
        raise HTTPException(status_code=400, detail="State không hợp lệ hoặc đã hết hạn.")
        
    if oauth_state.expires_at < datetime.now(timezone.utc):
        db.delete(oauth_state)
        db.commit()
        raise HTTPException(status_code=400, detail="State đã hết hạn.")
        
    user_id = oauth_state.user_id
    
    # Consume state so it can't be reused
    db.delete(oauth_state)
    db.commit()
        
    try:
        # 1. Exchange code for short-lived then long-lived token
        token_data = meta_connector.exchange_code(code)
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise ValueError("Không nhận được access_token từ Meta.")
            
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in) if expires_in else None
        
        # In a real app we can fetch granted scopes from a debug_token endpoint.
        # For simplicity, we assume default scopes were granted if we get a token.
        granted_scopes = [
            "public_profile",
            "pages_show_list",
            "pages_read_engagement",
            "pages_read_user_content",
            "instagram_basic",
            "instagram_manage_comments",
        ]
        
        # Encrypt the token securely
        encrypted_token = encrypt_token(access_token)
        
        # 2. Save or update integration
        integration = db.execute(
            select(SocialIntegration).where(
                SocialIntegration.user_id == user_id,
                SocialIntegration.provider == "meta"
            )
        ).scalar_one_or_none()
        
        if not integration:
            integration = SocialIntegration(
                user_id=user_id,
                provider="meta",
                status="active",
                token_encrypted=encrypted_token,
                token_expires_at=expires_at,
                granted_scopes_json=granted_scopes
            )
            db.add(integration)
            db.flush()
        else:
            integration.token_encrypted = encrypted_token
            integration.token_expires_at = expires_at
            integration.granted_scopes_json = granted_scopes
            integration.status = "active"
            
        # 3. Fetch accounts
        accounts = meta_connector.get_user_accounts(access_token)
        
        existing_accs = db.execute(
            select(SocialIntegrationAccount).where(
                SocialIntegrationAccount.integration_id == integration.id
            )
        ).scalars().all()
        existing_map = {acc.external_id: acc for acc in existing_accs}
        
        for acc in accounts:
            meta = {}
            if acc.get("page_access_token"):
                meta["page_access_token"] = encrypt_token(acc["page_access_token"])

            if acc["id"] not in existing_map:
                source_type = SourceType.FACEBOOK_PAGE if acc["platform"] == "facebook" else SourceType.INSTAGRAM_BUSINESS
                source_url = f"https://{acc['platform']}.com/{acc['id']}"

                new_acc = SocialIntegrationAccount(
                    integration_id=integration.id,
                    provider=acc["platform"],
                    account_type="page" if acc["platform"] == "facebook" else "instagram_business",
                    external_id=acc["id"],
                    name=acc["name"],
                    selected=True, # default select new accounts
                    metadata_json=meta
                )
                db.add(new_acc)
                
                # Create the corresponding Source record automatically
                new_source = Source(
                    user_id=user_id,
                    name=acc["name"],
                    source_type=source_type,
                    url=source_url,
                    platform=acc["platform"],
                    platform_id=acc["id"],
                    is_active=True,
                    crawl_frequency="daily",
                    schedule_hours=[9, 15, 21]
                )
                db.add(new_source)
            else:
                existing_acc = existing_map[acc["id"]]
                existing_acc.metadata_json = meta
                
        db.commit()
        # Ensure we redirect to the dedicated Meta Integration page
        from fastapi.responses import RedirectResponse
        from app.core.config import settings
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        return RedirectResponse(url=f"{frontend_url}/dashboard/integrations/meta")
        
    except Exception as e:
        logger.error(f"Meta OAuth error: {e}")
        # Redirect to error or handle properly
        from fastapi.responses import RedirectResponse
        from app.core.config import settings
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        return RedirectResponse(url=f"{frontend_url}/dashboard/integrations/meta?error=oauth_failed")

@router.get("/meta/accounts")
def get_meta_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """List Meta accounts from DB, fetching from Meta API to refresh."""
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    if not integration:
        return []
        
    accounts = db.execute(
        select(SocialIntegrationAccount).where(
            SocialIntegrationAccount.integration_id == integration.id
        )
    ).scalars().all()
    
    return [
        {
            "id": acc.id,
            "external_id": acc.external_id,
            "provider": acc.provider,
            "name": acc.name,
            "selected": acc.selected
        } for acc in accounts
    ]

@router.post("/meta/select-account")
def select_meta_account(req: SelectAccountRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Toggle monitoring for a specific account."""
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    if not integration:
        raise HTTPException(status_code=400, detail="Chưa kết nối Meta.")
        
    acc = db.execute(
        select(SocialIntegrationAccount).where(
            SocialIntegrationAccount.integration_id == integration.id,
            SocialIntegrationAccount.external_id == req.account_id
        )
    ).scalar_one_or_none()
    
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
        
    acc.selected = req.selected
    
    # Sync with Source table
    source = db.execute(
        select(Source).where(
            Source.user_id == current_user.id,
            Source.platform_id == req.account_id
        )
    ).scalar_one_or_none()
    if source:
        source.is_active = req.selected
        
    db.commit()
    return {"success": True, "selected": acc.selected}

@router.post("/meta/test-connection")
def test_meta_connection(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Validate token and accounts."""
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    if not integration:
        return {"success": False, "message": "Chưa kết nối Meta."}
        
    plain_token = decrypt_token(integration.token_encrypted)
    if not plain_token:
        return {"success": False, "message": "Không thể giải mã token."}
        
    is_valid = meta_connector.test_connection(plain_token)
    if is_valid:
        return {"success": True, "message": "Kết nối Meta đang hoạt động tốt."}
    else:
        return {"success": False, "message": "Kết nối Meta không hợp lệ hoặc đã hết hạn."}

@router.post("/meta/disconnect")
def meta_disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Disconnect Meta integration."""
    integration = db.execute(
        select(SocialIntegration).where(
            SocialIntegration.user_id == current_user.id,
            SocialIntegration.provider == "meta"
        )
    ).scalar_one_or_none()
    
    if integration:
        # Also deactivate associated Sources
        accounts = db.execute(
            select(SocialIntegrationAccount).where(
                SocialIntegrationAccount.integration_id == integration.id
            )
        ).scalars().all()
        account_ids = [acc.external_id for acc in accounts]
        if account_ids:
            db.execute(
                Source.__table__.update().where(
                    Source.user_id == current_user.id,
                    Source.platform_id.in_(account_ids)
                ).values(is_active=False)
            )

        db.execute(
            SocialIntegrationAccount.__table__.delete().where(
                SocialIntegrationAccount.integration_id == integration.id
            )
        )
        db.delete(integration)
        db.commit()
        
    return {"success": True, "message": "Đã ngắt kết nối Meta."}
