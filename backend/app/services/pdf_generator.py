import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class PDFGenerator:
    @staticmethod
    def generate_project_summary(data: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
        
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        h2_style = styles['Heading2']
        normal_style = styles['Normal']
        
        elements = []
        
        # Title
        project_name = data.get('project_name', 'All Projects')
        if project_name == 'Tất cả dự án':
            project_name = 'All Projects'
            
        elements.append(Paragraph(f"Project Summary Report: {project_name}", title_style))
        elements.append(Spacer(1, 12))
        
        # Info
        elements.append(Paragraph(f"From: {data.get('date_from', 'All time')}", normal_style))
        elements.append(Paragraph(f"To: {data.get('date_to', 'All time')}", normal_style))
        elements.append(Paragraph(f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
        elements.append(Spacer(1, 24))
        
        # Metrics
        elements.append(Paragraph("1. Overview Metrics", h2_style))
        elements.append(Spacer(1, 12))
        
        metrics = data.get('metrics', {})
        sentiment = metrics.get('sentiment', {})
        metrics_data = [
            ["Metric", "Value"],
            ["Total Mentions", str(metrics.get("total_mentions", 0))],
            ["Positive Mentions", str(sentiment.get("positive", 0))],
            ["Negative Mentions", str(sentiment.get("negative", 0))],
            ["Neutral Mentions", str(sentiment.get("neutral", 0))],
            ["Total Alerts", str(metrics.get("total_alerts", 0))],
            ["Total Incidents", str(metrics.get("total_incidents", 0))],
        ]
        
        t_metrics = Table(metrics_data, colWidths=[300, 100])
        t_metrics.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0"))
        ]))
        elements.append(t_metrics)
        elements.append(Spacer(1, 24))
        
        # Sources
        elements.append(Paragraph("2. Top Sources", h2_style))
        elements.append(Spacer(1, 12))
        
        sources = data.get('top_sources', [])
        if not sources:
            elements.append(Paragraph("No sources data available.", normal_style))
        else:
            source_data = [["Source", "Mention Count"]]
            for s in sources[:5]:
                source_data.append([str(s.get('name', 'N/A')), str(s.get('count', 0))])
                
            t_sources = Table(source_data, colWidths=[300, 100])
            t_sources.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0"))
            ]))
            elements.append(t_sources)
            
        elements.append(Spacer(1, 24))
        
        # Mentions
        elements.append(Paragraph("3. Key Mentions", h2_style))
        elements.append(Spacer(1, 12))
        
        mentions = data.get('selected_mentions', [])
        if not mentions:
            elements.append(Paragraph("No mentions selected for report.", normal_style))
        else:
            for m in mentions[:10]: # Limit to 10 in PDF
                elements.append(Paragraph(f"<b>{m.get('title', 'Untitled')}</b>", normal_style))
                elements.append(Paragraph(f"Source: {m.get('domain', 'N/A')} - Sentiment: {m.get('sentiment', 'N/A')}", normal_style))
                snippet = str(m.get('snippet') or m.get('content') or '')
                
                # Replace unsupported characters for reportlab default fonts (latin-1)
                snippet = snippet.encode('ascii', 'ignore').decode('ascii')
                
                if len(snippet) > 200:
                    snippet = snippet[:200] + "..."
                elements.append(Paragraph(f"<i>{snippet}</i>", normal_style))
                elements.append(Spacer(1, 12))
                
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
