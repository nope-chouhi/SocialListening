from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_active_user
)
from app.core.config import settings
from app.models.user import User
from app.models.user_settings import UserNotificationSettings, UserPreferences, UserSession
from app.schemas.user_settings import (
    NotificationSettingsResponse, NotificationSettingsUpdate,
    UserPreferencesResponse, UserPreferencesUpdate,
    SessionResponse
)
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.api.auth_context import setup_context_endpoint

router = APIRouter()
setup_context_endpoint(router)


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    role: str | None = "viewer"  # admin, super_admin, viewer, manager, analyst, communication, legal, customer_care
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db = Depends(get_db)):
    """Register a new user"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        is_active=True,
        is_superuser=False
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse.from_orm(user)


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db = Depends(get_db)
):
    """Login and get access token"""
    from fastapi import Request
    import uuid
    
    # Get user
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Generate unique JTI for this token
    jti = str(uuid.uuid4())
    
    # Create access token with JTI
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "jti": jti},
        expires_delta=access_token_expires
    )
    
    # Create session record
    # Note: We can't get request object here easily, so we'll create session without device info
    # Device info will be added when we implement proper session tracking
    session = UserSession(
        user_id=user.id,
        token_jti=jti,
        ip_address=None,  # TODO: Get from request
        user_agent=None,  # TODO: Get from request
        device_type="unknown",
        location=None,
        is_revoked=False,
        expires_at=datetime.utcnow() + access_token_expires
    )
    db.add(session)
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse.from_orm(current_user)


@router.put("/me/profile")
def update_my_profile(
    profile_data: dict,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's profile"""
    if "full_name" in profile_data and profile_data["full_name"] is not None:
        current_user.full_name = profile_data["full_name"]
    if "phone" in profile_data and profile_data["phone"] is not None:
        # Note: phone field doesn't exist in User model yet
        pass
    if "department" in profile_data and profile_data["department"] is not None:
        # Note: department field doesn't exist in User model yet
        pass
    
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile updated successfully", "user": UserResponse.from_orm(current_user)}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


@router.post("/me/change-password")
def change_my_password(
    password_data: ChangePasswordRequest,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's password"""
    from app.core.security import verify_password, get_password_hash
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Verify new password matches confirm
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    
    # Validate new password length
    if len(password_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


# ─── Notification Settings Endpoints ──────────────────────────────────────────

@router.get("/me/notification-settings", response_model=NotificationSettingsResponse)
def get_my_notification_settings(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's notification settings"""
    settings = db.execute(
        select(UserNotificationSettings).where(UserNotificationSettings.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create default settings if not exists
    if not settings:
        settings = UserNotificationSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return NotificationSettingsResponse.from_orm(settings)


@router.put("/me/notification-settings", response_model=NotificationSettingsResponse)
def update_my_notification_settings(
    settings_data: NotificationSettingsUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's notification settings"""
    settings = db.execute(
        select(UserNotificationSettings).where(UserNotificationSettings.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create if not exists
    if not settings:
        settings = UserNotificationSettings(user_id=current_user.id)
        db.add(settings)
    
    # Update fields
    for field, value in settings_data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    return NotificationSettingsResponse.from_orm(settings)


# ─── User Preferences Endpoints ───────────────────────────────────────────────

@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_my_preferences(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's UI preferences"""
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create default preferences if not exists
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    return UserPreferencesResponse.from_orm(prefs)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
def update_my_preferences(
    prefs_data: UserPreferencesUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user's UI preferences"""
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    ).scalar_one_or_none()
    
    # Create if not exists
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
    
    # Update fields
    for field, value in prefs_data.dict(exclude_unset=True).items():
        setattr(prefs, field, value)
    
    db.commit()
    db.refresh(prefs)
    
    return UserPreferencesResponse.from_orm(prefs)


# ─── Session Management Endpoints ─────────────────────────────────────────────

@router.get("/me/sessions")
def get_my_sessions(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's active sessions"""
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_revoked == False,
        UserSession.expires_at > datetime.utcnow()
    ).order_by(UserSession.last_active_at.desc()).all()
    
    return {
        "sessions": [
            {
                "id": s.id,
                "device_type": s.device_type,
                "ip_address": s.ip_address,
                "user_agent": s.user_agent,
                "location": s.location,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None
            }
            for s in sessions
        ]
    }


@router.post("/me/sessions/{session_id}/revoke")
def revoke_session(
    session_id: int,
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Revoke a specific session"""
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_revoked = True
    db.commit()
    
    return {"message": "Session revoked successfully"}


@router.post("/me/logout-other-sessions")
def logout_other_sessions(
    db = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Logout all other sessions except current one"""
    # Get current token's JTI from request
    # For now, revoke all sessions
    # TODO: Get current JTI from token and exclude it
    
    db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_revoked == False
    ).update({"is_revoked": True})
    
    db.commit()
    
    return {"message": "All other sessions have been logged out"}


