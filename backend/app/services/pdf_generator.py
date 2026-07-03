import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.widgets.markers import makeMarker

class PDFGenerator:
    @staticmethod
    def _create_pie_chart(data_dict, width=300, height=200, text_color=colors.black):
        d = Drawing(width, height)
        pie = Pie()
        pie.x = 65
        pie.y = 15
        pie.width = 170
        pie.height = 170
        
        pos = data_dict.get('positive', 0)
        neg = data_dict.get('negative', 0)
        neu = data_dict.get('neutral', 0)
        
        pie.data = [pos, neg, neu]
        pie.labels = ['Positive', 'Negative', 'Neutral']
        
        pie.slices[0].fillColor = colors.HexColor('#22c55e')
        pie.slices[1].fillColor = colors.HexColor('#ef4444')
        pie.slices[2].fillColor = colors.HexColor('#64748b')
        
        for i in range(3):
            pie.slices[i].fontName = 'Helvetica'
            pie.slices[i].fontSize = 10
            pie.slices[i].fontColor = text_color
            
        d.add(pie)
        return d

    @staticmethod
    def _create_bar_chart(trend_data, width=400, height=200, accent_color=colors.blue, text_color=colors.black):
        d = Drawing(width, height)
        bc = VerticalBarChart()
        bc.x = 50
        bc.y = 50
        bc.height = 125
        bc.width = 300
        
        sorted_dates = sorted(trend_data.keys())
        if not sorted_dates:
            return d
            
        counts = [trend_data[dt].get('count', 0) or trend_data[dt].get('mentions', 0) for dt in sorted_dates]
        labels = [dt[-5:] for dt in sorted_dates]
        
        bc.data = [counts]
        bc.categoryAxis.categoryNames = labels
        bc.categoryAxis.labels.boxAnchor = 'n'
        bc.categoryAxis.labels.dy = -5
        bc.categoryAxis.labels.angle = 45
        bc.categoryAxis.labels.fontName = 'Helvetica'
        bc.categoryAxis.labels.fillColor = text_color
        
        bc.valueAxis.labels.fontName = 'Helvetica'
        bc.valueAxis.labels.fillColor = text_color
        
        bc.bars[0].fillColor = accent_color
        
        d.add(bc)
        return d

    @staticmethod
    def generate_project_summary(data: dict, config: dict = None) -> bytes:
        config = config or {}
        buffer = io.BytesIO()
        
        enabled_sections_raw = config.get('sections', [])
        if not enabled_sections_raw:
            enabled_ids = ['summary', 'overview', 'executive_summary', 'analysis', 'sentiment', 'categories', 'influencers_sources', 'top_mentions', 'recent_mentions']
        else:
            enabled_ids = [s.get('id') for s in enabled_sections_raw if s.get('enabled', False)]
            
        accent_hex = config.get('accent_color', '#3b82f6')
        font_hex = config.get('font_color', '#1e293b')
        theme = config.get('theme', 'light')
        aspect_ratio = config.get('aspect_ratio', 'vertical')
        language = config.get('language', 'english')
        
        is_dark = theme == 'dark'
        bg_hex = '#0f172a' if is_dark else '#ffffff'
        text_hex = '#f8fafc' if is_dark else font_hex
        muted_hex = '#94a3b8' if is_dark else '#64748b'
        
        accent_color = colors.HexColor(accent_hex)
        text_color = colors.HexColor(text_hex)
        muted_color = colors.HexColor(muted_hex)
        bg_color = colors.HexColor(bg_hex)
        
        page_size = landscape(A4) if aspect_ratio == 'horizontal' else A4
        
        def draw_background(canvas, doc):
            canvas.saveState()
            canvas.setFillColor(bg_color)
            canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
            canvas.restoreState()
            
        doc = SimpleDocTemplate(buffer, pagesize=page_size, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        
        metrics = data.get('metrics', {})
        comparison = data.get('comparison', {})
        sources_list = data.get('sources_list', [])
        tags_list = data.get('tags_list', [])
        top_mentions = data.get('top_mentions', [])
        raw_mentions = data.get('raw_mentions', [])
        exec_summary = data.get('exec_summary', '')
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=32, textColor=text_color, alignment=1, spaceAfter=30)
        h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=24, textColor=text_color, spaceBefore=20, spaceAfter=20)
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=18, textColor=accent_color, spaceBefore=15, spaceAfter=10)
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=text_color, leading=14)
        summary_style = ParagraphStyle('Summary', parent=normal_style, fontSize=11, leading=16, textColor=text_color)
        meta_style = ParagraphStyle('Meta', parent=normal_style, textColor=muted_color, fontSize=9)
        
        elements = []
        
        def safe_num(val):
            if val is None: return 0
            try: return int(val)
            except: return 0
            
        project_name = data.get('project_name', 'All Projects')
        elements.append(Spacer(1, 200))
        elements.append(Paragraph(f"{project_name}", title_style))
        date_from_val = str(data.get('date_from') or 'All time').split('T')[0]
        date_to_val = str(data.get('date_to') or 'All time').split('T')[0]
        elements.append(Paragraph(f"{date_from_val} - {date_to_val}", ParagraphStyle('CoverDate', parent=normal_style, fontSize=16, textColor=muted_color, alignment=1)))
        elements.append(PageBreak())

        if 'summary' in enabled_ids or 'overview' in enabled_ids or 'executive_summary' in enabled_ids:
            elements.append(Spacer(1, 250))
            elements.append(Paragraph("Summary", ParagraphStyle('SectionTitle', parent=title_style, fontSize=48, textColor=text_color, alignment=1)))
            elements.append(PageBreak())

        if 'summary' in enabled_ids or 'overview' in enabled_ids:
            elements.append(Paragraph("Overview", h1_style))
            
            kpi_data = [
                ["Total Mentions", "Total Reach", "Positive Results"],
                [f"{safe_num(metrics.get('total_mentions')):,}", f"{safe_num(metrics.get('total_reach')):,}", f"{safe_num(metrics.get('sentiment', {}).get('positive', 0)):,}"],
                ["Negative Results", "Interactions", "Neutral Results"],
                [f"{safe_num(metrics.get('sentiment', {}).get('negative', 0)):,}", f"{safe_num(metrics.get('interactions', 0)):,}", f"{safe_num(metrics.get('sentiment', {}).get('neutral', 0)):,}"]
            ]
            
            t_kpi = Table(kpi_data, colWidths=[170, 170, 170])
            t_kpi.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#1e293b') if is_dark else colors.HexColor('#f8fafc')),
                ('TEXTCOLOR', (0,0), (-1,-1), text_color),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica'),
                ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
                ('FONTSIZE', (0,1), (-1,1), 22),
                ('FONTNAME', (0,2), (-1,2), 'Helvetica'),
                ('FONTNAME', (0,3), (-1,3), 'Helvetica-Bold'),
                ('FONTSIZE', (0,3), (-1,3), 22),
                ('BOTTOMPADDING', (0,0), (-1,-1), 15),
                ('TOPPADDING', (0,0), (-1,-1), 15),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#334155') if is_dark else colors.HexColor('#e2e8f0'))
            ]))
            elements.append(t_kpi)
            elements.append(Spacer(1, 30))

        if 'executive_summary' in enabled_ids or 'summary' in enabled_ids:
            elements.append(Paragraph("Executive Summary", h2_style))
            if exec_summary:
                elements.append(Paragraph(exec_summary.replace('\n', '<br/>'), summary_style))
            else:
                elements.append(Paragraph("No executive summary data available.", normal_style))
            elements.append(Spacer(1, 30))
            elements.append(PageBreak())

        if 'analysis' in enabled_ids or 'sentiment' in enabled_ids or 'categories' in enabled_ids:
            elements.append(Spacer(1, 250))
            elements.append(Paragraph("Analysis", ParagraphStyle('SectionTitle', parent=title_style, fontSize=48, textColor=text_color, alignment=1)))
            elements.append(PageBreak())
            
            elements.append(Paragraph("Analysis & Trends", h1_style))
            sent_data = metrics.get('sentiment', {})
            trend_data = metrics.get('daily_trend', {})
            
            if not sent_data and not trend_data:
                elements.append(Paragraph("No data available for this section.", normal_style))
            else:
                pie_drawing = PDFGenerator._create_pie_chart(sent_data, text_color=text_color)
                bar_drawing = PDFGenerator._create_bar_chart(trend_data, accent_color=accent_color, text_color=text_color)
                
                chart_table = Table([[pie_drawing, bar_drawing]], colWidths=[250, 250])
                chart_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
                elements.append(chart_table)
                
                chart_labels = Table([["Sentiment Breakdown", "Daily Mention Volume"]], colWidths=[250, 250])
                chart_labels.setStyle(TableStyle([
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'), 
                    ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
                    ('TEXTCOLOR', (0,0), (-1,-1), text_color)
                ]))
                elements.append(chart_labels)
            
            elements.append(Spacer(1, 30))

        if 'categories' in enabled_ids or 'influencers_sources' in enabled_ids:
            elements.append(Paragraph("Sources & Topics", h2_style))
            if not sources_list and not tags_list:
                elements.append(Paragraph("No data available for this section.", normal_style))
                elements.append(Spacer(1, 30))
            else:
                s_data = [["Top Domains / Platforms", "Mentions"]]
                for s in sources_list[:10]:
                    s_data.append([str(s.get('name', 'Unknown')), f"{safe_num(s.get('count', 0)):,}"])
                    
                t_data = [["Top Trending Topics/Hashtags", "Frequency"]]
                for t in tags_list[:10]:
                    t_data.append([str(t.get('name', 'Unknown')), f"{safe_num(t.get('count', 0)):,}"])
                    
                table_bg = colors.HexColor('#1e293b') if is_dark else colors.HexColor('#f8fafc')
                grid_color = colors.HexColor('#334155') if is_dark else colors.HexColor('#e2e8f0')
                
                tsrc = Table(s_data, colWidths=[180, 60])
                tsrc.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), accent_color),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                    ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('GRID', (0,0), (-1,-1), 1, grid_color),
                    ('TEXTCOLOR', (0,1), (-1,-1), text_color),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [bg_color, table_bg])
                ]))
                
                ttag = Table(t_data, colWidths=[180, 60])
                ttag.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), accent_color),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                    ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('GRID', (0,0), (-1,-1), 1, grid_color),
                    ('TEXTCOLOR', (0,1), (-1,-1), text_color),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [bg_color, table_bg])
                ]))
                
                elements.append(Table([[tsrc, ttag]], colWidths=[260, 260], style=[('VALIGN', (0,0), (-1,-1), 'TOP')]))
                elements.append(Spacer(1, 30))
            elements.append(PageBreak())

        if 'top_mentions' in enabled_ids:
            elements.append(Paragraph("Top Mentions by Reach", h1_style))
            if not top_mentions:
                elements.append(Paragraph("No data available for this section.", normal_style))
            else:
                for m in top_mentions:
                    title_val = str(m.get('title') or 'Untitled')
                    domain_val = str(m.get('domain') or 'N/A')
                    sent_val = str(m.get('sentiment') or 'neutral').capitalize()
                    reach_val = m.get('reach')
                    if reach_val is None: reach_val = 0
                    
                    elements.append(Paragraph(f"<b>{title_val}</b>", normal_style))
                    elements.append(Paragraph(f"Platform: {domain_val} | Sentiment: {sent_val} | Reach: {int(reach_val):,}", meta_style))
                    
                    snippet = str(m.get('snippet') or '')
                    snippet = snippet.encode('ascii', 'ignore').decode('ascii')
                    if len(snippet) > 300:
                        snippet = snippet[:300] + "..."
                    elements.append(Paragraph(f"<i>'{snippet}'</i>", ParagraphStyle('Snippet', parent=normal_style, leftIndent=10, textColor=muted_color)))
                    elements.append(Spacer(1, 15))
            elements.append(PageBreak())

        if 'recent_mentions' in enabled_ids:
            elements.append(Paragraph("Recent Mentions", h1_style))
            if not raw_mentions:
                elements.append(Paragraph("No data available for this section.", normal_style))
            else:
                recent_mentions = sorted(raw_mentions, key=lambda x: str(x.get('date', '')), reverse=True)[:10]
                for m in recent_mentions:
                    title_val = str(m.get('title') or 'Untitled')
                    domain_val = str(m.get('domain') or 'N/A')
                    sent_val = str(m.get('sentiment') or 'neutral').capitalize()
                    date_val = str(m.get('date') or '')
                    
                    elements.append(Paragraph(f"<b>{title_val}</b>", normal_style))
                    elements.append(Paragraph(f"Platform: {domain_val} | Sentiment: {sent_val} | Date: {date_val}", meta_style))
                    
                    snippet = str(m.get('content') or '')
                    snippet = snippet.encode('ascii', 'ignore').decode('ascii')
                    if len(snippet) > 300:
                        snippet = snippet[:300] + "..."
                    elements.append(Paragraph(f"<i>'{snippet}'</i>", ParagraphStyle('Snippet', parent=normal_style, leftIndent=10, textColor=muted_color)))
                    elements.append(Spacer(1, 15))

        elements.append(PageBreak())
        elements.append(Spacer(1, 300))
        elements.append(Paragraph("Thank You!", ParagraphStyle('Closing', parent=title_style, fontSize=48, textColor=accent_color, alignment=1)))
            
        doc.build(elements, onFirstPage=draw_background, onLaterPages=draw_background)
        buffer.seek(0)
        return buffer.getvalue()
