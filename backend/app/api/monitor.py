"""
Monitor API Endpoints — REAL DATA ONLY
=======================================
Các endpoint chính cho chức năng giám sát mạng xã hội theo từ khóa.
Không sử dụng mock data / fake mentions / giả lập.

Endpoints:
    POST /api/monitor/start          - Lưu keyword + quét nguồn thật
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
from app.models.keyword import Keyword, KeywordGroup, KeywordType
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.services.crawl_service import crawl_source

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================================

class MonitorStartRequest(BaseModel):
    keyword: str


class MonitorStartResponse(BaseModel):
    keyword: str
    keyword_created: bool
    sources_scanned: int
    crawl_jobs_created: int
    mentions_created: int
    alerts_created: int
    message: str
    worker_status: Optional[str] = None


# ============================================================================
# POST /api/monitor/start
# Lưu keyword thật + quét nguồn thật — KHÔNG giả lập
# ============================================================================

@router.post("/start", response_model=MonitorStartResponse)
def start_monitoring(
    body: MonitorStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Bắt đầu theo dõi một từ khóa.

    Quy trình thật:
    1. Validate keyword
    2. Tạo/cập nhật keyword + keyword group trong database
    3. Kiểm tra nguồn (sources) đang hoạt động
    4. Nếu không có nguồn → trả về cảnh báo, KHÔNG tạo fake data
    5. Nếu có nguồn → quét thật qua crawl_service
    6. Tạo crawl_job, mention, alert thật
    """
    keyword_text = body.keyword.strip()

    if not keyword_text:
        raise HTTPException(
            status_code=400,
            detail="Vui lòng nhập từ khóa cần theo dõi."
        )

    if len(keyword_text) > 200:
        raise HTTPException(
            status_code=400,
            detail="Từ khóa quá dài. Vui lòng nhập tối đa 200 ký tự."
        )

    logger.info(f"[Monitor] User {current_user.email} bắt đầu theo dõi: '{keyword_text}'")

    # ── Step 1: Tạo/cập nhật keyword trong database ──────────────────
    keyword_created = False
    try:
        keyword_created = _ensure_keyword_exists(db, keyword_text)
    except Exception as e:
        logger.error(f"[Monitor] Error creating keyword: {e}")
        # Continue even if keyword creation fails — we can still scan

    # ── Step 2: Kiểm tra nguồn hoạt động ─────────────────────────────
    active_sources = db.execute(
        select(Source).where(Source.is_active == True)
    ).scalars().all()

    active_sources = [s for s in active_sources if s.is_active]

    if not active_sources:
        return MonitorStartResponse(
            keyword=keyword_text,
            keyword_created=keyword_created,
            sources_scanned=0,
            crawl_jobs_created=0,
            mentions_created=0,
            alerts_created=0,
            message="Chưa có nguồn quét. Hãy thêm nguồn RSS/Web trước."
        )

    # ── Step 3: Kiểm tra worker status ───────────────────────────────
    worker_status = None
    try:
        from app.services.scheduler_service import scheduler_started
        if not scheduler_started:
            worker_status = "not_running"
    except Exception:
        worker_status = "unknown"

    # ── Step 4: Quét thật từng nguồn ─────────────────────────────────
    sources_scanned = 0
    mentions_created = 0
    alerts_created = 0
    crawl_jobs_created = 0
    errors = []

    for source in active_sources:
        try:
            # Tạo crawl_job thật
            job = CrawlJob(
                source_ids=[source.id],
                job_type='monitor',
                status=CrawlJobStatus.RUNNING,
                total_sources=1,
                processed_sources=0,
                mentions_found=0,
                started_at=datetime.utcnow(),
                meta_data={"monitor_keyword": keyword_text},
            )
            db.add(job)
            db.flush()
            crawl_jobs_created += 1

            # Quét thật bằng crawl_service
            result = crawl_source(db, source.id, job_id=job.id)

            # Cập nhật job
            job.status = CrawlJobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.mentions_found = result.get('mentions_new', 0)
            job.processed_sources = 1

            # Cập nhật source stats
            source.last_crawled_at = datetime.utcnow()
            source.last_success_at = datetime.utcnow()
            source.crawl_count = (source.crawl_count or 0) + 1

            sources_scanned += 1
            mentions_created += result.get('mentions_new', 0)

            db.commit()

        except Exception as e:
            logger.error(f"[Monitor] Error scanning source {source.id} ({source.name}): {e}")
            errors.append(f"{source.name}: {str(e)[:100]}")

            # Mark job as failed
            try:
                job.status = CrawlJobStatus.FAILED
                job.completed_at = datetime.utcnow()
                job.error_message = str(e)[:2000]
                job.processed_sources = 1
                source.error_count = (source.error_count or 0) + 1
                source.last_error = str(e)[:2000]
                db.commit()
            except Exception:
                db.rollback()

            sources_scanned += 1
            continue

    # ── Đếm alerts được tạo ──────────────────────────────────────────
    try:
        recent_alerts = db.execute(
            select(func.count(Alert.id)).where(
                Alert.created_at >= datetime.utcnow() - timedelta(minutes=5)
            )
        ).scalar() or 0
        alerts_created = recent_alerts
    except Exception:
        pass

    # ── Tạo message ──────────────────────────────────────────────────
    if mentions_created > 0:
        message = (
            f"Đã quét {sources_scanned} nguồn thật. "
            f"Tìm thấy {mentions_created} đề cập mới."
        )
    elif sources_scanned > 0 and mentions_created == 0:
        message = (
            f"Đã quét {sources_scanned} nguồn. "
            "Không tìm thấy đề cập nào phù hợp với từ khóa."
        )
    else:
        message = "Lỗi khi quét nguồn. Vui lòng kiểm tra cấu hình nguồn."

    if errors:
        message += f" ({len(errors)} lỗi)"

    if worker_status == "not_running":
        message += " Worker chưa chạy. RSS sẽ không tự quét 24/7."

    logger.info(f"[Monitor] Hoàn tất: {message}")

    return MonitorStartResponse(
        keyword=keyword_text,
        keyword_created=keyword_created,
        sources_scanned=sources_scanned,
        crawl_jobs_created=crawl_jobs_created,
        mentions_created=mentions_created,
        alerts_created=alerts_created,
        message=message,
        worker_status=worker_status,
    )


