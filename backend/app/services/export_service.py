import csv
import io
from typing import Optional, List, Dict, Any, Generator
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill
from sqlalchemy import select, and_, func
from sqlalchemy.orm import Session

from app.models.mention import Mention, AIAnalysis
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.source import Source
from app.models.keyword import KeywordGroup
from app.core.tenant import apply_tenant_filter
from app.models.user import User
from app.models.report import ReportExport, ExportStatus
from app.services.pdf_generator import PDFGenerator
import os
import traceback
from app.core.database import SessionLocal

class ExportService:
    @staticmethod
    def _safe_str(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.isoformat()
        if hasattr(value, 'value'): # for Enums
            return str(value.value)
        return str(value).replace('\r', ' ').replace('\n', ' ')

    @staticmethod
    def export_mentions_csv(db: Session, current_user: User, filters: dict) -> Generator[str, None, None]:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        headers = [
            "mention_id", "project_id", "keyword", "source", "platform",
            "title", "content_excerpt", "url", "sentiment", "risk_score",
            "severity", "published_at", "created_at"
        ]
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        query = apply_tenant_filter(select(Mention), Mention, current_user)
        
        if filters.get("project_id"):
            query = query.where(Mention.project_id == filters["project_id"])
        if filters.get("date_from"):
            query = query.where(Mention.published_at >= filters["date_from"])
        if filters.get("date_to"):
            query = query.where(Mention.published_at <= filters["date_to"])
            
        # Get AI Analysis map for these mentions
        # In a very large dataset, this should be joined or batched, but for this phase:
        mentions = db.execute(query).scalars().all()
        mention_ids = [m.id for m in mentions]
        
        analyses = {}
        if mention_ids:
            analyses_query = select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))
            for a in db.execute(analyses_query).scalars().all():
                analyses[a.mention_id] = a
                
        # To handle sentiment and risk_level filters we apply them in-memory
        # (Could also be done with JOIN, but this is simple and matches existing patterns)
        for m in mentions:
            analysis = analyses.get(m.id)
            sentiment_str = ""
            risk_score = ""
            crisis_level = ""
            
            if analysis:
                sentiment_str = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else str(analysis.sentiment)
                risk_score = analysis.risk_score
                crisis_level = analysis.crisis_level
                
            # Apply AI filters manually if they were passed
            if filters.get("sentiment") and sentiment_str != filters["sentiment"]:
                continue
            if filters.get("risk_level"):
                # Simplistic risk level filter: low(0-30), medium(31-60), high(61-80), critical(81-100)
                rl = filters["risk_level"]
                if not analysis:
                    continue
                if rl == "low" and risk_score > 30: continue
                if rl == "medium" and (risk_score <= 30 or risk_score > 60): continue
                if rl == "high" and (risk_score <= 60 or risk_score > 80): continue
                if rl == "critical" and risk_score <= 80: continue

            excerpt = m.content[:200] + "..." if m.content and len(m.content) > 200 else m.content
            
            row = [
                m.id, m.project_id, m.keyword_text, m.source_type, m.platform,
                m.title, excerpt, m.url, sentiment_str, risk_score, crisis_level,
                m.published_at, m.collected_at
            ]
            
            writer.writerow([ExportService._safe_str(v) for v in row])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    @staticmethod
    def export_alerts_csv(db: Session, current_user: User, filters: dict) -> Generator[str, None, None]:
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "alert_id", "project_id", "alert_type", "severity", "status",
            "title", "message", "mention_id", "created_at", "resolved_at"
        ]
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        query = apply_tenant_filter(select(Alert), Alert, current_user)
        
        if filters.get("project_id"):
            query = query.where(Alert.project_id == filters["project_id"])
        if filters.get("date_from"):
            query = query.where(Alert.created_at >= filters["date_from"])
        if filters.get("date_to"):
            query = query.where(Alert.created_at <= filters["date_to"])
        if filters.get("severity"):
            query = query.where(Alert.severity == filters["severity"])
        if filters.get("status"):
            query = query.where(Alert.status == filters["status"])
            
        alerts = db.execute(query).scalars().all()
        
        for a in alerts:
            row = [
                a.id, a.project_id, "general", a.severity, a.status,
                a.title, a.message, a.mention_id, a.created_at, a.resolved_at
            ]
            writer.writerow([ExportService._safe_str(v) for v in row])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    @staticmethod
    def export_incidents_csv(db: Session, current_user: User, filters: dict) -> Generator[str, None, None]:
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "incident_id", "user_id", "title", "status",
            "assigned_to", "created_at", "updated_at", "resolved_at"
        ]
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        # apply tenant filter via user relationship for incidents if project_id isn't directly on it
        # Actually incident has user_id, mention_id, owner_id. Let's use user_id to scope
        query = select(Incident)
        if not current_user.is_superuser:
            query = query.where(Incident.user_id == current_user.id)
            
        if filters.get("date_from"):
            query = query.where(Incident.created_at >= filters["date_from"])
        if filters.get("date_to"):
            query = query.where(Incident.created_at <= filters["date_to"])
        if filters.get("status"):
            query = query.where(Incident.status == filters["status"])
            
        incidents = db.execute(query).scalars().all()
        
        for inc in incidents:
            row = [
                inc.id, inc.user_id, inc.title, inc.status,
                inc.owner_id, inc.created_at, inc.updated_at, inc.resolved_at
            ]
            writer.writerow([ExportService._safe_str(v) for v in row])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    @staticmethod
    def export_project_summary_xlsx(db: Session, current_user: User, filters: dict) -> bytes:
        wb = openpyxl.Workbook()
        
        # Helper for auto-sizing columns
        def adjust_column_widths(ws):
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                # Cap the maximum width to avoid excessively wide columns for long text like content
                ws.column_dimensions[column].width = min(adjusted_width, 80)
        
        # SUMMARY SHEET
        ws_summary = wb.active
        ws_summary.title = "Summary"
        
        # MENTIONS SHEET
        ws_mentions = wb.create_sheet("Mentions")
        mentions_headers = ["ID", "Keyword", "Source", "Platform", "Title", "Sentiment", "URL", "Published At"]
        ws_mentions.append(mentions_headers)
        for cell in ws_mentions[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="3b82f6", end_color="3b82f6", fill_type="solid")
        ws_mentions.freeze_panes = "A2"
            
        mentions_query = apply_tenant_filter(select(Mention), Mention, current_user)
        project_name = "Tất cả dự án"
        if filters.get("project_id"):
            mentions_query = mentions_query.where(Mention.project_id == filters["project_id"])
            project = db.execute(apply_tenant_filter(select(KeywordGroup), KeywordGroup, current_user).where(KeywordGroup.id == filters["project_id"])).scalar_one_or_none()
            if project:
                project_name = project.name
        
        if filters.get("date_from"):
            mentions_query = mentions_query.where(Mention.published_at >= filters["date_from"])
        if filters.get("date_to"):
            mentions_query = mentions_query.where(Mention.published_at <= filters["date_to"])
            
        mentions = db.execute(mentions_query).scalars().all()
        mention_ids = [m.id for m in mentions]
        
        analyses_list = db.execute(
            select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))
        ).scalars().all() if mention_ids else []
        analyses = {a.mention_id: a for a in analyses_list}
        
        sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}

        for m in mentions:
            analysis = analyses.get(m.id)
            sentiment_str = "neutral"
            if analysis:
                sent_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
                if sent_val in sentiment_counts:
                    sentiment_counts[sent_val] += 1
                elif sent_val == 'negative_medium':
                    sentiment_counts["negative"] += 1
                sentiment_str = str(sent_val)

            ws_mentions.append([
                m.id, m.keyword_text, m.source_type, m.platform,
                m.title, sentiment_str, m.url, ExportService._safe_str(m.published_at)
            ])
            
        adjust_column_widths(ws_mentions)
            
        # ALERTS SHEET
        ws_alerts = wb.create_sheet("Alerts")
        alerts_headers = ["ID", "Severity", "Status", "Title", "Created At"]
        ws_alerts.append(alerts_headers)
        for cell in ws_alerts[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="ef4444", end_color="ef4444", fill_type="solid")
        ws_alerts.freeze_panes = "A2"
            
        alerts_query = apply_tenant_filter(select(Alert), Alert, current_user)
        if filters.get("project_id"):
            alerts_query = alerts_query.where(Alert.project_id == filters["project_id"])
        if filters.get("date_from"):
            alerts_query = alerts_query.where(Alert.created_at >= filters["date_from"])
        if filters.get("date_to"):
            alerts_query = alerts_query.where(Alert.created_at <= filters["date_to"])
            
        alerts = db.execute(alerts_query).scalars().all()
        for a in alerts:
            ws_alerts.append([
                a.id, ExportService._safe_str(a.severity), ExportService._safe_str(a.status),
                a.title, ExportService._safe_str(a.created_at)
            ])
            
        adjust_column_widths(ws_alerts)
            
        # INCIDENTS SHEET
        ws_incidents = wb.create_sheet("Incidents")
        incidents_headers = ["ID", "Title", "Status", "Owner ID", "Created At"]
        ws_incidents.append(incidents_headers)
        for cell in ws_incidents[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="f59e0b", end_color="f59e0b", fill_type="solid")
        ws_incidents.freeze_panes = "A2"
            
        incidents_query = select(Incident)
        if not current_user.is_superuser:
            incidents_query = incidents_query.where(Incident.user_id == current_user.id)
        if filters.get("date_from"):
            incidents_query = incidents_query.where(Incident.created_at >= filters["date_from"])
        if filters.get("date_to"):
            incidents_query = incidents_query.where(Incident.created_at <= filters["date_to"])
            
        incidents = db.execute(incidents_query).scalars().all()
        for i in incidents:
            ws_incidents.append([
                i.id, i.title, ExportService._safe_str(i.status), i.owner_id, ExportService._safe_str(i.created_at)
            ])
            
        adjust_column_widths(ws_incidents)
            
        # POPULATE SUMMARY SHEET
        ws_summary.append(["Báo Cáo Tổng Hợp (Project Summary Report)"])
        ws_summary["A1"].font = Font(bold=True, size=16, color="4f46e5")
        
        ws_summary.append([])
        ws_summary.append(["Thông Tin Chung", ""])
        ws_summary["A3"].font = Font(bold=True, size=12)
        
        ws_summary.append(["Dự án", project_name])
        ws_summary.append(["Từ ngày", filters.get("date_from") or "Tất cả"])
        ws_summary.append(["Đến ngày", filters.get("date_to") or "Tất cả"])
        ws_summary.append(["Ngày xuất báo cáo", ExportService._safe_str(datetime.now())])
        
        ws_summary.append([])
        ws_summary.append(["Chỉ Số Tổng Quan", "Số Lượng"])
        ws_summary["A9"].font = Font(bold=True, size=12)
        ws_summary["B9"].font = Font(bold=True, size=12)
        
        ws_summary.append(["Tổng Mentions", len(mentions)])
        ws_summary.append(["Tích cực (Positive)", sentiment_counts["positive"]])
        ws_summary.append(["Tiêu cực (Negative)", sentiment_counts["negative"]])
        ws_summary.append(["Trung lập (Neutral)", sentiment_counts["neutral"]])
        ws_summary.append(["Tổng số Cảnh báo (Alerts)", len(alerts)])
        ws_summary.append(["Tổng số Sự cố (Incidents)", len(incidents)])
        
        adjust_column_widths(ws_summary)

        # Save to memory
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()

    @staticmethod
    def process_export(export_id: int):
        db = SessionLocal()
        export_job = db.execute(select(ReportExport).where(ReportExport.id == export_id)).scalar_one_or_none()
        if not export_job:
            db.close()
            return

        try:
            export_job.status = ExportStatus.RUNNING
            db.commit()

            current_user = db.execute(select(User).where(User.id == export_job.requested_by)).scalar_one_or_none()
            filters = {}
            if export_job.project_id:
                filters["project_id"] = export_job.project_id

            # Create data dir
            export_dir = os.path.join(os.getcwd(), 'data', 'exports')
            os.makedirs(export_dir, exist_ok=True)
            
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"Export_{export_id}_{timestamp_str}.{export_job.report_type}"
            file_path = os.path.join(export_dir, file_name)

            if export_job.report_type == 'excel' or export_job.report_type == 'xlsx':
                content = ExportService.export_project_summary_xlsx(db, current_user, filters)
                with open(file_path, "wb") as f:
                    f.write(content)
            elif export_job.report_type == 'pdf':
                # Build data dict for PDF
                mentions_query = apply_tenant_filter(select(Mention), Mention, current_user)
                project_name = "Tất cả dự án"
                if filters.get("project_id"):
                    mentions_query = mentions_query.where(Mention.project_id == filters["project_id"])
                    project = db.execute(apply_tenant_filter(select(KeywordGroup), KeywordGroup, current_user).where(KeywordGroup.id == filters["project_id"])).scalar_one_or_none()
                    if project:
                        project_name = project.name
                        
                mentions = db.execute(mentions_query).scalars().all()
                mention_ids = [m.id for m in mentions]
                
                analyses_list = db.execute(select(AIAnalysis).where(AIAnalysis.mention_id.in_(mention_ids))).scalars().all() if mention_ids else []
                analyses = {a.mention_id: a for a in analyses_list}
                
                sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
                source_counts = {}
                selected_mentions = []
                
                for m in mentions:
                    analysis = analyses.get(m.id)
                    sent_val = "neutral"
                    if analysis:
                        sent_val = analysis.sentiment.value if hasattr(analysis.sentiment, 'value') else analysis.sentiment
                        if sent_val == 'negative_medium':
                            sent_val = 'negative'
                        if sent_val in sentiment_counts:
                            sentiment_counts[sent_val] += 1
                    
                    st = m.source_type or "unknown"
                    source_counts[st] = source_counts.get(st, 0) + 1
                    
                    if m.add_to_report:
                        selected_mentions.append({
                            "title": m.title,
                            "domain": m.domain,
                            "sentiment": sent_val,
                            "snippet": m.snippet or m.content
                        })
                
                sources_list = [{"name": k.capitalize(), "count": v} for k, v in source_counts.items()]
                sources_list.sort(key=lambda x: x["count"], reverse=True)
                
                alerts = db.execute(apply_tenant_filter(select(Alert), Alert, current_user)).scalars().all()
                incidents_query = select(Incident)
                if not current_user.is_superuser:
                    incidents_query = incidents_query.where(Incident.user_id == current_user.id)
                incidents = db.execute(incidents_query).scalars().all()

                pdf_data = {
                    "project_name": project_name,
                    "date_from": None,
                    "date_to": None,
                    "metrics": {
                        "total_mentions": len(mentions),
                        "sentiment": sentiment_counts,
                        "total_alerts": len(alerts),
                        "total_incidents": len(incidents)
                    },
                    "top_sources": sources_list,
                    "selected_mentions": selected_mentions
                }
                
                content = PDFGenerator.generate_project_summary(pdf_data)
                with open(file_path, "wb") as f:
                    f.write(content)
            else:
                raise ValueError(f"Unsupported report type: {export_job.report_type}")

            export_job.file_path = file_path
            export_job.status = ExportStatus.SUCCESS
            export_job.completed_at = datetime.now()
            db.commit()

        except Exception as e:
            export_job.status = ExportStatus.FAILED
            export_job.error_message = str(e) + "\n" + traceback.format_exc()
            export_job.completed_at = datetime.now()
            db.commit()
        finally:
            db.close()
