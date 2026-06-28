import pytest
from unittest.mock import MagicMock, patch
from app.services.ai_service import analyze_mention, AIConfigError

def test_analyze_mention_unconfigured_fallback():
    # Mock DB Session
    mock_db = MagicMock()
    # Return None for config (unconfigured)
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    # When we try to analyze, it should raise AIConfigError
    with pytest.raises(AIConfigError):
        analyze_mention("This is a test mention", db_session=mock_db)

def test_analyze_mention_success():
    mock_db = MagicMock()
    mock_config = MagicMock()
    mock_config.is_enabled = True
    mock_config.api_key = "test_key"
    mock_config.provider = "custom"
    mock_config.model_name = "test-model"
    mock_db.execute.return_value.scalar_one_or_none.return_value = mock_config

    with patch('app.services.ai_service._call_ai_provider') as mock_call:
        mock_call.return_value = (
            '{"sentiment": "positive", "risk_score": 10.0, "crisis_level": 1, "summary_vi": "Test summary", "suggested_action": "monitor", "responsible_department": "PR", "confidence_score": 90.0}',
            {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}
        )

        result = analyze_mention("Great product!", db_session=mock_db)
        
        assert result["sentiment"] == "positive"
        assert result["risk_score"] == 10.0
        assert result["ai_provider"] == "custom"
        assert result["model_version"] == "test-model"

        # Verify usage was logged
        assert mock_db.add.called
        assert mock_db.commit.called
