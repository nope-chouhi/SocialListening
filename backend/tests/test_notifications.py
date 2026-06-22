import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.notification_service import send_email_notification, send_webhook_notification, has_been_notified
from app.models.alert import NotificationDeliveryLog
from app.models.system_settings import EmailSettings, SystemNotificationSettings

def test_email_notification_skipped_when_disabled(monkeypatch):
    monkeypatch.setenv("SMTP_ENABLED", "False")
    
    mock_db = MagicMock()
    
    result = send_email_notification(mock_db, "test@example.com", "Test", "HTML", "Text", "test_event", 1)
    
    assert result["success"] is False
    assert "disabled" in result["message"]
    
    # Verify delivery log was created with 'skipped'
    mock_db.add.assert_called()
    added_log = mock_db.add.call_args[0][0]
    assert added_log.status == 'skipped'
    assert added_log.event_type == 'test_event'

def test_webhook_notification_skipped_when_disabled(monkeypatch):
    monkeypatch.setenv("WEBHOOK_NOTIFICATIONS_ENABLED", "False")
    
    mock_db = MagicMock()
    
    result = send_webhook_notification(mock_db, "test_event", {"data": "test"}, 1)
    
    assert result["success"] is False
    assert "disabled" in result["message"]
    
    mock_db.add.assert_called()
    added_log = mock_db.add.call_args[0][0]
    assert added_log.status == 'skipped'
    assert added_log.channel == 'webhook'

@patch("app.services.notification_service.smtplib.SMTP_SSL")
@patch("app.services.notification_service.smtplib.SMTP")
def test_email_notification_success(mock_smtp, mock_smtp_ssl, monkeypatch):
    monkeypatch.setenv("SMTP_ENABLED", "True")
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    monkeypatch.setenv("RESEND_API_KEY", "")
    
    mock_db = MagicMock()
    # has_been_notified returns None (no duplicate)
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    
    mock_server = MagicMock()
    mock_smtp.return_value = mock_server
    
    result = send_email_notification(mock_db, "test@example.com", "Test", "HTML", "Text", "success_event", 2)
    
    assert result["success"] is True
    mock_server.send_message.assert_called_once()
    
    mock_db.add.assert_called()
    added_log = mock_db.add.call_args[0][0]
    assert added_log.status == 'sent'
    assert added_log.sent_at is not None

@patch("app.services.notification_service.requests.post")
def test_webhook_notification_success(mock_post, monkeypatch):
    monkeypatch.setenv("WEBHOOK_NOTIFICATIONS_ENABLED", "True")
    
    mock_db = MagicMock()
    settings = SystemNotificationSettings(system_alerts_enabled=True, webhook_url="http://example.com/webhook")
    
    # First call: settings
    # Second call: has_been_notified -> None
    mock_db.execute.return_value.scalar_one_or_none.side_effect = [settings, None]
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_post.return_value = mock_response
    
    result = send_webhook_notification(mock_db, "webhook_success_event", {"data": "test"}, 3)
    
    assert result["success"] is True
    mock_post.assert_called_once()
    
    added_log = mock_db.add.call_args[0][0]
    assert added_log.status == 'sent'

@patch("app.services.notification_service.requests.post")
def test_webhook_notification_failure(mock_post, monkeypatch):
    monkeypatch.setenv("WEBHOOK_NOTIFICATIONS_ENABLED", "True")
    
    mock_db = MagicMock()
    settings = SystemNotificationSettings(system_alerts_enabled=True, webhook_url="http://example.com/webhook")
    mock_db.execute.return_value.scalar_one_or_none.side_effect = [settings, None]
    
    mock_post.side_effect = Exception("Connection Timeout")
    
    result = send_webhook_notification(mock_db, "webhook_fail_event", {"data": "test"}, 4)
    
    assert result["success"] is False
    
    added_log = mock_db.add.call_args[0][0]
    assert added_log.status == 'failed'
    assert "Connection Timeout" in added_log.last_error

def test_duplicate_notification_prevention(monkeypatch):
    monkeypatch.setenv("SMTP_ENABLED", "True")
    monkeypatch.setenv("SMTP_HOST", "smtp.test.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    
    mock_db = MagicMock()
    # Mock has_been_notified returning True (exists)
    mock_db.execute.return_value.scalar_one_or_none.return_value = NotificationDeliveryLog()
    
    result = send_email_notification(mock_db, "test@example.com", "Test", "HTML", "Text", "dup_event", 5)
    
    assert result["success"] is True
    assert result["message"] == "Already notified"
    
    # Ensure add was NOT called
    mock_db.add.assert_not_called()
