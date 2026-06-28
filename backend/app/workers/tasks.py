"""
Celery background tasks
"""
from celery import Task
from sqlalchemy import select
from datetime import datetime
import asyncio

from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.source import Source
from app.models.keyword import KeywordGroup, Keyword
from app.models.mention import Mention, AIAnalysis, SentimentScore
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.crawl import CrawlJob, CrawlJobStatus
from app.services.crawler_service import crawler_service
from app.services.ai_service import ai_service


@celery_app.task(name="app.workers.tasks.crawl_source", bind=True)
def crawl_source(self: Task, source_id: int, keyword_group_ids: list[int]):
    """
    Crawl a single source for mentions
    
    Args:
        source_id: ID of the source to crawl
        keyword_group_ids: List of keyword group IDs to match against
    """
    return asyncio.run(_crawl_source_async(source_id, keyword_group_ids))


async def _crawl_source_async(source_id: int, keyword_group_ids: list[int]):
    """Async implementation of crawl_source"""
    async with AsyncSessionLocal() as db:
        try:
            # Get source
            result = await db.execute(select(Source).where(Source.id == source_id))
            source = result.scalar_one_or_none()
            
            if not source:
                return {"error": "Source not found", "source_id": source_id}
            
            # Get keyword groups
            keyword_groups = []
            for group_id in keyword_group_ids:
                result = await db.execute(
                    select(KeywordGroup).where(KeywordGroup.id == group_id)
                )
                group = result.scalar_one_or_none()
                if group:
                    # Get keywords for this group
                    keywords_result = await db.execute(
                        select(Keyword).where(Keyword.group_id == group_id, Keyword.is_active == True)
                    )
                    keywords = keywords_result.scalars().all()
                    keyword_groups.append({
                        "group": group,
                        "keywords": [k.keyword for k in keywords if not k.is_excluded],
                        "excluded_keywords": [k.keyword for k in keywords if k.is_excluded]
                    })
            
            if not keyword_groups:
                return {"error": "No active keyword groups found"}
            
            # Crawl the source
            crawl_result = await crawler_service.crawl_url(source.url)
            
            if not crawl_result.get("success"):
                # Update source error
                source.last_error = crawl_result.get("error")
                source.error_count += 1
                source.last_crawled_at = datetime.utcnow()
                await db.commit()
                return crawl_result
            
            # Update source success
            source.last_crawled_at = datetime.utcnow()
            source.last_success_at = datetime.utcnow()
            source.crawl_count += 1
            source.last_error = None
            
            mentions_created = 0
            
            # Handle RSS feed (multiple items)
            if "items" in crawl_result:
                for item in crawl_result["items"]:
                    mention_created = await _process_mention(
                        db, source, item, keyword_groups
                    )
                    if mention_created:
                        mentions_created += 1
            else:
                # Handle single page
                mention_created = await _process_mention(
                    db, source, crawl_result, keyword_groups
                )
                if mention_created:
                    mentions_created += 1
            
            await db.commit()
            
            return {
                "success": True,
                "source_id": source_id,
                "mentions_created": mentions_created
            }
            
        except Exception as e:
            await db.rollback()
            return {"error": str(e), "source_id": source_id}


