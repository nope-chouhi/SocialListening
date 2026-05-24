"""
Monitor API Endpoints
======================
Các endpoint chính cho chức năng giám sát mạng xã hội theo từ khóa.
Bao gồm: bắt đầu theo dõi, dashboard tổng hợp, phân tích AI khủng hoảng.

Endpoints:
    POST /api/monitor/start          - Bắt đầu theo dõi từ khóa
    GET  /api/monitor/dashboard      - Dashboard tổng hợp theo từ khóa
    GET  /api/monitor/ai-analysis    - Phân tích AI cảnh báo khủng hoảng
"""

import logging
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.source import Source
from app.services.mock_scraper import (
    generate_mock_vietnamese_mentions,
    extract_buzzwords,
)
from app.services.ai_service import get_ai_provider

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================================

class MonitorStartRequest(BaseModel):
    """Schema cho yêu cầu bắt đầu theo dõi từ khóa."""
    keyword: str


class MonitorStartResponse(BaseModel):
    """Schema cho phản hồi sau khi bắt đầu theo dõi."""
    success: bool
    keyword: str
    mentions_created: int
    alerts_created: int
    summary: str


# ============================================================================
# POST /api/monitor/start
# Bắt đầu theo dõi từ khóa: mock scraping + sentiment tagging + lưu database
# ============================================================================

