"""
AI Service for Social Listening Platform
Dynamically reads AI provider configuration from the database.
"""
import time
import json
import logging
from typing import Dict, Optional, List, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.ai_config import AIModelConfig, AIUsageLog

logger = logging.getLogger(__name__)

# ============================================================================
# EXCEPTIONS
# ============================================================================

class AITemporaryError(Exception):
    """Exception for rate limits, quota exhausted, timeouts, 5xx errors"""
    pass

class AIAuthError(Exception):
    """Exception for invalid API keys or 401/403 errors"""
    pass

class AIProviderMalformedResponseError(Exception):
    """Exception for malformed output from a specific provider (e.g. bad JSON)."""
    pass

class AIInternalValidationError(Exception):
    """Exception for internal schema or prompt bugs."""
    pass

class AIConfigError(Exception):
    """Exception when AI is not enabled or API key is missing."""
    pass

# ============================================================================
# UTILITIES
# ============================================================================

def _parse_json(text: str) -> Dict:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AIProviderMalformedResponseError(f"JSON parse error: {e}")

def _get_db_session() -> Session:
    return SessionLocal()

def _get_active_config(db: Session, user_id: Optional[int] = None) -> Optional[AIModelConfig]:
    from sqlalchemy.exc import ProgrammingError, OperationalError
    try:
        if user_id is not None:
            return db.execute(select(AIModelConfig).where(AIModelConfig.user_id == user_id)).scalar_one_or_none()
        return db.execute(select(AIModelConfig).where(AIModelConfig.is_enabled == True).limit(1)).scalar_one_or_none()
    except (ProgrammingError, OperationalError):
        db.rollback()
        return None

def _log_usage(db: Session, config: AIModelConfig, usage: Dict[str, Any], request_type: str, success: bool = True, error_message: str = None):
    try:
        log = AIUsageLog(
            model_config_id=config.id,
            provider=config.provider,
            model=config.model_name,
            request_type=request_type,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            success=success,
            error_message=error_message
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log AI usage: {e}")

# ============================================================================
# CORE AI CALL
# ============================================================================

def call_ai_messages(
    config: AIModelConfig,
    messages: List[Dict[str, str]],
    max_tokens: int = 800,
    temperature: float = 0.3,
) -> Tuple[str, Dict[str, Any]]:
    if not config.is_enabled or not config.api_key:
        raise AIConfigError("AI is disabled or API key is missing.")

    usage = {
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None
    }

    try:
        if config.provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=config.api_key)
            model = genai.GenerativeModel(config.model_name or "gemini-2.5-flash")

            prompt_parts = []
            for msg in messages:
                role_label = "System" if msg["role"] == "system" else ("Assistant" if msg["role"] == "assistant" else "User")
                prompt_parts.append(f"{role_label}: {msg['content']}")

            response = model.generate_content("\n\n".join(prompt_parts))

            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage["prompt_tokens"] = response.usage_metadata.prompt_token_count
                usage["completion_tokens"] = response.usage_metadata.candidates_token_count
                usage["total_tokens"] = response.usage_metadata.total_token_count

            return response.text.strip(), usage

        elif config.provider == "openai" or config.provider == "custom":
            from openai import OpenAI
            client_kwargs = {"api_key": config.api_key}
            if config.provider == "custom":
                client_kwargs["base_url"] = (config.base_url or "").rstrip("/")

            client = OpenAI(**client_kwargs)
            response = client.chat.completions.create(
                model=config.model_name or ("gpt-4o-mini" if config.provider == "openai" else "default"),
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=30
            )

            if hasattr(response, 'usage') and response.usage:
                usage["prompt_tokens"] = response.usage.prompt_tokens
                usage["completion_tokens"] = response.usage.completion_tokens
                usage["total_tokens"] = response.usage.total_tokens

            return response.choices[0].message.content.strip(), usage

        else:
            raise AIConfigError(f"Unknown provider: {config.provider}")

    except Exception as e:
        err_str = str(e).lower()
        if "api_key" in err_str or "unauthenticated" in err_str or "401" in err_str or "403" in err_str:
            raise AIAuthError(str(e))
        elif "quota" in err_str or "429" in err_str or "timeout" in err_str or "503" in err_str:
            raise AITemporaryError(str(e))
        else:
            raise AIProviderMalformedResponseError(str(e))


