import pytest
from unittest.mock import MagicMock, patch
from app.services.ai_service import analyze_mention, manager

def test_analyze_mention_success():
    with patch.object(manager, '_execute_with_failover') as mock_failover:
        mock_failover.return_value = {
            "sentiment": "positive",
            "risk_score": 10.0,
            "crisis_level": 1,
            "summary_vi": "Test summary",
            "suggested_action": "monitor",
            "responsible_department": "PR",
            "confidence_score": 90.0,
            "ai_provider": "test_provider",
            "model_version": "test_model"
        }

        result = analyze_mention("Great product!")
        
        assert result["sentiment"] == "positive"
        assert result["risk_score"] == 10.0
        assert mock_failover.called
