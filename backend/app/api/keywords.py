from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, delete
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.keyword import Keyword, KeywordGroup
from app.schemas.keyword import (
    KeywordCreate, KeywordUpdate, KeywordResponse,
    KeywordGroupCreate, KeywordGroupUpdate, KeywordGroupResponse, KeywordGroupListResponse
)

router = APIRouter()


# Keyword Group Endpoints
@router.get("/groups", response_model=List[KeywordGroupListResponse])
def list_keyword_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all keyword groups"""
    query = select(KeywordGroup)
    
    if is_active is not None:
        query = query.where(KeywordGroup.is_active == is_active)
    
    query = query.offset(skip).limit(limit).order_by(KeywordGroup.created_at.desc())
    
    result = db.execute(query)
    groups = result.scalars().all()
    
    # Get keyword counts — explicit mapping avoids SQLAlchemy __dict__ pollution
    response = []
    for group in groups:
        keyword_count = db.execute(
            select(func.count(Keyword.id)).where(Keyword.group_id == group.id)
        ).scalar() or 0
        response.append(KeywordGroupListResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            priority=group.priority,
            alert_threshold=group.alert_threshold,
            is_active=group.is_active,
            created_at=group.created_at,
            keyword_count=keyword_count,
        ))
    return response


@router.post("/groups", response_model=KeywordGroupResponse, status_code=status.HTTP_201_CREATED)
def create_keyword_group(
    group_data: KeywordGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new keyword group"""
    group = KeywordGroup(**group_data.dict())
    db.add(group)
    db.commit()
    db.refresh(group)
    return KeywordGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        priority=group.priority,
        alert_threshold=group.alert_threshold,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
        keywords=[],
    )


@router.get("/groups/{group_id}", response_model=KeywordGroupResponse)
def get_keyword_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a keyword group by ID"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id).options(selectinload(KeywordGroup.keywords))
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    return KeywordGroupResponse.from_orm(group)


@router.put("/groups/{group_id}", response_model=KeywordGroupResponse)
def update_keyword_group(
    group_id: int,
    group_data: KeywordGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a keyword group"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    # Update fields
    for field, value in group_data.dict(exclude_unset=True).items():
        setattr(group, field, value)
    
    db.commit()
    db.refresh(group)
    
    return KeywordGroupResponse.from_orm(group)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_keyword_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a keyword group"""
    query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    result = db.execute(query)
    group = result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    db.delete(group)
    db.commit()


# Keyword Endpoints
@router.get("/groups/{group_id}/keywords", response_model=List[KeywordResponse])
def list_keywords_in_group(
    group_id: int,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all keywords in a group"""
    query = select(Keyword).where(Keyword.group_id == group_id)
    
    if is_active is not None:
        query = query.where(Keyword.is_active == is_active)
    
    query = query.order_by(Keyword.created_at.desc())
    
    result = db.execute(query)
    keywords = result.scalars().all()
    
    return [KeywordResponse.from_orm(k) for k in keywords]


@router.post("", response_model=KeywordResponse, status_code=status.HTTP_201_CREATED)
def create_keyword(
    keyword_data: KeywordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new keyword"""
    # Trim and validate
    kw_text = keyword_data.keyword.strip()
    if not kw_text:
        raise HTTPException(status_code=422, detail="Từ khóa không hợp lệ")

    # Verify group exists
    group_query = select(KeywordGroup).where(KeywordGroup.id == keyword_data.group_id)
    group = db.execute(group_query).scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm từ khóa")
        
    # Check duplicate case-insensitively within group
    duplicate_query = select(Keyword).where(
        Keyword.group_id == keyword_data.group_id,
        func.lower(Keyword.keyword) == kw_text.lower()
    )
    if db.execute(duplicate_query).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Từ khóa đã tồn tại trong nhóm này")
    
    # Insert new keyword
    data_dict = keyword_data.dict()
    data_dict["keyword"] = kw_text
    
    keyword = Keyword(**data_dict)
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    
    return KeywordResponse.from_orm(keyword)


from app.schemas.keyword import KeywordBulkCreate, KeywordBulkResponse

@router.post("/bulk", response_model=KeywordBulkResponse, status_code=status.HTTP_201_CREATED)
def create_keywords_bulk(
    bulk_data: KeywordBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Bulk create keywords"""
    # Verify group exists
    group = db.execute(
        select(KeywordGroup).where(KeywordGroup.id == bulk_data.group_id)
    ).scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm từ khóa")

    # Get existing keywords to check duplicates
    existing_kws = db.execute(
        select(Keyword.keyword).where(Keyword.group_id == bulk_data.group_id)
    ).scalars().all()
    existing_lower = {k.lower() for k in existing_kws}

    created = []
    skipped = []
    invalid = []
    
    seen_in_batch = set()

    for kw in bulk_data.keywords:
        kw_clean = kw.strip()
        if not kw_clean:
            continue
            
        kw_lower = kw_clean.lower()
        if kw_lower in seen_in_batch:
            continue
            
        seen_in_batch.add(kw_lower)
        
        if kw_lower in existing_lower:
            skipped.append(kw_clean)
            continue
            
        new_kw = Keyword(
            group_id=bulk_data.group_id,
            keyword=kw_clean,
            keyword_type=bulk_data.keyword_type,
            is_active=bulk_data.is_active
        )
        db.add(new_kw)
        db.commit()
        db.refresh(new_kw)
        
        created.append({
            "id": new_kw.id,
            "keyword": new_kw.keyword
        })

    return {
        "created": created,
        "skipped_duplicates": skipped,
        "invalid": invalid,
        "created_count": len(created),
        "skipped_count": len(skipped),
        "invalid_count": len(invalid)
    }


@router.get("/{keyword_id}", response_model=KeywordResponse)
def get_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a keyword by ID"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    return KeywordResponse.from_orm(keyword)


@router.put("/{keyword_id}", response_model=KeywordResponse)
def update_keyword(
    keyword_id: int,
    keyword_data: KeywordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a keyword"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    # Update fields
    for field, value in keyword_data.dict(exclude_unset=True).items():
        setattr(keyword, field, value)
    
    db.commit()
    db.refresh(keyword)
    
    return KeywordResponse.from_orm(keyword)


@router.delete("/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a keyword"""
    query = select(Keyword).where(Keyword.id == keyword_id)
    result = db.execute(query)
    keyword = result.scalar_one_or_none()
    
    if not keyword:
        raise HTTPException(status_code=404, detail="Keyword not found")
    
    db.delete(keyword)
    db.commit()


@router.delete("/groups/{group_id}/keywords", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_keywords_in_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete all keywords in a group"""
    # Verify group exists
    group_query = select(KeywordGroup).where(KeywordGroup.id == group_id)
    group_result = db.execute(group_query)
    group = group_result.scalar_one_or_none()
    
    if not group:
        raise HTTPException(status_code=404, detail="Keyword group not found")
    
    # Delete all keywords
    db.execute(delete(Keyword).where(Keyword.group_id == group_id))
    db.commit()