async def _process_mention(db, source, content_data, keyword_groups):
    """Process a single mention"""
    title = content_data.get("title", "")
    content = content_data.get("content", "")
    url = content_data.get("url", source.url)
    
    full_text = f"{title} {content}"
    
    # Match keywords
    matched_any = False
    matched_keywords_data = []
    alert_threshold = 70.0  # Default
    
    for kg in keyword_groups:
        match_result = crawler_service.match_keywords(
            full_text,
            kg["keywords"],
            kg["excluded_keywords"]
        )
        
        if match_result.get("matched"):
            matched_any = True
            matched_keywords_data.extend(match_result.get("keywords", []))
            alert_threshold = kg["group"].alert_threshold
    
    if not matched_any:
        return False
    
    # Calculate content hash for deduplication
    content_hash = crawler_service.calculate_content_hash(full_text)
    
    # Check if mention already exists
    existing = await db.execute(
        select(Mention).where(Mention.content_hash == content_hash)
    )
    if existing.scalar_one_or_none():
        return False  # Duplicate
    
    # Create mention
    mention = Mention(
        source_id=source.id,
        title=title,
        content=content,
        content_hash=content_hash,
        url=url,
        author=content_data.get("author"),
        published_at=content_data.get("published_at"),
        matched_keywords=matched_keywords_data,
        platform_post_id=None,
        meta_data=content_data.get("metadata", {})
    )
    
    db.add(mention)
    await db.flush()  # Get mention ID
    
    # Trigger AI analysis
    analyze_mention.delay(mention.id, alert_threshold)
    
    return True


@celery_app.task(name="app.workers.tasks.analyze_mention", bind=True)
def analyze_mention(self: Task, mention_id: int, alert_threshold: float = 70.0):
    """
    Analyze a mention using AI
    
    Args:
        mention_id: ID of the mention to analyze
        alert_threshold: Risk score threshold for creating alerts
    """
    return asyncio.run(_analyze_mention_async(mention_id, alert_threshold))


async def _analyze_mention_async(mention_id: int, alert_threshold: float):
    """Async implementation of analyze_mention"""
    async with AsyncSessionLocal() as db:
        try:
            # Get mention
            result = await db.execute(select(Mention).where(Mention.id == mention_id))
            mention = result.scalar_one_or_none()
            
            if not mention:
                return {"error": "Mention not found", "mention_id": mention_id}
            
            # Analyze with AI
            try:
                # Call sync ai_service synchronously in threadpool to not block async loop
                from fastapi.concurrency import run_in_threadpool
                analysis_result = await run_in_threadpool(
                    ai_service.analyze_mention,
                    mention.content,
                    mention.title,
                    None
                )
                ai_provider = analysis_result.get("ai_provider", "unknown")
                model_version = analysis_result.get("model_version", "1.0")
            except Exception as e:
                # Fallback to neutral if AI fails or unconfigured
                analysis_result = {
                    "sentiment": "neutral",
                    "risk_score": 0.0,
                    "crisis_level": 1,
                    "summary_vi": "Failed to analyze or AI unconfigured.",
                    "suggested_action": "monitor",
                    "responsible_department": "customer_service",
                    "confidence_score": 0.0,
                    "reasoning": str(e)
                }
                ai_provider = "fallback"
                model_version = "1.0"
            
            # Create AI analysis record
            ai_analysis = AIAnalysis(
                mention_id=mention.id,
                sentiment=analysis_result["sentiment"],
                risk_score=analysis_result["risk_score"],
                crisis_level=analysis_result["crisis_level"],
                summary_vi=analysis_result["summary_vi"],
                suggested_action=analysis_result["suggested_action"],
                responsible_department=analysis_result["responsible_department"],
                confidence_score=analysis_result["confidence_score"],
                reasoning=analysis_result.get("reasoning", ""),
                ai_provider=ai_provider,
                model_version=model_version
            )
            
            db.add(ai_analysis)
            await db.flush()
            
            # Check if alert should be created
            should_alert = (
                analysis_result["risk_score"] >= alert_threshold or
                analysis_result["crisis_level"] >= 4 or
                analysis_result["sentiment"] in [SentimentScore.NEGATIVE_HIGH, SentimentScore.NEGATIVE_MEDIUM]
            )
            
            if should_alert:
                # Determine severity
                if analysis_result["crisis_level"] >= 5 or analysis_result["risk_score"] >= 90:
                    severity = AlertSeverity.CRITICAL
                elif analysis_result["crisis_level"] >= 4 or analysis_result["risk_score"] >= 70:
                    severity = AlertSeverity.HIGH
                elif analysis_result["risk_score"] >= 50:
                    severity = AlertSeverity.MEDIUM
                else:
                    severity = AlertSeverity.LOW
                
                # Create alert
                alert = Alert(
                    mention_id=mention.id,
                    severity=severity,
                    status=AlertStatus.NEW,
                    title=f"Phát hiện nội dung rủi ro: {mention.title[:100]}",
                    message=f"Risk score: {analysis_result['risk_score']}, Crisis level: {analysis_result['crisis_level']}\n{analysis_result['summary_vi']}",
                    notification_channels="dashboard,email"
                )
                
                db.add(alert)
                
                # Trigger notification
                send_alert.delay(alert.id)
            
            await db.commit()
            
            return {
                "success": True,
                "mention_id": mention_id,
                "risk_score": analysis_result["risk_score"],
                "alert_created": should_alert
            }
            
        except Exception as e:
            await db.rollback()
            try:
                # Re-fetch mention to mark as failed
                result = await db.execute(select(Mention).where(Mention.id == mention_id))
                mention = result.scalar_one_or_none()
                if mention:
                    mention.verification_status = "failed"
                    mention.verification_error = f"AI analysis failed: {str(e)}"
                    db.add(mention)
                    await db.commit()
            except Exception:
                pass
            return {"error": str(e), "mention_id": mention_id}


