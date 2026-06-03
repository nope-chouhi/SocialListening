from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base
from datetime import datetime

class EchoKeyword(Base):
    __tablename__ = "echo_keywords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    keyword = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class EchoMention(Base):
    __tablename__ = "echo_mentions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    keyword = Column(String, index=True, nullable=False)
    source = Column(String, nullable=False)
    content = Column(String, nullable=False)
    author = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sentiment = Column(String, nullable=False)
    sentiment_score = Column(Float, nullable=False)
