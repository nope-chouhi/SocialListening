from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.saved_filter import SavedFilter

router = APIRouter()


class SavedFilterCreate(BaseModel):
    name: str
    filter_json: dict
    is_default: Optional[bool] = False


class SavedFilterUpdate(BaseModel):
    name: Optional[str] = None
    filter_json: Optional[dict] = None
    is_default: Optional[bool] = None


@router.get("")
def list_saved_filters(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List saved filters with optional project filtering"""
    query = select(SavedFilter)
    
    if project_id:
        query = query.where(SavedFilter.project_id == project_id)
    
    # Also include filters created by current user
    query = query.where(
        (SavedFilter.project_id == project_id) | (SavedFilter.created_by == current_user.id)
    )
    
    filters = db.execute(query.order_by(SavedFilter.created_at.desc())).scalars().all()
    
    return {
        "items": [
            {
                "id": f.id,
                "project_id": f.project_id,
                "name": f.name,
                "filter_json": f.filter_json,
                "created_by": f.created_by,
                "is_default": f.is_default,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None
            }
            for f in filters
        ]
    }


@router.post("", status_code=201)
def create_saved_filter(
    body: SavedFilterCreate,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new saved filter"""
    # If setting as default, unset other defaults for this project
    if body.is_default and project_id:
        db.execute(
            select(SavedFilter).where(
                SavedFilter.project_id == project_id,
                SavedFilter.is_default == True
            )
        ).scalars().all()
        for f in db.execute(
            select(SavedFilter).where(
                SavedFilter.project_id == project_id,
                SavedFilter.is_default == True
            )
        ).scalars().all():
            f.is_default = False
        db.commit()
    
    saved_filter = SavedFilter(
        project_id=project_id,
        name=body.name,
        filter_json=body.filter_json,
        created_by=current_user.id,
        is_default=body.is_default
    )
    db.add(saved_filter)
    db.commit()
    db.refresh(saved_filter)
    
    return {
        "id": saved_filter.id,
        "project_id": saved_filter.project_id,
        "name": saved_filter.name,
        "filter_json": saved_filter.filter_json,
        "created_by": saved_filter.created_by,
        "is_default": saved_filter.is_default,
        "created_at": saved_filter.created_at.isoformat() if saved_filter.created_at else None,
        "updated_at": saved_filter.updated_at.isoformat() if saved_filter.updated_at else None
    }


@router.get("/{filter_id}")
def get_saved_filter(
    filter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific saved filter"""
    saved_filter = db.execute(
        select(SavedFilter).where(SavedFilter.id == filter_id)
    ).scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    
    return {
        "id": saved_filter.id,
        "project_id": saved_filter.project_id,
        "name": saved_filter.name,
        "filter_json": saved_filter.filter_json,
        "created_by": saved_filter.created_by,
        "is_default": saved_filter.is_default,
        "created_at": saved_filter.created_at.isoformat() if saved_filter.created_at else None,
        "updated_at": saved_filter.updated_at.isoformat() if saved_filter.updated_at else None
    }


@router.put("/{filter_id}")
def update_saved_filter(
    filter_id: int,
    body: SavedFilterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a saved filter"""
    saved_filter = db.execute(
        select(SavedFilter).where(SavedFilter.id == filter_id)
    ).scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    
    if body.name is not None:
        saved_filter.name = body.name
    if body.filter_json is not None:
        saved_filter.filter_json = body.filter_json
    if body.is_default is not None:
        # If setting as default, unset other defaults for this project
        if body.is_default and saved_filter.project_id:
            for f in db.execute(
                select(SavedFilter).where(
                    SavedFilter.project_id == saved_filter.project_id,
                    SavedFilter.id != filter_id,
                    SavedFilter.is_default == True
                )
            ).scalars().all():
                f.is_default = False
        saved_filter.is_default = body.is_default
    
    db.commit()
    db.refresh(saved_filter)
    
    return {
        "id": saved_filter.id,
        "project_id": saved_filter.project_id,
        "name": saved_filter.name,
        "filter_json": saved_filter.filter_json,
        "created_by": saved_filter.created_by,
        "is_default": saved_filter.is_default,
        "created_at": saved_filter.created_at.isoformat() if saved_filter.created_at else None,
        "updated_at": saved_filter.updated_at.isoformat() if saved_filter.updated_at else None
    }


@router.delete("/{filter_id}", status_code=204)
def delete_saved_filter(
    filter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a saved filter"""
    saved_filter = db.execute(
        select(SavedFilter).where(SavedFilter.id == filter_id)
    ).scalar_one_or_none()
    
    if not saved_filter:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    
    db.delete(saved_filter)
    db.commit()