def _call_ai_provider(config: AIModelConfig, prompt: str, max_tokens: int = 800, temperature: float = 0.3) -> Tuple[str, Dict[str, Any]]:
    if not config.is_enabled or not config.api_key:
        raise AIConfigError("AI is disabled or API key is missing.")

    # Use custom system_prompt from config if available, otherwise default
    system_content = getattr(config, 'system_prompt', None) or "Bạn là chuyên gia phân tích. Trả về JSON thuần túy."
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": prompt}
    ]
    return call_ai_messages(config, messages, max_tokens=max_tokens, temperature=temperature)


# ============================================================================
# PUBLIC API WRAPPERS
# ============================================================================

def analyze_mention(content: str, title: Optional[str] = None, db_session: Optional[Session] = None) -> Dict:
    if not content:
        raise AIInternalValidationError("Empty content provided for analysis.")
    
    db = db_session or _get_db_session()
    start_time = time.time()
    
    try:
        config = _get_active_config(db)
        if not config or not config.is_enabled or not config.api_key:
            logger.warning("AI features are disabled or unconfigured. Returning safe neutral fallback.")
            return {
                "sentiment": "neutral",
                "risk_score": 0.0,
                "confidence_score": 0,
                "status": "ai_unconfigured"
            }
            
        full_text = f"{title}\n\n{content}" if title else content
        prompt = f"""Phân tích nội dung sau đây và trả về kết quả dưới dạng JSON:
Nội dung: {full_text}
Yêu cầu phân tích:
1. sentiment: (positive, neutral, negative)
2. risk_score: (0-100)
3. crisis_level: (1-5)
4. summary_vi: Tóm tắt ngắn gọn
5. suggested_action: (monitor, respond, escalate, legal_review)
6. responsible_department: (customer_service, PR, legal, executive)
7. confidence_score: (0-100)
Trả về JSON thuần túy:"""

        try:
            result_text, usage = _call_ai_provider(config, prompt, max_tokens=800, temperature=0.3)
            result = _parse_json(result_text)
            
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            result["confidence_score"] = int(result.get("confidence_score", 0))

            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            result["ai_provider"] = config.provider
            result["model_version"] = config.model_name
            result["status"] = "success"
            
            # Log usage asynchronously or in current session
            _log_usage(db, config, usage, "sentiment_analysis", success=True)
            return result
            
        except Exception as e:
            _log_usage(db, config, {}, "sentiment_analysis", success=False, error_message=str(e))
            logger.warning(f"AI Provider failed during analyze_mention: {e}. Returning safe neutral fallback.")
            return {
                "sentiment": "neutral",
                "risk_score": 0.0,
                "confidence_score": 0,
                "status": "provider_error"
            }
            
    finally:
        if db_session is None:
            db.close()


def generate_executive_brief(content: str, db_session: Optional[Session] = None) -> Dict:
    db = db_session or _get_db_session()
    
    try:
        config = _get_active_config(db)
        if not config or not config.is_enabled or not config.api_key:
            logger.warning("AI features disabled. Returning safe executive brief fallback.")
            return {
                "summary_3_lines": "AI provider unconfigured.",
                "zalo_brief": "",
                "full_brief": "Unable to generate brief: AI features disabled.",
                "risk_level": "low",
                "recommended_decision": "monitor",
                "owner": "PR",
                "deadline": ""
            }
            
        prompt = f"""Tạo báo cáo điều hành (Executive Brief) cho nội dung sau:
{content}
Bạn phải trả về JSON thuần túy:
{{
  "summary_3_lines": "...",
  "zalo_brief": "...",
  "full_brief": "...",
  "risk_level": "low/medium/high/critical",
  "recommended_decision": "...",
  "owner": "...",
  "deadline": "..."
}}"""

        try:
            result_text, usage = _call_ai_provider(config, prompt, max_tokens=800, temperature=0.3)
            result = _parse_json(result_text)
            _log_usage(db, config, usage, "executive_brief", success=True)
            return result
        except Exception as e:
            _log_usage(db, config, {}, "executive_brief", success=False, error_message=str(e))
            logger.warning(f"AI Provider failed during generate_executive_brief: {e}. Returning safe fallback.")
            return {
                "summary_3_lines": "AI provider failed.",
                "zalo_brief": "",
                "full_brief": "Unable to generate brief: Provider error.",
                "risk_level": "low",
                "recommended_decision": "monitor",
                "owner": "PR",
                "deadline": ""
            }
    finally:
        if db_session is None:
            db.close()