@router.post("/start", response_model=MonitorStartResponse)
def start_monitoring(
    body: MonitorStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Bắt đầu theo dõi một từ khóa.
    
    Quy trình:
    1. Tạo mock data: 20-30 bài đăng/bình luận tiếng Việt giả lập
    2. Phân tích sentiment cho từng mention bằng AI provider đã cấu hình
    3. Lưu vào database (Mention + AIAnalysis)
    4. Tạo Alert cho các mention có rủi ro cao
    
    Edge Cases:
    - Empty keyword → HTTP 400
    - Duplicate content → bỏ qua (dedup bằng content_hash)
    - AI analysis failure → vẫn lưu mention, bỏ qua analysis
    """
    keyword = body.keyword.strip()
    
    if not keyword:
        raise HTTPException(
            status_code=400,
            detail="Vui lòng nhập từ khóa cần theo dõi."
        )
    
    if len(keyword) > 200:
        raise HTTPException(
            status_code=400,
            detail="Từ khóa quá dài. Vui lòng nhập tối đa 200 ký tự."
        )
    
    logger.info(f"[Monitor] User {current_user.email} bắt đầu theo dõi: '{keyword}'")
    
    # ── Step 1: Tạo mock Vietnamese mentions ──────────────────────────────
    mock_mentions = generate_mock_vietnamese_mentions(keyword, count=25)
    
    if not mock_mentions:
        raise HTTPException(
            status_code=500,
            detail="Không thể tạo dữ liệu giả lập. Vui lòng thử lại."
        )
    
    # ── Step 2: Lấy hoặc tạo Source cho mock data ────────────────────────
    mock_source = _get_or_create_mock_source(db)
    
    # ── Step 3: AI provider ──────────────────────────────────────────────
    ai_provider = get_ai_provider()
    
    mentions_created = 0
    alerts_created = 0
    
    for mock in mock_mentions:
        try:
            # Dedup: kiểm tra content_hash trước khi lưu
            content_hash = hashlib.sha256(
                mock["content"].strip().encode("utf-8")
            ).hexdigest()
            
            existing = db.execute(
                select(Mention).where(Mention.content_hash == content_hash)
            ).scalar_one_or_none()
            
            if existing:
                continue  # Bỏ qua bài trùng lặp
            
            # ── Tạo Mention ──────────────────────────────────────────
            mention = Mention(
                source_id=mock_source.id,
                title=None,  # Bình luận MXH thường không có title
                content=mock["content"],
                content_hash=content_hash,
                url=mock["url"],
                author=mock.get("author"),
                published_at=mock.get("published_at"),
                collected_at=datetime.utcnow(),
                matched_keywords=[{"keyword": keyword}],
                meta_data={
                    "platform": mock["platform"],
                    "reach": mock.get("reach", 0),
                    "monitor_keyword": keyword,
                },
                is_reviewed=False,
            )
            db.add(mention)
            db.flush()  # Lấy mention.id mà không commit
            
            # ── Phân tích Sentiment bằng AI ──────────────────────────
            try:
                analysis_result = ai_provider.analyze_mention(
                    mock["content"], None
                )
                
                ai_analysis = AIAnalysis(
                    mention_id=mention.id,
                    sentiment=analysis_result["sentiment"],
                    risk_score=analysis_result["risk_score"],
                    crisis_level=analysis_result["crisis_level"],
                    summary_vi=analysis_result.get("summary_vi", ""),
                    suggested_action=analysis_result.get(
                        "suggested_action", "monitor"
                    ),
                    responsible_department=analysis_result.get(
                        "responsible_department", "customer_service"
                    ),
                    confidence_score=analysis_result.get(
                        "confidence_score", 65.0
                    ),
                    ai_provider=analysis_result.get("ai_provider", "dummy"),
                    model_version="monitor-1.0",
                    processing_time_ms=analysis_result.get(
                        "processing_time_ms", 0
                    ),
                )
                db.add(ai_analysis)
                
                # ── Tạo Alert nếu rủi ro cao ────────────────────────
                if analysis_result["risk_score"] >= 70:
                    severity = (
                        AlertSeverity.CRITICAL
                        if analysis_result["risk_score"] >= 85
                        else AlertSeverity.HIGH
                    )
                    alert = Alert(
                        mention_id=mention.id,
                        severity=severity,
                        status=AlertStatus.NEW,
                        title=(
                            f"Phát hiện đề cập rủi ro cao về '{keyword}'"
                        ),
                        message=(
                            f"Nền tảng: {mock['platform']}, "
                            f"Rủi ro: {analysis_result['risk_score']:.0f}, "
                            f"Khủng hoảng: cấp {analysis_result['crisis_level']}"
                        ),
                    )
                    db.add(alert)
                    alerts_created += 1
                    
            except Exception as e:
                logger.warning(
                    f"[Monitor] AI analysis failed for mention {mention.id}: {e}"
                )
                # Mention vẫn được lưu, chỉ bỏ qua analysis
            
            mentions_created += 1
            
        except Exception as e:
            logger.error(f"[Monitor] Error processing mock mention: {e}")
            continue
    
    # Commit tất cả
    if mentions_created > 0:
        db.commit()
    
    summary = (
        f"Đã tạo {mentions_created} đề cập giả lập cho từ khóa '{keyword}'. "
        f"Phát hiện {alerts_created} cảnh báo rủi ro cao."
    )
    
    logger.info(f"[Monitor] Hoàn tất: {summary}")
    
    return MonitorStartResponse(
        success=True,
        keyword=keyword,
        mentions_created=mentions_created,
        alerts_created=alerts_created,
        summary=summary,
    )


# ============================================================================
# GET /api/monitor/dashboard?keyword={keyword}
# Dashboard tổng hợp: metrics, sentiment breakdown, buzzwords, mentions list
# ============================================================================

@router.get("/dashboard")
def get_monitor_dashboard(
    keyword: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lấy dữ liệu dashboard tổng hợp cho một từ khóa.
    
    Trả về:
    - total_mentions: Tổng số đề cập
    - sentiment_breakdown: Phân bổ sentiment (positive/negative/neutral)
    - dangerous_negative_count: Số đề cập tiêu cực nghiêm trọng
    - alert_risk_status: Mức cảnh báo tổng thể (Low/Medium/High)
    - top_buzzwords: Từ khóa nổi bật
    - mentions: Danh sách đề cập gần nhất
    - volatility_data: Dữ liệu cho biểu đồ biến động
    
    Edge Cases:
    - Keyword không tồn tại → trả về dữ liệu rỗng với total_mentions = 0
    - Không có negative mentions → alert_risk_status = "Low"
    """
    keyword = keyword.strip()
    
    try:
        # ── Tìm tất cả mentions chứa keyword ────────────────────────
        # Sử dụng JSONB search trong matched_keywords hoặc tìm trong content
        keyword_pattern = f"%{keyword}%"
        
        mentions_query = (
            select(Mention)
            .where(
                or_(
                    Mention.content.ilike(keyword_pattern),
                    Mention.title.ilike(keyword_pattern),
                )
            )
            .order_by(Mention.collected_at.desc())
        )
        
        all_mentions = db.execute(mentions_query).scalars().all()
        total_mentions = len(all_mentions)
        
        # ── Edge case: không có kết quả ──────────────────────────────
        if total_mentions == 0:
            return {
                "keyword": keyword,
                "total_mentions": 0,
                "sentiment_breakdown": {
                    "positive_count": 0,
                    "negative_count": 0,
                    "neutral_count": 0,
                    "positive_pct": 0,
                    "negative_pct": 0,
                    "neutral_pct": 0,
                },
                "dangerous_negative_count": 0,
                "alert_risk_status": "Low",
                "top_buzzwords": [],
                "mentions": [],
                "volatility_data": [],
                "message": f"Không tìm thấy đề cập nào cho từ khóa '{keyword}'. "
                           "Hãy thử 'Bắt Đầu Theo Dõi' trước.",
            }
        
        # ── Sentiment Breakdown ──────────────────────────────────────
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        dangerous_negative_count = 0
        
        mention_ids = [m.id for m in all_mentions]
        
        # Batch query all AI analyses for these mentions
        analyses_map: Dict[int, AIAnalysis] = {}
        if mention_ids:
            analyses = db.execute(
                select(AIAnalysis).where(
                    AIAnalysis.mention_id.in_(mention_ids)
                )
            ).scalars().all()
            analyses_map = {a.mention_id: a for a in analyses}
        
        for m_id in mention_ids:
            analysis = analyses_map.get(m_id)
            if not analysis:
                neutral_count += 1
                continue
            
            sentiment_val = (
                analysis.sentiment.value
                if hasattr(analysis.sentiment, "value")
                else analysis.sentiment
            )
            
            if sentiment_val == "positive":
                positive_count += 1
            elif sentiment_val in (
                "negative_low",
                "negative_medium",
                "negative_high",
            ):
                negative_count += 1
                if sentiment_val in ("negative_medium", "negative_high"):
                    dangerous_negative_count += 1
            else:
                neutral_count += 1
        
        # Tính phần trăm
        total_analyzed = positive_count + negative_count + neutral_count
        positive_pct = round(
            (positive_count / total_analyzed * 100) if total_analyzed > 0 else 0, 1
        )
        negative_pct = round(
            (negative_count / total_analyzed * 100) if total_analyzed > 0 else 0, 1
        )
        neutral_pct = round(100 - positive_pct - negative_pct, 1)
        
        # ── Alert Risk Status ────────────────────────────────────────
        negative_ratio = (
            negative_count / total_analyzed if total_analyzed > 0 else 0
        )
        if negative_ratio >= 0.4 or dangerous_negative_count >= 5:
            alert_risk_status = "High"
        elif negative_ratio >= 0.2 or dangerous_negative_count >= 2:
            alert_risk_status = "Medium"
        else:
            alert_risk_status = "Low"
        
        # ── Top Buzzwords ────────────────────────────────────────────
        mentions_for_buzz = [
            {"content": m.content or ""} for m in all_mentions
        ]
        top_buzzwords = extract_buzzwords(mentions_for_buzz, top_n=10)
        
        # ── Mentions List (top 50, enriched with analysis) ───────────
        mentions_list = []
        for m in all_mentions[:50]:
            analysis = analyses_map.get(m.id)
            
            # Trích xuất platform từ meta_data
            platform = "Unknown"
            reach = 0
            if m.meta_data and isinstance(m.meta_data, dict):
                platform = m.meta_data.get("platform", "Unknown")
                reach = m.meta_data.get("reach", 0)
            
            sentiment_val = None
            sentiment_score = None
            risk_score = None
            if analysis:
                sentiment_val = (
                    analysis.sentiment.value
                    if hasattr(analysis.sentiment, "value")
                    else analysis.sentiment
                )
                sentiment_score = analysis.confidence_score
                risk_score = analysis.risk_score
            
            mentions_list.append({
                "id": m.id,
                "platform": platform,
                "content": (m.content or "")[:300],
                "author": m.author,
                "sentiment": sentiment_val,
                "sentiment_score": sentiment_score,
                "risk_score": risk_score,
                "reach": reach,
                "url": m.url,
                "created_at": (
                    m.collected_at.isoformat()
                    if m.collected_at
                    else None
                ),
            })
        
        # ── Volatility Data (dữ liệu biến động theo ngày) ───────────
        volatility_data = _compute_volatility(all_mentions, analyses_map)
        
        return {
            "keyword": keyword,
            "total_mentions": total_mentions,
            "sentiment_breakdown": {
                "positive_count": positive_count,
                "negative_count": negative_count,
                "neutral_count": neutral_count,
                "positive_pct": positive_pct,
                "negative_pct": negative_pct,
                "neutral_pct": neutral_pct,
            },
            "dangerous_negative_count": dangerous_negative_count,
            "alert_risk_status": alert_risk_status,
            "top_buzzwords": top_buzzwords,
            "mentions": mentions_list,
            "volatility_data": volatility_data,
        }
        
    except Exception as e:
        logger.error(f"[Monitor] Dashboard error for '{keyword}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi tải dữ liệu dashboard: {str(e)}"
        )


# ============================================================================
# GET /api/monitor/ai-analysis?keyword={keyword}
# Phân tích AI: crisis summary + action items cho các đề cập tiêu cực
# ============================================================================

@router.get("/ai-analysis")
def get_ai_analysis(
    keyword: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Phân tích AI cho các đề cập tiêu cực liên quan đến từ khóa.
    
    Trả về:
    - crisis_summary: Tóm tắt tình hình khủng hoảng (tiếng Việt)
    - risk_level: Mức độ rủi ro tổng thể (Low/Medium/High)
    - action_items: 3 bước hành động cụ thể
    - negative_mentions_count: Số đề cập tiêu cực
    - top_negative_themes: Chủ đề tiêu cực phổ biến
    """
    keyword = keyword.strip()
    
    try:
        # Tìm mentions chứa keyword
        keyword_pattern = f"%{keyword}%"
        mentions = db.execute(
            select(Mention)
            .where(
                or_(
                    Mention.content.ilike(keyword_pattern),
                    Mention.title.ilike(keyword_pattern),
                )
            )
            .order_by(Mention.collected_at.desc())
            .limit(200)
        ).scalars().all()
        
        if not mentions:
            return {
                "keyword": keyword,
                "crisis_summary": f"Không tìm thấy đề cập nào cho từ khóa '{keyword}'.",
                "risk_level": "Low",
                "action_items": [],
                "negative_mentions_count": 0,
                "top_negative_themes": [],
            }
        
        # Lấy AI analyses cho các mentions
        mention_ids = [m.id for m in mentions]
        analyses = db.execute(
            select(AIAnalysis).where(
                AIAnalysis.mention_id.in_(mention_ids)
            )
        ).scalars().all()
        analyses_map = {a.mention_id: a for a in analyses}
        
        # Lọc negative mentions
        negative_mentions = []
        for m in mentions:
            analysis = analyses_map.get(m.id)
            if not analysis:
                continue
            sentiment_val = (
                analysis.sentiment.value
                if hasattr(analysis.sentiment, "value")
                else analysis.sentiment
            )
            if sentiment_val in (
                "negative_low",
                "negative_medium",
                "negative_high",
            ):
                negative_mentions.append({
                    "content": m.content,
                    "sentiment": sentiment_val,
                    "risk_score": analysis.risk_score,
                    "crisis_level": analysis.crisis_level,
                    "platform": (
                        m.meta_data.get("platform", "Unknown")
                        if m.meta_data and isinstance(m.meta_data, dict)
                        else "Unknown"
                    ),
                })
        
        neg_count = len(negative_mentions)
        total_count = len(mentions)
        
        # ── Tính risk level tổng thể ────────────────────────────────
        if neg_count == 0:
            risk_level = "Low"
        else:
            neg_ratio = neg_count / total_count
            high_crisis = sum(
                1 for n in negative_mentions
                if n["crisis_level"] >= 4
            )
            
            if neg_ratio >= 0.4 or high_crisis >= 3:
                risk_level = "High"
            elif neg_ratio >= 0.2 or high_crisis >= 1:
                risk_level = "Medium"
            else:
                risk_level = "Low"
        
        # ── Tạo Crisis Summary (mô phỏng LLM output) ────────────────
        crisis_summary = _generate_crisis_summary(
            keyword, negative_mentions, total_count, risk_level
        )
        
        # ── Tạo Action Items ────────────────────────────────────────
        action_items = _generate_action_items(
            keyword, risk_level, negative_mentions
        )
        
        # ── Top Negative Themes ─────────────────────────────────────
        top_negative_themes = _extract_negative_themes(negative_mentions)
        
        return {
            "keyword": keyword,
            "crisis_summary": crisis_summary,
            "risk_level": risk_level,
            "action_items": action_items,
            "negative_mentions_count": neg_count,
            "top_negative_themes": top_negative_themes,
            "total_mentions": total_count,
        }
        
    except Exception as e:
        logger.error(f"[Monitor] AI Analysis error for '{keyword}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi phân tích AI: {str(e)}"
        )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _get_or_create_mock_source(db: Session) -> Source:
    """
    Lấy hoặc tạo Source đặc biệt cho mock data.
    Tránh tạo nhiều source trùng lặp.
    """
    mock_source = db.execute(
        select(Source).where(Source.name == "Mock Social Media Scanner")
    ).scalar_one_or_none()
    
    if not mock_source:
        from app.models.source import SourceType
        mock_source = Source(
            name="Mock Social Media Scanner",
            url="https://mock.social-listening.vn",
            source_type=SourceType.WEBSITE,
            is_active=True,
            meta_data={"type": "mock_scanner", "version": "1.0"},
        )
        db.add(mock_source)
        db.flush()
    
    return mock_source


def _compute_volatility(
    mentions: List[Mention],
    analyses_map: Dict[int, AIAnalysis],
    days: int = 7,
) -> List[Dict]:
    """
    Tính toán dữ liệu biến động (volatility) theo ngày.
    Dùng cho biểu đồ Line Chart trên frontend.
    """
    now = datetime.utcnow()
    daily_data = {}
    
    for i in range(days):
        day = now - timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        daily_data[date_str] = {
            "date": date_str,
            "total": 0,
            "positive": 0,
            "negative": 0,
            "neutral": 0,
        }
    
    for m in mentions:
        if not m.collected_at:
            continue
        date_str = m.collected_at.strftime("%Y-%m-%d")
        if date_str not in daily_data:
            continue
        
        daily_data[date_str]["total"] += 1
        
        analysis = analyses_map.get(m.id)
        if analysis:
            sentiment_val = (
                analysis.sentiment.value
                if hasattr(analysis.sentiment, "value")
                else analysis.sentiment
            )
            if sentiment_val == "positive":
                daily_data[date_str]["positive"] += 1
            elif sentiment_val in (
                "negative_low",
                "negative_medium",
                "negative_high",
            ):
                daily_data[date_str]["negative"] += 1
            else:
                daily_data[date_str]["neutral"] += 1
        else:
            daily_data[date_str]["neutral"] += 1
    
    # Trả về sắp xếp theo ngày tăng dần
    sorted_data = sorted(daily_data.values(), key=lambda x: x["date"])
    return sorted_data


def _generate_crisis_summary(
    keyword: str,
    negative_mentions: List[Dict],
    total_count: int,
    risk_level: str,
) -> str:
    """
    Tạo bản tóm tắt khủng hoảng bằng tiếng Việt.
    
    Trong production, function này sẽ gọi OpenAI/Gemini API để tạo summary
    thông minh hơn. Hiện tại sử dụng template-based approach.
    
    TODO: Tích hợp LLM API cho crisis summarization nâng cao.
    """
    neg_count = len(negative_mentions)
    
    if neg_count == 0:
        return (
            f"Tình hình theo dõi '{keyword}' ổn định. "
            f"Tổng cộng {total_count} đề cập được phân tích, "
            "không phát hiện xu hướng tiêu cực đáng lo ngại."
        )
    
    # Đếm platform distribution
    platform_counts = Counter(n["platform"] for n in negative_mentions)
    top_platform = platform_counts.most_common(1)[0] if platform_counts else ("Unknown", 0)
    
    # Đếm crisis levels
    high_crisis = sum(1 for n in negative_mentions if n["crisis_level"] >= 4)
    
    if risk_level == "High":
        return (
            f"⚠️ CẢNH BÁO KHỦNG HOẢNG: Phát hiện {neg_count}/{total_count} đề cập tiêu cực "
            f"liên quan đến '{keyword}'. "
            f"Trong đó có {high_crisis} đề cập ở mức khủng hoảng nghiêm trọng. "
            f"Nền tảng tập trung nhiều nhất: {top_platform[0]} ({top_platform[1]} đề cập). "
            "Cần triển khai phản hồi khẩn cấp và theo dõi chặt chẽ."
        )
    elif risk_level == "Medium":
        return (
            f"⚡ CẢNH BÁO: Phát hiện {neg_count} đề cập tiêu cực trong tổng số {total_count} "
            f"đề cập về '{keyword}'. "
            f"Nền tảng chính: {top_platform[0]}. "
            "Xu hướng tiêu cực đang gia tăng, cần theo dõi sát và chuẩn bị phương án phản hồi."
        )
    else:
        return (
            f"Phát hiện {neg_count} đề cập tiêu cực nhẹ trong tổng số {total_count} "
            f"đề cập về '{keyword}'. "
            "Tình hình nằm trong tầm kiểm soát, nên tiếp tục giám sát định kỳ."
        )


def _generate_action_items(
    keyword: str,
    risk_level: str,
    negative_mentions: List[Dict],
) -> List[Dict]:
    """
    Tạo danh sách hành động đề xuất dựa trên mức độ rủi ro.
    
    Trả về 3 action items với cấu trúc:
    {"step": int, "title": str, "description": str, "priority": str}
    """
    if risk_level == "High":
        return [
            {
                "step": 1,
                "title": "Họp khẩn cấp đội xử lý khủng hoảng",
                "description": (
                    f"Triệu tập ngay đội PR và Legal để đánh giá "
                    f"tình hình các đề cập tiêu cực về '{keyword}'. "
                    "Thu thập và lưu trữ tất cả bằng chứng liên quan."
                ),
                "priority": "critical",
            },
            {
                "step": 2,
                "title": "Soạn thảo phản hồi chính thức",
                "description": (
                    "Chuẩn bị tuyên bố chính thức để phản hồi trên các nền tảng "
                    "có nhiều đề cập tiêu cực. Đảm bảo nội dung minh bạch, "
                    "chuyên nghiệp và thể hiện trách nhiệm."
                ),
                "priority": "high",
            },
            {
                "step": 3,
                "title": "Giám sát và báo cáo theo thời gian thực",
                "description": (
                    "Thiết lập cơ chế giám sát 24/7 trong vòng 48 giờ tới. "
                    "Báo cáo cập nhật mỗi 4 giờ cho ban lãnh đạo. "
                    "Chuẩn bị phương án pháp lý nếu có nội dung vi phạm."
                ),
                "priority": "high",
            },
        ]
    elif risk_level == "Medium":
        return [
            {
                "step": 1,
                "title": "Phân tích chi tiết các đề cập tiêu cực",
                "description": (
                    f"Xem xét kỹ nội dung tiêu cực về '{keyword}' "
                    "để xác định nguyên nhân gốc rễ. "
                    "Phân loại theo chủ đề: chất lượng, dịch vụ, giá cả, v.v."
                ),
                "priority": "medium",
            },
            {
                "step": 2,
                "title": "Phản hồi trực tiếp trên mạng xã hội",
                "description": (
                    "Trả lời các bình luận tiêu cực một cách chuyên nghiệp. "
                    "Thể hiện sự quan tâm và cam kết cải thiện. "
                    "Tránh tranh cãi công khai."
                ),
                "priority": "medium",
            },
            {
                "step": 3,
                "title": "Theo dõi xu hướng trong 7 ngày tới",
                "description": (
                    "Tiếp tục giám sát sentiment và số lượng đề cập. "
                    "Nếu xu hướng tiêu cực tăng, nâng cấp lên mức High."
                ),
                "priority": "low",
            },
        ]
    else:
        return [
            {
                "step": 1,
                "title": "Duy trì giám sát định kỳ",
                "description": (
                    f"Tiếp tục theo dõi các đề cập về '{keyword}' "
                    "theo lịch trình thông thường. "
                    "Tình hình hiện tại ổn định."
                ),
                "priority": "low",
            },
            {
                "step": 2,
                "title": "Tương tác tích cực với cộng đồng",
                "description": (
                    "Tận dụng các phản hồi tích cực để xây dựng thương hiệu. "
                    "Chia sẻ nội dung hữu ích và tương tác với khách hàng."
                ),
                "priority": "low",
            },
            {
                "step": 3,
                "title": "Cập nhật báo cáo tuần",
                "description": (
                    "Tổng hợp dữ liệu vào báo cáo tuần "
                    "cho ban quản lý và đội Marketing."
                ),
                "priority": "low",
            },
        ]


def _extract_negative_themes(
    negative_mentions: List[Dict],
    top_n: int = 5,
) -> List[Dict]:
    """
    Trích xuất chủ đề tiêu cực phổ biến từ các đề cập.
    
    Sử dụng keyword matching đơn giản. Trong production,
    có thể thay bằng topic modeling (LDA, BERTopic).
    """
    theme_keywords = {
        "Chất lượng sản phẩm": [
            "chất lượng", "tệ", "kém", "dở", "lỗi", "hỏng",
            "broken", "quality",
        ],
        "Dịch vụ khách hàng": [
            "dịch vụ", "phản hồi", "chậm", "thái độ", "nhân viên",
            "service", "support",
        ],
        "Giá cả": [
            "giá", "đắt", "mắc", "tăng giá", "chi phí",
            "price", "expensive",
        ],
        "Giao hàng": [
            "giao hàng", "ship", "chậm trễ", "delay", "đóng gói",
            "vận chuyển",
        ],
        "An toàn / Sức khỏe": [
            "nguy hiểm", "dị ứng", "độc", "sức khỏe", "cấp cứu",
            "an toàn", "health", "safety",
        ],
        "Lừa đảo / Gian lận": [
            "lừa đảo", "scam", "fake", "giả mạo", "gian lận",
            "fraud",
        ],
        "Bảo mật / Dữ liệu": [
            "rò rỉ", "hack", "thông tin", "bảo mật", "dữ liệu",
            "privacy", "data",
        ],
    }
    
    theme_counts: Dict[str, int] = {}
    
    for mention in negative_mentions:
        content_lower = mention.get("content", "").lower()
        for theme, keywords in theme_keywords.items():
            for kw in keywords:
                if kw in content_lower:
                    theme_counts[theme] = theme_counts.get(theme, 0) + 1
                    break  # Chỉ đếm 1 lần per theme per mention
    
    sorted_themes = sorted(
        theme_counts.items(), key=lambda x: x[1], reverse=True
    )
    
    return [
        {"theme": theme, "count": count}
        for theme, count in sorted_themes[:top_n]
    ]
