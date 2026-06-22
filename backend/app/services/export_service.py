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
from app.core.tenant import apply_tenant_filter
from app.models.user import User

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
        
        # SUMMARY SHEET
        ws_summary = wb.active
        ws_summary.title = "Summary"
        
        # MENTIONS SHEET
        ws_mentions = wb.create_sheet("Mentions")
        mentions_headers = ["ID", "Project ID", "Keyword", "Source", "Platform", "Title", "URL", "Published At"]
        ws_mentions.append(mentions_headers)
        for cell in ws_mentions[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="3b82f6", end_color="3b82f6", fill_type="solid")
            
        mentions_query = apply_tenant_filter(select(Mention), Mention, current_user)
        if filters.get("project_id"):
            mentions_query = mentions_query.where(Mention.project_id == filters["project_id"])
        if filters.get("date_from"):
            mentions_query = mentions_query.where(Mention.published_at >= filters["date_from"])
        if filters.get("date_to"):
            mentions_query = mentions_query.where(Mention.published_at <= filters["date_to"])
            
        mentions = db.execute(mentions_query).scalars().all()
        for m in mentions:
            ws_mentions.append([
                m.id, m.project_id, m.keyword_text, m.source_type, m.platform,
                m.title, m.url, ExportService._safe_str(m.published_at)
            ])
            
        # ALERTS SHEET
        ws_alerts = wb.create_sheet("Alerts")
        alerts_headers = ["ID", "Severity", "Status", "Title", "Created At"]
        ws_alerts.append(alerts_headers)
        for cell in ws_alerts[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="ef4444", end_color="ef4444", fill_type="solid")
            
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
            
        # INCIDENTS SHEET
        ws_incidents = wb.create_sheet("Incidents")
        incidents_headers = ["ID", "Title", "Status", "Owner ID", "Created At"]
        ws_incidents.append(incidents_headers)
        for cell in ws_incidents[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="f59e0b", end_color="f59e0b", fill_type="solid")
            
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
            
        # POPULATE SUMMARY SHEET
        ws_summary.append(["Project Summary Report"])
        ws_summary["A1"].font = Font(bold=True, size=16)
        ws_summary.append(["Generated At:", ExportService._safe_str(datetime.now())])
        ws_summary.append([])
        
        ws_summary.append(["Metric", "Count"])
        ws_summary["A4"].font = Font(bold=True)
        ws_summary["B4"].font = Font(bold=True)
        
        ws_summary.append(["Total Mentions", len(mentions)])
        ws_summary.append(["Total Alerts", len(alerts)])
        ws_summary.append(["Total Incidents", len(incidents)])

        # Save to memory
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
