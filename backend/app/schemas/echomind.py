from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class EchoKeywordBase(BaseModel):
    keyword: str

class EchoKeywordCreate(EchoKeywordBase):
    pass

class EchoKeywordResponse(EchoKeywordBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class EchoMentionBase(BaseModel):
    keyword: str
    source: str
    content: str
    author: str
    sentiment: str
    sentiment_score: float

class EchoMentionCreate(EchoMentionBase):
    pass

class EchoMentionResponse(EchoMentionBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class TimelineItem(BaseModel):
    time: str
    count: int

class SentimentDistributionItem(BaseModel):
    name: str
    value: int

class AnalyticsSummaryResponse(BaseModel):
    total_mentions: int
    positive_mentions: int
    negative_mentions: int
    neutral_mentions: int
    avg_sentiment_score: float
    timeline: List[TimelineItem]
    sentiment_distribution: List[SentimentDistributionItem]