@celery_app.task(name="app.workers.tasks.send_alert", bind=True)
def send_alert(self: Task, alert_id: int):
    """
    Send alert notifications
    
    Args:
        alert_id: ID of the alert to send
    """
    return asyncio.run(_send_alert_async(alert_id))


async def _send_alert_async(alert_id: int):
    """Async implementation of send_alert"""
    async with AsyncSessionLocal() as db:
        try:
            from app.services.notification_service import notification_service
            
            # Get alert with mention and analysis
            result = await db.execute(
                select(Alert).where(Alert.id == alert_id)
            )
            alert = result.scalar_one_or_none()
            
            if not alert:
                return {"error": "Alert not found", "alert_id": alert_id}
            
            # Get mention
            result = await db.execute(
                select(Mention).where(Mention.id == alert.mention_id)
            )
            mention = result.scalar_one_or_none()
            
            if not mention:
                return {"error": "Mention not found"}
            
            # Get AI analysis
            result = await db.execute(
                select(AIAnalysis).where(AIAnalysis.mention_id == mention.id)
            )
            analysis = result.scalar_one_or_none()
            
            if not analysis:
                return {"error": "AI analysis not found"}
            
            # Parse notification channels
            channels = alert.notification_channels.split(',') if alert.notification_channels else ['dashboard']
            
            results = []
            
            # Send email
            if 'email' in channels and settings.SMTP_HOST:
                email_html = notification_service.format_alert_email(
                    alert_title=alert.title,
                    alert_message=alert.message,
                    mention_url=mention.url,
                    risk_score=analysis.risk_score,
                    crisis_level=analysis.crisis_level,
                    sentiment=analysis.sentiment.value
                )
                
                # Get admin emails from settings or use default
                admin_emails = [settings.SMTP_FROM] if settings.SMTP_FROM else []
                
                if admin_emails:
                    email_result = await notification_service.send_email(
                        to_emails=admin_emails,
                        subject=f"🚨 {alert.title}",
                        body_html=email_html,
                        body_text=alert.message
                    )
                    results.append(email_result)
            
            # Send Telegram
            if 'telegram' in channels and settings.TELEGRAM_BOT_TOKEN:
                telegram_message = notification_service.format_alert_telegram(
                    alert_title=alert.title,
                    alert_message=alert.message,
                    mention_url=mention.url,
                    risk_score=analysis.risk_score,
                    crisis_level=analysis.crisis_level,
                    sentiment=analysis.sentiment.value
                )
                
                telegram_result = await notification_service.send_telegram(
                    message=telegram_message
                )
                results.append(telegram_result)
            
            # Send SMS (for critical alerts only)
            if 'sms' in channels and alert.severity == AlertSeverity.CRITICAL and settings.TWILIO_ACCOUNT_SID:
                sms_message = f"🚨 CẢNH BÁO KHẨN: {alert.title}. Risk: {analysis.risk_score:.0f}/100. Xem: {mention.url}"
                
                # Get admin phone from settings
                # admin_phone = settings.ADMIN_PHONE  # Add this to config
                # if admin_phone:
                #     sms_result = await notification_service.send_sms(
                #         phone_number=admin_phone,
                #         message=sms_message
                #     )
                #     results.append(sms_result)
            
            return {
                "success": True,
                "alert_id": alert_id,
                "channels": channels,
                "results": results
            }
            
        except Exception as e:
            return {"error": str(e), "alert_id": alert_id}