def expand_keyword(keyword: str, db_session: Optional[Session] = None) -> list[str]:
    db = db_session or _get_db_session()
    try:
        config = _get_active_config(db)
        if not config or not config.is_enabled or not config.api_key:
            return []
            
        prompt = f"Given the keyword '{keyword}', generate 5 synonyms. Return ONLY a valid JSON array of strings."
        result_text, usage = _call_ai_provider(config, prompt, max_tokens=150, temperature=0.7)
        res = _parse_json(result_text)
        _log_usage(db, config, usage, "expand_keyword", success=True)
        if isinstance(res, list): return [str(x) for x in res]
        return []
    except Exception as e:
        if config:
            _log_usage(db, config, {}, "expand_keyword", success=False, error_message=str(e))
        return []
    finally:
        if db_session is None:
            db.close()

def draft_response(prompt: str, max_tokens: int = 300, db_session: Optional[Session] = None) -> str:
    db = db_session or _get_db_session()
    try:
        config = _get_active_config(db)
        if not config or not config.is_enabled or not config.api_key:
            return "AI chưa được cấu hình."
            
        result_text, usage = _call_ai_provider(config, prompt, max_tokens=max_tokens, temperature=0.7)
        _log_usage(db, config, usage, "draft_response", success=True)
        return result_text
    except Exception as e:
        if config:
            _log_usage(db, config, {}, "draft_response", success=False, error_message=str(e))
        raise e
    finally:
        if db_session is None:
            db.close()

async def draft_reputation_response(case, db_session: Optional[Session] = None) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\\n".join(evidence_texts)
    prompt = f"Dự thảo phản hồi CÔNG KHAI: {context}"
    return draft_response(prompt, 300, db_session)

async def draft_correction_request(case, db_session: Optional[Session] = None) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\\n".join(evidence_texts)
    prompt = f"Dự thảo EMAIL YÊU CẦU ĐÍNH CHÍNH: {context}"
    return draft_response(prompt, 500, db_session)

async def draft_platform_report(case, db_session: Optional[Session] = None) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\\n".join(evidence_texts)
    prompt = f"Dự thảo BÁO CÁO VI PHẠM: {context}"
    return draft_response(prompt, 300, db_session)

async def draft_executive_brief(case, db_session: Optional[Session] = None) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\\n".join(evidence_texts)
    prompt = f"Dự thảo TÓM TẮT DÀNH CHO LÃNH ĐẠO: {context}"
    return draft_response(prompt, 300, db_session)

def get_ai_status(db_session: Optional[Session] = None) -> Dict:
    db = db_session or _get_db_session()
    try:
        config = _get_active_config(db)
        if config:
            return {
                "chain": [config.provider],
                "configured_providers": [config.provider] if config.api_key else [],
                "active_cooldowns": {},
                "last_successful_provider": config.provider if config.is_enabled else None,
                "last_error_category": None,
                "ai_available": bool(config.is_enabled and config.api_key)
            }
        return {
            "chain": [],
            "configured_providers": [],
            "active_cooldowns": {},
            "last_successful_provider": None,
            "last_error_category": None,
            "ai_available": False
        }
    finally:
        if db_session is None:
            db.close()
