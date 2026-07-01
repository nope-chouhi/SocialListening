# Email Reports Setup

## Overview
The Email Reports Setup feature allows administrators to configure scheduled email reports directly from the web dashboard. Reports are generated from real system data (mentions, sentiment, alerts, incidents) and sent via the existing email notification infrastructure (Resend API or SMTP).

## Configuration Settings
The following settings are stored in the database under `system_notification_settings`:
- `report_email_recipients`: A comma-separated list of email addresses that will receive the reports.
- `daily_report_enabled`: Boolean indicating if the daily report should be sent.
- `daily_report_time`: Time of day to send the daily report (e.g., "09:00").
- `weekly_report_enabled`: Boolean indicating if the weekly report should be sent.
- `weekly_report_day`: Integer (0-6) representing the day of the week (0 = Monday, 6 = Sunday).
- `weekly_report_time`: Time of day to send the weekly report.

## How Scheduling Works
The scheduling leverages APScheduler. Two jobs are defined in `scheduler_service.py`:
- `scheduled_email_report_daily`: Uses a CronTrigger for the daily report time.
- `scheduled_email_report_weekly`: Uses a CronTrigger for the weekly report day and time.

When settings are updated via the `PUT /api/settings/notifications` endpoint, the system calls `sync_email_report_schedules()` which adds, updates, or removes these cron jobs without requiring a server restart. 

## Send Now
Admins can trigger an immediate test report via the "Send Now" button.
This calls `POST /api/reports/email-schedules/send-now` which immediately builds and sends the HTML report using the current data. It returns real success or failure statuses.

## Handling Email Provider Failures
The `email_report_service.py` checks if the email provider (SMTP or Resend API) is configured. If not, it will immediately abort and return a clear failure message (`"Email provider (SMTP or Resend) is not configured."`), which will be displayed in the UI as a toast error.

## Intentionally Deferred Features
The following features are not implemented in this MVP and are deferred for future updates:
- **Per-project schedules:** Currently, the schedule is global for the entire system and scoped to a system administrator context.
- **Per-user schedules:** Currently, all listed recipients receive the same global report.
- **PDF/Excel attachments:** The MVP relies on an HTML summary. Attachments require complex handling of file generation and storage that is not included in this iteration.
- **Full delivery history UI:** While the success/failure is returned and logged on the server, a detailed dashboard for delivery history and retry mechanisms is deferred.