@celery_app.task(name="app.workers.tasks.generate_report", bind=True)
def generate_report(self: Task, report_id: int):
    """
    Generate a report
    
    Args:
        report_id: ID of the report to generate
    """
    return asyncio.run(_generate_report_async(report_id))


async def _generate_report_async(report_id: int):
    """Async implementation of generate_report"""
    async with AsyncSessionLocal() as db:
        try:
            from app.services.report_service import report_service
            from app.models.report import Report, ReportStatus
            
            # Get report
            result = await db.execute(select(Report).where(Report.id == report_id))
            report = result.scalar_one_or_none()
            
            if not report:
                return {"error": "Report not found", "report_id": report_id}
            
            # Update status to generating
            report.status = ReportStatus.GENERATING
            await db.commit()
            
            # Generate report
            generation_result = await report_service.generate_report(db, report)
            
            if generation_result["success"]:
                # Update report with file paths
                report.status = ReportStatus.COMPLETED
                report.file_path = generation_result.get("pdf_path") or generation_result.get("excel_path")
                report.generated_at = datetime.utcnow()
                
                await db.commit()
                
                return {
                    "success": True,
                    "report_id": report_id,
                    "pdf_path": generation_result.get("pdf_path"),
                    "excel_path": generation_result.get("excel_path")
                }
            else:
                # Update status to failed
                report.status = ReportStatus.FAILED
                await db.commit()
                
                return {
                    "success": False,
                    "report_id": report_id,
                    "error": generation_result.get("error")
                }
                
        except Exception as e:
            # Update status to failed
            try:
                report.status = ReportStatus.FAILED
                await db.commit()
            except:
                pass
            
            return {"error": str(e), "report_id": report_id}


@celery_app.task(name="app.workers.tasks.capture_screenshot", bind=True)
def capture_screenshot(self: Task, url: str, incident_id: int):
    """
    Capture screenshot of a URL for evidence
    
    Args:
        url: URL to capture
        incident_id: ID of the incident
    """
    return asyncio.run(_capture_screenshot_async(url, incident_id))


async def _capture_screenshot_async(url: str, incident_id: int):
    """Async implementation of capture_screenshot"""
    async with AsyncSessionLocal() as db:
        try:
            from playwright.async_api import async_playwright
            import os
            from app.models.incident import EvidenceFile
            
            # Create screenshots directory
            os.makedirs("evidence/screenshots", exist_ok=True)
            
            # Generate filename
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f"evidence/screenshots/incident_{incident_id}_{timestamp}.png"
            
            # Capture screenshot using Playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page(viewport={"width": 1920, "height": 1080})
                
                try:
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await page.screenshot(path=filename, full_page=True)
                except Exception as e:
                    await browser.close()
                    return {
                        "success": False,
                        "error": f"Failed to capture screenshot: {str(e)}",
                        "url": url
                    }
                
                await browser.close()
            
            # Create evidence file record
            evidence = EvidenceFile(
                incident_id=incident_id,
                file_type="screenshot",
                file_path=filename,
                file_name=os.path.basename(filename),
                file_size=os.path.getsize(filename),
                original_url=url,
                description=f"Screenshot captured from {url}"
            )
            
            db.add(evidence)
            await db.commit()
            await db.refresh(evidence)
            
            return {
                "success": True,
                "incident_id": incident_id,
                "evidence_id": evidence.id,
                "file_path": filename,
                "url": url
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "url": url,
                "incident_id": incident_id
            }


