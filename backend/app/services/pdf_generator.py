import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart

class PDFGenerator:
    @staticmethod
    def _create_pie_chart(data_dict, width=300, height=200):
        d = Drawing(width, height)
        pie = Pie()
        pie.x = 65
        pie.y = 15
        pie.width = 170
        pie.height = 170
        
        # order: positive, negative, neutral
        pos = data_dict.get('positive', 0)
        neg = data_dict.get('negative', 0)
        neu = data_dict.get('neutral', 0)
        
        pie.data = [pos, neg, neu]
        pie.labels = ['Positive', 'Negative', 'Neutral']
        
        # Colors match typical dashboard
        pie.slices[0].fillColor = colors.HexColor('#22c55e') # Green
        pie.slices[1].fillColor = colors.HexColor('#ef4444') # Red
        pie.slices[2].fillColor = colors.HexColor('#64748b') # Gray/Neutral
        
        for i in range(3):
            pie.slices[i].fontName = 'Helvetica'
            pie.slices[i].fontSize = 10
            
        d.add(pie)
        return d

    @staticmethod
    def _create_bar_chart(trend_data, width=400, height=200):
        d = Drawing(width, height)
        bc = VerticalBarChart()
        bc.x = 50
        bc.y = 50
        bc.height = 125
        bc.width = 300
        
        # Sort trend data by date
        sorted_dates = sorted(trend_data.keys())
        if not sorted_dates:
            return d
            
        counts = [trend_data[dt]['count'] for dt in sorted_dates]
        labels = [dt[-5:] for dt in sorted_dates] # MM-DD
        
        bc.data = [counts]
        bc.categoryAxis.categoryNames = labels
        bc.categoryAxis.labels.boxAnchor = 'n'
        bc.categoryAxis.labels.dy = -5
        bc.categoryAxis.labels.angle = 45
        bc.categoryAxis.labels.fontName = 'Helvetica'
        
        bc.bars[0].fillColor = colors.HexColor('#3b82f6')
        
        d.add(bc)
        return d

    @staticmethod
    def generate_project_summary(data: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18)
        
        metrics = data.get('metrics', {})
        comparison = data.get('comparison', {})
        sources_list = data.get('sources_list', [])
        tags_list = data.get('tags_list', [])
        top_mentions = data.get('top_mentions', [])
        exec_summary = data.get('exec_summary', '')
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=24, textColor=colors.HexColor('#1e293b'), alignment=1, spaceAfter=20)
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=16, textColor=colors.HexColor('#3b82f6'), spaceBefore=15, spaceAfter=10)
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#334155'), leading=14)
        bold_style = ParagraphStyle('Bold', parent=normal_style, fontName='Helvetica-Bold')
        summary_style = ParagraphStyle('Summary', parent=normal_style, fontSize=11, leading=16, textColor=colors.HexColor('#0f172a'))
        
        elements = []
        
        # COVER PAGE
        project_name = data.get('project_name', 'All Projects')
        if project_name == 'Tất cả dự án':
            project_name = 'All Projects'
            
        elements.append(Spacer(1, 150))
        elements.append(Paragraph("Social Listening Report", title_style))
        elements.append(Paragraph(f"Project: {project_name}", ParagraphStyle('Subtitle', parent=title_style, fontSize=18, textColor=colors.HexColor('#64748b'))))
        
        date_from_val = str(data.get('date_from') or 'All time').split('T')[0]
        date_to_val = str(data.get('date_to') or 'All time').split('T')[0]
        
        elements.append(Spacer(1, 40))
        elements.append(Paragraph(f"Period: {date_from_val} to {date_to_val}", ParagraphStyle('CenterBold', parent=bold_style, alignment=1, fontSize=12)))
        elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ParagraphStyle('Center', parent=normal_style, alignment=1)))
        
        elements.append(PageBreak())
        
        # 1. EXECUTIVE SUMMARY
        elements.append(Paragraph("1. Executive Summary", h2_style))
        elements.append(Paragraph(exec_summary, summary_style))
        elements.append(Spacer(1, 20))
        
        # 2. OVERVIEW KPIs
        elements.append(Paragraph("2. Key Performance Indicators", h2_style))
        def safe_num(val):
            if val is None: return 0
            try: return int(val)
            except: return 0
            
        kpi_data = [
            ["Total Mentions", "Total Reach", "Interactions"],
            [f"{safe_num(metrics.get('total_mentions')):,}", f"{safe_num(metrics.get('total_reach')):,}", f"{safe_num(metrics.get('interactions')):,}"]
        ]
        
        comp_data = []
        if comparison:
            comp_data = [
                ["vs Prev Period", "vs Prev Period", "vs Prev Period"],
                [str(comparison.get('mentions_change') or '0%'), str(comparison.get('reach_change') or '0%'), str(comparison.get('interactions_change') or '0%')]
            ]
            kpi_data.extend(comp_data)
            
        t_kpi = Table(kpi_data, colWidths=[170, 170, 170])
        style_cmds = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#475569')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,1), (-1,1), 18),
            ('TEXTCOLOR', (0,1), (-1,1), colors.HexColor('#0f172a')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0'))
        ]
        if comparison:
            style_cmds.extend([
                ('FONTNAME', (0,2), (-1,2), 'Helvetica'),
                ('FONTSIZE', (0,2), (-1,2), 9),
                ('TEXTCOLOR', (0,2), (-1,2), colors.HexColor('#64748b')),
                ('FONTNAME', (0,3), (-1,3), 'Helvetica-Bold'),
                ('FONTSIZE', (0,3), (-1,3), 11),
                ('TEXTCOLOR', (0,3), (-1,3), colors.HexColor('#3b82f6')) # Blue for changes
            ])
            
        t_kpi.setStyle(TableStyle(style_cmds))
        elements.append(t_kpi)
        elements.append(Spacer(1, 30))
        
        # 3. ANALYSIS CHARTS
        elements.append(Paragraph("3. Analysis & Trends", h2_style))
        
        sent_data = metrics.get('sentiment', {})
        trend_data = metrics.get('daily_trend', {})
        
        if not sent_data and not trend_data:
            elements.append(Paragraph("No data available for this section.", normal_style))
        else:
            pie_drawing = PDFGenerator._create_pie_chart(sent_data)
            bar_drawing = PDFGenerator._create_bar_chart(trend_data)
            
            chart_table = Table([[pie_drawing, bar_drawing]], colWidths=[250, 250])
            chart_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
            
            elements.append(chart_table)
            
            chart_labels = Table([["Sentiment Breakdown", "Daily Mention Volume"]], colWidths=[250, 250])
            chart_labels.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER'), ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold')]))
            elements.append(chart_labels)
        
        elements.append(PageBreak())
        
        # 4. SOURCES & CONTEXT
        elements.append(Paragraph("4. Sources & Topics", h2_style))
        
        if not sources_list and not tags_list:
            elements.append(Paragraph("No data available for this section.", normal_style))
            elements.append(Spacer(1, 30))
        else:
            # Top Sources Table
            s_data = [["Top Domains / Platforms", "Mentions"]]
            for s in sources_list[:10]:
                s_data.append([str(s['name']), f"{s['count']:,}"])
                
            # Top Tags Table
            t_data = [["Top Trending Topics/Hashtags", "Frequency"]]
            for t in tags_list[:10]:
                t_data.append([str(t['name']), f"{t['count']:,}"])
                
            # Wrap in side-by-side table
            tsrc = Table(s_data, colWidths=[180, 60])
            tsrc.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
            ]))
            
            ttag = Table(t_data, colWidths=[180, 60])
            ttag.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
            ]))
            
            elements.append(Table([[tsrc, ttag]], colWidths=[260, 260], style=[('VALIGN', (0,0), (-1,-1), 'TOP')]))
            elements.append(Spacer(1, 30))
        
        # 5. TOP MENTIONS
        elements.append(Paragraph("5. Top Mentions by Reach", h2_style))
        
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
                elements.append(Paragraph(f"Platform: {domain_val} | Sentiment: {sent_val} | Reach: {int(reach_val):,}", ParagraphStyle('Meta', parent=normal_style, textColor=colors.HexColor('#64748b'), fontSize=9)))
                
                snippet = str(m.get('snippet') or '')
                snippet = snippet.encode('ascii', 'ignore').decode('ascii')
                if len(snippet) > 300:
                    snippet = snippet[:300] + "..."
                elements.append(Paragraph(f"<i>'{snippet}'</i>", ParagraphStyle('Snippet', parent=normal_style, leftIndent=10, textColor=colors.HexColor('#475569'))))
                elements.append(Spacer(1, 15))
            
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
