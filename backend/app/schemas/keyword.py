from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from app.models.keyword import KeywordType, LogicOperator


def normalize_keyword_type_val(value):
    if not value:
        return KeywordType.GENERAL
    if isinstance(value, KeywordType):
        value = value.value
    v = str(value).lower()
    mapping = {
        "product": "brand",
        "products": "brand",
        "brand": "brand",
        "general": "general",
        "competitor": "competitor",
        "person": "person",
        "service": "service",
        "location": "location",
        "hashtag": "hashtag",
        "negative_phrase": "negative_phrase",
        "positive_phrase": "positive_phrase"
    }
    return KeywordType(mapping.get(v, "general"))


# Keyword Schemas
class KeywordBase(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=500)
    keyword_type: KeywordType = KeywordType.GENERAL
    logic_operator: LogicOperator = LogicOperator.OR
    is_excluded: bool = False
    is_active: bool = True

    @validator("keyword_type", pre=True, always=True)
    def validate_keyword_type(cls, v):
        return normalize_keyword_type_val(v)


class KeywordCreate(KeywordBase):
    group_id: int


class KeywordBulkCreate(BaseModel):
    group_id: int
    keywords: List[str]
    keyword_type: KeywordType = KeywordType.GENERAL
    is_active: bool = True

    @validator("keyword_type", pre=True, always=True)
    def validate_keyword_type(cls, v):
        return normalize_keyword_type_val(v)


class KeywordBulkResponse(BaseModel):
    created: List[dict]
    skipped_duplicates: List[str]
    invalid: List[str]
    created_count: int
    skipped_count: int
    invalid_count: int


class KeywordUpdate(BaseModel):
    keyword: Optional[str] = Field(None, min_length=1, max_length=500)
    keyword_type: Optional[KeywordType] = None
    logic_operator: Optional[LogicOperator] = None
    is_excluded: Optional[bool] = None
    is_active: Optional[bool] = None

    @validator("keyword_type", pre=True, always=True)
    def validate_keyword_type(cls, v):
        if v is None:
            return v
        return normalize_keyword_type_val(v)


class KeywordResponse(KeywordBase):
    id: int
    group_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# Keyword Group Schemas
class KeywordGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: int = Field(3, ge=1, le=5)
    alert_threshold: float = Field(70.0, ge=0, le=100)
    is_active: bool = True


class KeywordGroupCreate(KeywordGroupBase):
    pass


class KeywordGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    alert_threshold: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class KeywordGroupResponse(KeywordGroupBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    keywords: List[KeywordResponse] = []
    
    class Config:
        orm_mode = True


class KeywordGroupListResponse(KeywordGroupBase):
    id: int
    created_at: datetime
    keyword_count: int = 0
    
    class Config:
        orm_mode = True