@celery_app.task(name="app.workers.tasks.check_overdue_incidents", bind=True)
def check_overdue_incidents(self: Task):
    """
    Check for overdue incidents and update their status
    """
    return asyncio.run(_check_overdue_incidents_async())


async def _check_overdue_incidents_async():
    """Async implementation of check_overdue_incidents"""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.incident import Incident, IncidentStatus
            
            # Get all non-closed incidents with deadlines
            result = await db.execute(
                select(Incident).where(
                    and_(
                        Incident.deadline.isnot(None),
                        Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.CLOSED]),
                        Incident.is_overdue == False
                    )
                )
            )
            incidents = result.scalars().all()
            
            now = datetime.utcnow()
            overdue_count = 0
            
            for incident in incidents:
                if incident.deadline < now:
                    incident.is_overdue = True
                    overdue_count += 1
                    
                    # Create alert for overdue incident
                    from app.models.alert import Alert, AlertSeverity, AlertStatus
                    
                    alert = Alert(
                        mention_id=incident.mention_id,
                        severity=AlertSeverity.HIGH,
                        status=AlertStatus.NEW,
                        title=f"Sự cố quá hạn: {incident.title}",
                        message=f"Sự cố #{incident.id} đã quá hạn xử lý. Deadline: {incident.deadline.strftime('%d/%m/%Y %H:%M')}",
                        notification_channels="dashboard,email,telegram"
                    )
                    
                    db.add(alert)
                    
                    # Send notification
                    await db.flush()
                    send_alert.delay(alert.id)
            
            await db.commit()
            
            return {
                "success": True,
                "checked": len(incidents),
                "overdue_found": overdue_count
            }
            
        except Exception as e:
            await db.rollback()
            return {"error": str(e)}


@celery_app.task(name="app.workers.tasks.run_scheduled_crawl", bind=True)
def run_scheduled_crawl(self: Task, schedule_id: int):
    """
    Run a scheduled crawl job
    
    Args:
        schedule_id: ID of the scan schedule
    """
    return asyncio.run(_run_scheduled_crawl_async(schedule_id))


async def _run_scheduled_crawl_async(schedule_id: int):
    """Async implementation of run_scheduled_crawl"""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.crawl import ScanSchedule
            
            # Get schedule
            result = await db.execute(select(ScanSchedule).where(ScanSchedule.id == schedule_id))
            schedule = result.scalar_one_or_none()
            
            if not schedule or not schedule.is_active:
                return {"error": "Schedule not found or inactive"}
            
            # Get sources from source groups
            source_ids = []
            if schedule.source_group_ids:
                from app.models.source import Source
                result = await db.execute(
                    select(Source.id).where(
                        Source.group_id.in_(schedule.source_group_ids),
                        Source.is_active == True
                    )
                )
                source_ids = [row[0] for row in result.all()]
            
            if not source_ids:
                return {"error": "No active sources found"}
            
            # Create crawl job
            from app.models.crawl import CrawlJob
            crawl_job = CrawlJob(
                job_type="scheduled",
                source_ids=source_ids,
                keyword_group_ids=schedule.keyword_group_ids or [],
                status=CrawlJobStatus.PENDING,
                total_sources=len(source_ids)
            )
            
            db.add(crawl_job)
            await db.flush()
            
            # Update schedule
            schedule.last_run_at = datetime.utcnow()
            
            await db.commit()
            
            # Trigger crawl for each source
            for source_id in source_ids:
                crawl_source.delay(source_id, schedule.keyword_group_ids or [])
            
            return {
                "success": True,
                "schedule_id": schedule_id,
                "crawl_job_id": crawl_job.id,
                "sources_queued": len(source_ids)
            }
            
        except Exception as e:
            await db.rollback()
            return {"error": str(e), "schedule_id": schedule_id}



