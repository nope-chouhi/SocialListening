# Phase 5: Real Notifications

## Overview
Phase 5 introduces real email and webhook notification delivery, transitioning from fire-and-forget logs to a database-backed, idempotent notification service.

## Key Changes

### Database Delivery Tracking
A new model `NotificationDeliveryLog` tracks all notification delivery attempts. 
- **Idempotency**: Prevents duplicate notifications by checking if `has_been_notified` is true for the same `(event_type, channel, destination)` and associated reference IDs (`alert_id`, `incident_id`, or `mention_id`).
- **Audit Logging**: Captures `status` (`pending`, `sent`, `failed`, `skipped`), `sent_at`, and detailed error messages if API requests (Resend, Webhook) fail.

### Configuration Controls
Two new settings added to `backend/app/core/config.py`:
- `SMTP_ENABLED`: Master toggle for email delivery. Default `False`.
- `WEBHOOK_NOTIFICATIONS_ENABLED`: Master toggle for webhook delivery. Default `False`.
If these settings are disabled, notifications silently skip with a status of `skipped` logged to the DB.

### Integration
The `notification_service.py` is integrated with existing triggers:
- `notify_high_risk_mention` (Passes `mention_id`)
- `notify_alert_created` (Passes `alert_id`, `mention_id`)
- `notify_incident_assigned` (Passes `incident_id`)

## Tests
Extensive testing implemented in `backend/tests/test_notifications.py`:
- Skipped behavior when toggles are False.
- Successful email notification via mocked `SMTP` or Resend API fallback logging.
- Successful and failed webhook notifications via mocked `requests.post`.
- Duplicate prevention blocking a secondary notification for the same reference ID.