# ============================================================================
# GET /api/monitor/dashboard?keyword={keyword}
# Dashboard tổng hợp — chỉ dữ liệu thật từ database
# ============================================================================

@router.get("/dashboard")
def get_monitor_dashboard(
    keyword: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lấy dữ liệu dashboard tổng hợp cho một từ khóa.
    Chỉ trả về dữ liệu thật từ database.
    """
    keyword = keyword.strip()

    try:
        # ── Tìm tất cả mentions chứa keyword ────────────────────────
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
                "message": f"Không tìm thấy đề cập nào cho từ khóa '{keyword}'.",
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

        # ── Top Buzzwords — từ nội dung thật ─────────────────────────
        top_buzzwords = _extract_buzzwords_from_mentions(all_mentions, top_n=10)

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

            # Get source info for platform
            if platform == "Unknown":
                try:
                    source = db.execute(
                        select(Source).where(Source.id == m.source_id)
                    ).scalar_one_or_none()
                    if source:
                        stype = source.source_type
                        if hasattr(stype, 'value'):
                            stype = stype.value
                        platform = stype.replace('_', ' ').title()
                except Exception:
                    pass

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
    Dữ liệu từ database thật.
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
                "total_mentions": 0,
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

        # ── Tạo Crisis Summary ────────────────────────────────────────
        crisis_summary = _generate_crisis_summary(
            keyword, negative_mentions, total_count, risk_level
        )

        # ── Tạo Action Items ─────────────────────────────────────────
        action_items = _generate_action_items(
            keyword, risk_level, negative_mentions
        )

        # ── Top Negative Themes ──────────────────────────────────────
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

def _ensure_keyword_exists(db: Session, keyword_text: str) -> bool:
    """
    Đảm bảo keyword tồn tại trong database.
    Tạo keyword group "Monitor" nếu chưa có, sau đó tạo keyword.
    Returns True if keyword was newly created.
    """
    # Kiểm tra keyword đã tồn tại chưa
    existing = db.execute(
        select(Keyword).where(
            Keyword.keyword == keyword_text,
            Keyword.is_active == True
        )
    ).scalar_one_or_none()

    if existing:
        return False

    # Tìm hoặc tạo keyword group "Monitor"
    monitor_group = db.execute(
        select(KeywordGroup).where(KeywordGroup.name == "Monitor")
    ).scalar_one_or_none()

    if not monitor_group:
        monitor_group = KeywordGroup(
            name="Monitor",
            description="Từ khóa được thêm từ trang Monitor",
            priority=3,
            is_active=True,
        )
        db.add(monitor_group)
        db.flush()

    # Tạo keyword mới
    new_keyword = Keyword(
        group_id=monitor_group.id,
        keyword=keyword_text,
        keyword_type=KeywordType.GENERAL,
        is_active=True,
        is_excluded=False,
    )
    db.add(new_keyword)
    db.commit()

    logger.info(f"[Monitor] Created keyword: '{keyword_text}' in group 'Monitor'")
    return True


def _extract_buzzwords_from_mentions(
    mentions: List[Mention],
    top_n: int = 10,
) -> List[Dict]:
    """
    Trích xuất buzzwords từ nội dung mentions thật.
    """
    # Vietnamese stopwords
    stopwords = {
        'của', 'và', 'là', 'các', 'có', 'được', 'cho', 'một', 'trong',
        'này', 'đã', 'với', 'những', 'không', 'thì', 'để', 'từ', 'theo',
        'như', 'cũng', 'đến', 'khi', 'hay', 'bị', 'về', 'còn', 'tại',
        'nên', 'rất', 'lại', 'đó', 'sẽ', 'mà', 'bằng', 'vì', 'nhiều',
        'the', 'is', 'and', 'to', 'of', 'in', 'for', 'a', 'an', 'on',
        'at', 'by', 'or', 'it', 'be', 'as', 'that', 'this', 'are',
    }

    word_counts: Dict[str, int] = {}

    for m in mentions:
        text = (m.content or "").lower()
        words = text.split()
        for word in words:
            clean = word.strip('.,!?;:()[]{}"\'-…')
            if len(clean) < 2 or clean in stopwords:
                continue
            if clean.isdigit():
                continue
            word_counts[clean] = word_counts.get(clean, 0) + 1

    # Sort by count, take top N
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"word": w, "count": c} for w, c in sorted_words[:top_n]]


def _compute_volatility(
    mentions: List[Mention],
    analyses_map: Dict[int, AIAnalysis],
    days: int = 7,
) -> List[Dict]:
    """
    Tính toán dữ liệu biến động (volatility) theo ngày.
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
    Dựa trên dữ liệu thật từ database.
    """
    neg_count = len(negative_mentions)

    if neg_count == 0:
        return (
            f"Tình hình theo dõi '{keyword}' ổn định. "
            f"Tổng cộng {total_count} đề cập được phân tích, "
            "không phát hiện xu hướng tiêu cực đáng lo ngại."
        )

    platform_counts = Counter(n["platform"] for n in negative_mentions)
    top_platform = platform_counts.most_common(1)[0] if platform_counts else ("Unknown", 0)

    high_crisis = sum(1 for n in negative_mentions if n["crisis_level"] >= 4)

    if risk_level == "High":
        return (
            f"CẢNH BÁO KHỦNG HOẢNG: Phát hiện {neg_count}/{total_count} đề cập tiêu cực "
            f"liên quan đến '{keyword}'. "
            f"Trong đó có {high_crisis} đề cập ở mức khủng hoảng nghiêm trọng. "
            f"Nền tảng tập trung nhiều nhất: {top_platform[0]} ({top_platform[1]} đề cập). "
            "Cần triển khai phản hồi khẩn cấp và theo dõi chặt chẽ."
        )
    elif risk_level == "Medium":
        return (
            f"CẢNH BÁO: Phát hiện {neg_count} đề cập tiêu cực trong tổng số {total_count} "
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
                    f"Tiếp tục theo dõi '{keyword}' theo lịch trình. "
                    "Cập nhật danh sách từ khóa nếu cần thiết."
                ),
                "priority": "low",
            },
            {
                "step": 2,
                "title": "Phân tích xu hướng dài hạn",
                "description": (
                    "Xem xét xu hướng sentiment trong 30 ngày qua. "
                    "So sánh với giai đoạn trước để phát hiện thay đổi."
                ),
                "priority": "low",
            },
            {
                "step": 3,
                "title": "Cập nhật báo cáo",
                "description": (
                    "Tổng hợp và báo cáo kết quả giám sát cho ban lãnh đạo. "
                    "Đề xuất điều chỉnh chiến lược nếu cần."
                ),
                "priority": "low",
            },
        ]


def _extract_negative_themes(negative_mentions: List[Dict]) -> List[Dict]:
    """
    Trích xuất chủ đề tiêu cực phổ biến từ nội dung thật.
    """
    theme_keywords = {
        "Chất lượng sản phẩm": ["chất lượng", "kém", "tệ", "hỏng", "lỗi", "broken"],
        "Dịch vụ khách hàng": ["dịch vụ", "hỗ trợ", "phản hồi", "service", "support"],
        "Giá cả": ["giá", "đắt", "price", "cost", "phí"],
        "Giao hàng": ["giao hàng", "shipping", "trễ", "delay", "chậm"],
        "Lừa đảo / Gian lận": ["lừa đảo", "scam", "fake", "giả", "fraud"],
        "An toàn": ["nguy hiểm", "danger", "unsafe", "độc hại", "toxic"],
    }

    theme_counts: Dict[str, int] = {}

    for mention in negative_mentions:
        content_lower = (mention.get("content") or "").lower()
        for theme, keywords in theme_keywords.items():
            for kw in keywords:
                if kw in content_lower:
                    theme_counts[theme] = theme_counts.get(theme, 0) + 1
                    break

    sorted_themes = sorted(theme_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"theme": t, "count": c} for t, c in sorted_themes if c > 0]
