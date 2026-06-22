from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import datetime
from typing import List, Optional
from math import ceil
from fastapi.responses import StreamingResponse, Response

from app.services.export_service import ExportService

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.report import Report, ReportType, ReportStatus
from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert
from app.schemas.report import (
    ReportCreate, ReportResponse, ReportListResponse
)
from app.core.tenant import apply_tenant_filter

router = APIRouter()

@router.get("/summary")
def get_reports_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get aggregated data for the Reports module.
    """
    now = datetime.utcnow()
    # Simple summary for the frontend
    
    total_mentions = db.execute(apply_tenant_filter(select(func.count(Mention.id)), Mention, current_user)).scalar() or 0
    total_analyzed = db.execute(
        select(func.count(AIAnalysis.id))
    ).scalar() or 0
    
    positive = db.execute(
        select(func.count(AIAnalysis.id))
        .where(AIAnalysis.sentiment == 'positive')
    ).scalar() or 0
    
    negative = db.execute(
        select(func.count(AIAnalysis.id))
        .where(AIAnalysis.sentiment.in_(['negative']))
    ).scalar() or 0
    
    return {
        "report_period": "All Time",
        "generated_at": now.isoformat(),
        "metrics": {
            "total_mentions": total_mentions,
            "total_analyzed": total_analyzed,
            "sentiment": {
                "positive": positive,
                "negative": negative,
                "neutral": total_analyzed - positive - negative if total_analyzed > 0 else 0
            }
        },
        "top_sources": [
            {"name": "Facebook", "count": int(total_mentions * 0.5)},
            {"name": "News", "count": int(total_mentions * 0.3)},
            {"name": "TikTok", "count": int(total_mentions * 0.2)}
        ]
    }

def _generate_report_inline(report: Report, db: Session, current_user: User = None):
    """Generate report data inline (no Celery needed)."""
    try:
        start_date = report.start_date
        end_date = report.end_date

        # Get mentions in date range
        mentions_query = select(Mention)
        if current_user:
            mentions_query = apply_tenant_filter(mentions_query, Mention, current_user)
            
        mentions = db.execute(
            mentions_query.where(
                and_(
                    Mention.collected_at >= start_date,
                    Mention.collected_at <= end_date,
                    Mention.add_to_report == True
                )
            )
        ).scalars().all()

        mention_ids = [m.id for m in mentions]

        # Prepare selected mentions for report
        selected_mentions = []
        for m in mentions:
            selected_mentions.append({
                "id": m.id,
                "title": m.title,
                "content": m.content,
                "snippet": m.snippet,
                "url": m.url,
                "domain": m.domain,
                "source_name": m.source_id,  # Will be populated if needed
                "sentiment": m.sentiment,
                "published_at": m.published_at.isoformat() if m.published_at else None,
                "collected_at": m.collected_at.isoformat() if m.collected_at else None
            })

        # Get AI analyses
        analyses_list = db.execute(
            select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))
        ).scalars().all() if mention_ids else []
        analyses = {a.mention_id: a for a in analyses_list}

        # Get alerts in date range
        alerts_query = select(Alert)
        if current_user:
            alerts_query = apply_tenant_filter(alerts_query, Alert, current_user)
            
        alerts = db.execute(
            alerts_query.where(
                and_(
                    Alert.created_at >= start_date,
                    Alert.created_at <= end_date
                )
            )
        ).scalars().all()

        total_mentions = len(mentions)
        total_alerts = len(alerts)

        sentiment_counts = {
            "positive": 0, "neutral": 0,
            "negative": 0
        }
        risk_distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        total_risk_score = 0
        high_risk_mentions = []

        for mention in mentions:
            analysis = analyses.get(mention.id)
            if analysis:
                sentiment_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
                if sentiment_val in sentiment_counts:
                    sentiment_counts[sentiment_val] += 1

                risk_score = analysis.risk_score or 0
                if risk_score <= 30:
                    risk_distribution["low"] += 1
                elif risk_score <= 60:
                    risk_distribution["medium"] += 1
                elif risk_score <= 80:
                    risk_distribution["high"] += 1
                else:
                    risk_distribution["critical"] += 1

                total_risk_score += risk_score

                if risk_score >= 70:
                    high_risk_mentions.append({
                        "id": mention.id,
                        "title": mention.title,
                        "url": mention.url,
                        "risk_score": risk_score,
                        "crisis_level": analysis.crisis_level,
                        "summary_vi": analysis.summary_vi
                    })

        avg_risk_score = total_risk_score / total_mentions if total_mentions > 0 else 0.0
        high_risk_mentions.sort(key=lambda x: x["risk_score"], reverse=True)

        report_data = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "total_mentions": total_mentions,
                "total_alerts": total_alerts,
                "avg_risk_score": round(avg_risk_score, 2),
                "high_risk_count": len(high_risk_mentions)
            },
            "sentiment_counts": sentiment_counts,
            "risk_distribution": risk_distribution,
            "high_risk_mentions": high_risk_mentions[:20],
            "selected_mentions": selected_mentions,
        }

        report.data = report_data
        report.status = ReportStatus.COMPLETED
        report.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(report)

    except Exception as e:
        report.status = ReportStatus.FAILED
        report.error_message = str(e)
        db.commit()
        raise


@router.get("", response_model=ReportListResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_type: ReportType = None,
    status: ReportStatus = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List reports with filtering and pagination"""
    query = apply_tenant_filter(select(Report), Report, current_user, "generated_by")

    if report_type:
        query = query.where(Report.report_type == report_type)

    if status:
        query = query.where(Report.status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Report.created_at.desc())

    reports = db.execute(query).scalars().all()

    total_pages = ceil(total / page_size) if total > 0 else 1

    return ReportListResponse(
        items=[ReportResponse.from_orm(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=ReportResponse, status_code=201)
def create_report(
    report_data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new report and generate it inline"""
    report = Report(
        **report_data.dict(),
        generated_by=current_user.id,
        status=ReportStatus.GENERATING
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Generate report inline (no Celery)
    try:
        _generate_report_inline(report, db, current_user)
    except Exception as e:
        # Status already set to FAILED in helper
        pass

    db.refresh(report)
    return ReportResponse.from_orm(report)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a report by ID"""
    report = db.execute(
        apply_tenant_filter(select(Report), Report, current_user, "generated_by").where(Report.id == report_id)
    ).scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse.from_orm(report)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a report"""
    report = db.execute(
        apply_tenant_filter(select(Report), Report, current_user, "generated_by").where(Report.id == report_id)
    ).scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    db.delete(report)
    db.commit()


@router.get("/mentions/export")
def export_mentions(
    format: str = Query(..., description="Export format, only csv is supported here"),
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sentiment: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export mentions to CSV"""
    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="Unsupported format. Only csv is supported for mentions.")
        
    filters = {
        "project_id": project_id,
        "date_from": date_from,
        "date_to": date_to,
        "sentiment": sentiment,
        "risk_level": risk_level
    }
    
    generator = ExportService.export_mentions_csv(db, current_user, filters)
    
    response = StreamingResponse(generator, media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=mentions_export.csv"
    return response


@router.get("/alerts/export")
def export_alerts(
    format: str = Query(..., description="Export format, only csv is supported here"),
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export alerts to CSV"""
    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="Unsupported format. Only csv is supported for alerts.")
        
    filters = {
        "project_id": project_id,
        "date_from": date_from,
        "date_to": date_to,
        "severity": severity,
        "status": status
    }
    
    generator = ExportService.export_alerts_csv(db, current_user, filters)
    
    response = StreamingResponse(generator, media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=alerts_export.csv"
    return response


@router.get("/incidents/export")
def export_incidents(
    format: str = Query(..., description="Export format, only csv is supported here"),
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export incidents to CSV"""
    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="Unsupported format. Only csv is supported for incidents.")
        
    filters = {
        "project_id": project_id,
        "date_from": date_from,
        "date_to": date_to,
        "status": status
    }
    
    generator = ExportService.export_incidents_csv(db, current_user, filters)
    
    response = StreamingResponse(generator, media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=incidents_export.csv"
    return response


@router.get("/project-summary/export")
def export_project_summary(
    format: str = Query(..., description="Export format, only xlsx is supported here"),
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export project summary to XLSX"""
    if format.lower() not in ["xlsx", "excel"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Only xlsx is supported for project summary.")
        
    filters = {
        "project_id": project_id,
        "date_from": date_from,
        "date_to": date_to
    }
    
    content = ExportService.export_project_summary_xlsx(db, current_user, filters)
    
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=project_summary.xlsx"}
    )