@celery_app.task(name="app.workers.tasks.process_scheduled_crawls", bind=True)
def process_scheduled_crawls(self: Task):
    """
    Process all active scheduled crawls
    Check which schedules should run based on their cron expression
    """
    return asyncio.run(_process_scheduled_crawls_async())


async def _process_scheduled_crawls_async():
    """Async implementation of process_scheduled_crawls"""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.crawl import ScanSchedule
            from croniter import croniter
            
            # Get all active schedules
            result = await db.execute(
                select(ScanSchedule).where(ScanSchedule.is_active == True)
            )
            schedules = result.scalars().all()
            
            now = datetime.utcnow()
            triggered_count = 0
            
            for schedule in schedules:
                # Check if schedule should run
                should_run = False
                
                if schedule.cron_expression:
                    # Use cron expression
                    try:
                        cron = croniter(schedule.cron_expression, schedule.last_run_at or now)
                        next_run = cron.get_next(datetime)
                        
                        # If next run time has passed, trigger the schedule
                        if next_run <= now:
                            should_run = True
                    except Exception as e:
                        print(f"Invalid cron expression for schedule {schedule.id}: {e}")
                        continue
                
                if should_run:
                    # Trigger scheduled crawl
                    run_scheduled_crawl.delay(schedule.id)
                    triggered_count += 1
            
            return {
                "success": True,
                "checked": len(schedules),
                "triggered": triggered_count
            }
            
        except Exception as e:
            return {"error": str(e)}


@celery_app.task(name="app.workers.tasks.generate_daily_summary", bind=True)
def generate_daily_summary(self: Task):
    """
    Generate daily summary report
    """
    return asyncio.run(_generate_daily_summary_async())


async def _generate_daily_summary_async():
    """Async implementation of generate_daily_summary"""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.report import Report, ReportType, ReportStatus
            from datetime import timedelta
            
            # Create report for yesterday
            end_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=1)
            
            report = Report(
                title=f"Báo Cáo Tổng Hợp Ngày {start_date.strftime('%d/%m/%Y')}",
                report_type=ReportType.DAILY,
                format="both",
                start_date=start_date,
                end_date=end_date,
                status=ReportStatus.GENERATING,
                generated_by=1  # System user
            )
            
            db.add(report)
            await db.commit()
            await db.refresh(report)
            
            # Trigger report generation
            generate_report.delay(report.id)
            
            return {
                "success": True,
                "report_id": report.id,
                "period": f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
            }
            
        except Exception as e:
            return {"error": str(e)}


@celery_app.task(name="app.workers.tasks.generate_weekly_report", bind=True)
def generate_weekly_report(self: Task):
    """
    Generate weekly summary report
    """
    return asyncio.run(_generate_weekly_report_async())


async def _generate_weekly_report_async():
    """Async implementation of generate_weekly_report"""
    async with AsyncSessionLocal() as db:
        try:
            from app.models.report import Report, ReportType, ReportStatus
            from datetime import timedelta
            
            # Create report for last week (Monday to Sunday)
            end_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=7)
            
            report = Report(
                title=f"Báo Cáo Tuần {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}",
                report_type=ReportType.WEEKLY,
                format="both",
                start_date=start_date,
                end_date=end_date,
                status=ReportStatus.GENERATING,
                generated_by=1  # System user
            )
            
            db.add(report)
            await db.commit()
            await db.refresh(report)
            
            # Trigger report generation
            generate_report.delay(report.id)
            
            return {
                "success": True,
                "report_id": report.id,
                "period": f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
            }
            
        except Exception as e:
            return {"error": str(e)}
