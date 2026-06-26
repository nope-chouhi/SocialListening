import io
import os
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
        
        builder_config = data.get('builder_config', {})
        
        # Colors
        accent_color_hex = builder_config.get('accent_color', '#4f46e5')
        theme = builder_config.get('theme', 'light')
        bg_color_hex = '#ffffff' if theme == 'light' else '#050A15'
        text_color_hex = builder_config.get('font_color', '#1e293b') if theme == 'light' else '#ffffff'
        table_bg_hex = '#f8fafc' if theme == 'light' else '#0f172a'
        
        try:
            accent_color = colors.HexColor(accent_color_hex)
            bg_color = colors.HexColor(bg_color_hex)
            text_color = colors.HexColor(text_color_hex)
            table_bg_color = colors.HexColor(table_bg_hex)
        except:
            accent_color = colors.HexColor("#4f46e5")
            bg_color = colors.white
            text_color = colors.black
            table_bg_color = colors.HexColor("#f8fafc")
            
        # Fonts
        font_map = {
            'font-sans': ('Helvetica', 'Helvetica-Bold'),
            'font-serif': ('Times-Roman', 'Times-Bold'),
            'font-mono': ('Courier', 'Courier-Bold')
        }
        font_style_choice = builder_config.get('font_style', 'font-sans')
        normal_font, bold_font = font_map.get(font_style_choice, ('Helvetica', 'Helvetica-Bold'))
        
        # We need to manually adjust styles because reportlab defaults are fixed
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontName=bold_font, textColor=text_color)
        h2_style = ParagraphStyle('CustomH2', parent=styles['Heading2'], fontName=bold_font, textColor=accent_color)
        normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontName=normal_font, textColor=text_color)
        italic_style = ParagraphStyle('CustomItalic', parent=styles['Normal'], fontName=normal_font, textColor=text_color)
        
        elements = []
        
        # Logo
        logo_path = builder_config.get('logo_path')
        if logo_path and os.path.exists(logo_path):
            from reportlab.platypus import Image as RLImage
            try:
                img = RLImage(logo_path, width=100, height=50)
                img.hAlign = 'LEFT'
                elements.append(img)
                elements.append(Spacer(1, 12))
            except Exception:
                pass
        
        # Title
        project_name = data.get('project_name', 'All Projects')
        if project_name == 'Tất cả dự án':
            project_name = 'All Projects'
            
        elements.append(Paragraph(f"Project Summary Report: {project_name}", title_style))
        elements.append(Spacer(1, 12))
        
        date_from_val = data.get('date_from') or 'All time'
        date_to_val = data.get('date_to') or 'All time'
        if date_from_val != 'All time':
            date_from_val = str(date_from_val).split('T')[0]
        if date_to_val != 'All time':
            date_to_val = str(date_to_val).split('T')[0]
            
        elements.append(Paragraph(f"From: {date_from_val}", normal_style))
        elements.append(Paragraph(f"To: {date_to_val}", normal_style))
        elements.append(Paragraph(f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
        elements.append(Spacer(1, 24))
        
        # Sections configuration
        sections = builder_config.get('sections', [])
        # If no sections provided, use defaults
        if not sections:
            sections = [
                {"id": "summary", "enabled": True, "name": "Summary"},
                {"id": "analysis", "enabled": True, "name": "Analysis & Trends"},
                {"id": "sentiment", "enabled": True, "name": "Sentiment"},
                {"id": "influencers", "enabled": True, "name": "Influencers & Sources"},
                {"id": "mentions", "enabled": True, "name": "Mentions"},
                {"id": "alerts", "enabled": False, "name": "Alerts"},
                {"id": "incidents", "enabled": False, "name": "Incidents"}
            ]
            
        metrics = data.get('metrics', {})
        sentiment = metrics.get('sentiment', {})
        
        section_number = 1
        for sec in sections:
            if not sec.get('enabled'):
                continue
                
            sec_id = sec.get('id')
            sec_name = sec.get('name', sec_id)
            
            elements.append(Paragraph(f"{section_number}. {sec_name}", h2_style))
            elements.append(Spacer(1, 12))
            
            if sec_id == 'summary' or sec_id == 'alerts' or sec_id == 'incidents':
                metrics_data = [["Metric", "Value"]]
                if sec_id == 'summary':
                    metrics_data.append(["Total Mentions", str(metrics.get("total_mentions", 0))])
                if sec_id == 'alerts' or sec_id == 'summary':
                    metrics_data.append(["Total Alerts", str(metrics.get("total_alerts", 0))])
                if sec_id == 'incidents' or sec_id == 'summary':
                    metrics_data.append(["Total Incidents", str(metrics.get("total_incidents", 0))])
                
                t_metrics = Table(metrics_data, colWidths=[300, 100])
                t_metrics.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), accent_color),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), bold_font),
                    ('FONTNAME', (0, 1), (-1, -1), normal_font),
                    ('TEXTCOLOR', (0, 1), (-1, -1), text_color),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), table_bg_color),
                    ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0"))
                ]))
                elements.append(t_metrics)
                
            elif sec_id == 'sentiment':
                metrics_data = [
                    ["Sentiment", "Count"],
                    ["Positive", str(sentiment.get("positive", 0))],
                    ["Negative", str(sentiment.get("negative", 0))],
                    ["Neutral", str(sentiment.get("neutral", 0))],
                ]
                t_metrics = Table(metrics_data, colWidths=[300, 100])
                t_metrics.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), accent_color),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), bold_font),
                    ('FONTNAME', (0, 1), (-1, -1), normal_font),
                    ('TEXTCOLOR', (0, 1), (-1, -1), text_color),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), table_bg_color),
                    ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0"))
                ]))
                elements.append(t_metrics)
                
            elif sec_id == 'analysis' or sec_id == 'influencers':
                sources = data.get('top_sources', [])
                if not sources:
                    elements.append(Paragraph("No sources data available.", normal_style))
                else:
                    source_data = [["Source", "Mention Count"]]
                    for s in sources[:5]:
                        source_data.append([str(s.get('name', 'N/A')), str(s.get('count', 0))])
                        
                    t_sources = Table(source_data, colWidths=[300, 100])
                    t_sources.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), accent_color),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, 0), bold_font),
                        ('FONTNAME', (0, 1), (-1, -1), normal_font),
                        ('TEXTCOLOR', (0, 1), (-1, -1), text_color),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), table_bg_color),
                        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0"))
                    ]))
                    elements.append(t_sources)
                    
            elif sec_id == 'mentions':
                mentions = data.get('selected_mentions', [])
                if not mentions:
                    elements.append(Paragraph("No mentions selected for report.", normal_style))
                else:
                    for m in mentions[:10]: # Limit to 10 in PDF
                        elements.append(Paragraph(f"<b>{m.get('title', 'Untitled')}</b>", normal_style))
                        elements.append(Paragraph(f"Source: {m.get('domain', 'N/A')} - Sentiment: {m.get('sentiment', 'N/A')}", normal_style))
                        snippet = str(m.get('snippet') or m.get('content') or '')
                        snippet = snippet.encode('ascii', 'ignore').decode('ascii')
                        if len(snippet) > 200:
                            snippet = snippet[:200] + "..."
                        elements.append(Paragraph(f"<i>{snippet}</i>", italic_style))
                        elements.append(Spacer(1, 12))
            
            elements.append(Spacer(1, 24))
            section_number += 1
                
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
