"""
AI Service for Social Listening Platform
Supports multiple AI providers with failover chain: Gemini, Grok, OpenAI, and PhoBERT
"""
import os
import time
import json
import logging
from typing import Dict, Optional, List, Any
from abc import ABC, abstractmethod
from app.core.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# EXCEPTIONS FOR FAILOVER
# ============================================================================

class AITemporaryError(Exception):
    """Exception for rate limits, quota exhausted, timeouts, 5xx errors"""
    pass

class AIAuthError(Exception):
    """Exception for invalid API keys or 401/403 errors"""
    pass

class AIProviderMalformedResponseError(Exception):
    """Exception for malformed output from a specific provider (e.g. bad JSON). Triggers failover."""
    pass

class AIInternalValidationError(Exception):
    """Exception for internal schema or prompt bugs. Does NOT trigger failover."""
    pass


# ============================================================================
# AI PROVIDER INTERFACE
# ============================================================================

class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        pass

    @abstractmethod
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        pass

    @abstractmethod
    def generate_executive_brief(self, content: str) -> Dict:
        pass

    @abstractmethod
    def expand_keyword(self, keyword: str) -> list[str]:
        pass

    @abstractmethod
    def draft_response(self, prompt: str, max_tokens: int = 300) -> str:
        pass


# ============================================================================
# OPENAI PROVIDER
# ============================================================================

class OpenAIProvider(AIProvider):
    @property
    def name(self) -> str:
        return "openai"

    def is_configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def __init__(self):
        if not self.is_configured():
            return
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = settings.OPENAI_MODEL
        except ImportError:
            logger.warning("openai package not installed.")
            self.client = None
            
    def _handle_openai_error(self, e: Exception):
        import openai
        if isinstance(e, openai.AuthenticationError):
            raise AIAuthError(f"OpenAI Auth Error: {str(e)}")
        elif isinstance(e, (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError)):
            raise AITemporaryError(f"OpenAI Temporary Error: {str(e)}")
        else:
            raise AIProviderMalformedResponseError(f"OpenAI Error: {str(e)}")

    def _parse_json(self, text: str) -> Dict:
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise AIProviderMalformedResponseError(f"OpenAI JSON parse error: {e}")

    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        if not content:
            raise AIInternalValidationError("Empty content provided for analysis.")
        start_time = time.time()
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            result_text = response.choices[0].message.content.strip()
            result = self._parse_json(result_text)
            
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            result["ai_provider"] = self.name
            result["model_version"] = self.model
            return result
        except Exception as e:
            self._handle_openai_error(e)

    def generate_executive_brief(self, content: str) -> Dict:
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích khủng hoảng. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            return self._parse_json(response.choices[0].message.content.strip())
        except Exception as e:
            self._handle_openai_error(e)

    def expand_keyword(self, keyword: str) -> list[str]:
        prompt = f"""Given the keyword '{keyword}', generate 5 synonyms. Return ONLY a valid JSON array of strings."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            res = self._parse_json(response.choices[0].message.content.strip())
            if isinstance(res, list): return [str(x) for x in res]
            return []
        except Exception as e:
            self._handle_openai_error(e)

    def draft_response(self, prompt: str, max_tokens: int = 300) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=max_tokens,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            self._handle_openai_error(e)


# ============================================================================
# GROK PROVIDER (xAI)
# ============================================================================

class GrokProvider(AIProvider):
    @property
    def name(self) -> str:
        return "grok"

    def is_configured(self) -> bool:
        return bool(settings.GROK_API_KEY)

    def __init__(self):
        if not self.is_configured():
            return
        try:
            from openai import OpenAI
            self.client = OpenAI(
                api_key=settings.GROK_API_KEY,
                base_url=settings.GROK_BASE_URL
            )
            self.model = settings.GROK_MODEL
        except ImportError:
            logger.warning("openai package not installed.")
            self.client = None

    def _handle_grok_error(self, e: Exception):
        import openai
        if isinstance(e, openai.AuthenticationError):
            raise AIAuthError(f"Grok Auth Error: {str(e)}")
        elif isinstance(e, (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError)):
            raise AITemporaryError(f"Grok Temporary Error: {str(e)}")
        else:
            raise AIProviderMalformedResponseError(f"Grok Error: {str(e)}")

    def _parse_json(self, text: str) -> Dict:
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise AIProviderMalformedResponseError(f"Grok JSON parse error: {e}")

    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        if not content:
            raise AIInternalValidationError("Empty content provided for analysis.")
        start_time = time.time()
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích social listening. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            result_text = response.choices[0].message.content.strip()
            result = self._parse_json(result_text)
            
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            result["ai_provider"] = self.name
            result["model_version"] = self.model
            return result
        except Exception as e:
            self._handle_grok_error(e)

    def generate_executive_brief(self, content: str) -> Dict:
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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích khủng hoảng. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            return self._parse_json(response.choices[0].message.content.strip())
        except Exception as e:
            self._handle_grok_error(e)

    def expand_keyword(self, keyword: str) -> list[str]:
        prompt = f"""Given the keyword '{keyword}', generate 5 synonyms. Return ONLY a valid JSON array of strings."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            res = self._parse_json(response.choices[0].message.content.strip())
            if isinstance(res, list): return [str(x) for x in res]
            return []
        except Exception as e:
            self._handle_grok_error(e)

    def draft_response(self, prompt: str, max_tokens: int = 300) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=max_tokens,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            self._handle_grok_error(e)


# ============================================================================
# GEMINI PROVIDER
# ============================================================================

class GeminiProvider(AIProvider):
    @property
    def name(self) -> str:
        return "gemini"

    def is_configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    def __init__(self):
        if not self.is_configured():
            return
        try:
            import google.generativeai as genai
            self.genai = genai
            self.genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model_name = settings.GEMINI_MODEL
            self.model = self.genai.GenerativeModel(self.model_name)
        except ImportError:
            logger.warning("google-generativeai package not installed.")
            self.model = None

    def _handle_gemini_error(self, e: Exception):
        err_str = str(e).lower()
        if "api_key" in err_str or "unauthenticated" in err_str or "permission" in err_str:
            raise AIAuthError(f"Gemini Auth Error: {str(e)}")
        elif "quota" in err_str or "429" in err_str or "exhausted" in err_str or "timeout" in err_str or "503" in err_str:
            raise AITemporaryError(f"Gemini Temporary Error: {str(e)}")
        else:
            raise AIProviderMalformedResponseError(f"Gemini Error: {str(e)}")

    def _parse_json(self, text: str) -> Dict:
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise AIProviderMalformedResponseError(f"Gemini JSON parse error: {e}")

    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        if not content:
            raise AIInternalValidationError("Empty content provided for analysis.")
        start_time = time.time()
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
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            result = self._parse_json(result_text)
            
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            result["ai_provider"] = self.name
            result["model_version"] = self.model_name
            return result
        except Exception as e:
            self._handle_gemini_error(e)

    def generate_executive_brief(self, content: str) -> Dict:
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
            response = self.model.generate_content(prompt)
            return self._parse_json(response.text.strip())
        except Exception as e:
            self._handle_gemini_error(e)

    def expand_keyword(self, keyword: str) -> list[str]:
        prompt = f"""Given the keyword '{keyword}', generate 5 synonyms. Return ONLY a valid JSON array of strings."""
        try:
            response = self.model.generate_content(prompt)
            res = self._parse_json(response.text.strip())
            if isinstance(res, list): return [str(x) for x in res]
            return []
        except Exception as e:
            self._handle_gemini_error(e)

    def draft_response(self, prompt: str, max_tokens: int = 300) -> str:
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            self._handle_gemini_error(e)


# ============================================================================
# PHOBERT PROVIDER (Legacy/Offline fallback if needed)
# ============================================================================

class PhoBERTProvider(AIProvider):
    @property
    def name(self) -> str:
        return "phobert"
        
    def is_configured(self) -> bool:
        return getattr(self, "_available", False)
        
    def __init__(self):
        try:
            from transformers import pipeline
            self.classifier = pipeline("sentiment-analysis", model="wonrax/phobert-base-vietnamese-sentiment", tokenizer="wonrax/phobert-base-vietnamese-sentiment", max_length=256, truncation=True)
            self._available = True
        except Exception:
            self._available = False

    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        raise AIProviderMalformedResponseError("PhoBERT unavailable")
        
    def generate_executive_brief(self, content: str) -> Dict:
        raise AIProviderMalformedResponseError("PhoBERT does not support executive brief.")

    def expand_keyword(self, keyword: str) -> list[str]:
        return []

    def draft_response(self, prompt: str, max_tokens: int = 300) -> str:
        return "Không hỗ trợ bởi PhoBERT."


# ============================================================================
# AI PROVIDER MANAGER (FAILOVER CHAIN)
# ============================================================================

class AIProviderManager:
    """Manages the AI provider chain, cooldowns, and routing."""
    
    def __init__(self):
        self._providers: Dict[str, AIProvider] = {}
        self._cooldowns: Dict[str, float] = {}
        
        gemini = GeminiProvider()
        if gemini.is_configured(): self._providers["gemini"] = gemini
        
        grok = GrokProvider()
        if grok.is_configured(): self._providers["grok"] = grok
        
        openai_prov = OpenAIProvider()
        if openai_prov.is_configured(): self._providers["openai"] = openai_prov
        
        chain_str = getattr(settings, "AI_PROVIDER_CHAIN", None)
        if chain_str:
            self._chain = [p.strip().lower() for p in chain_str.split(",") if p.strip()]
        else:
            legacy = getattr(settings, "AI_PROVIDER", None)
            if legacy:
                self._chain = [legacy.lower()]
            else:
                self._chain = ["gemini", "grok"]
                
        self.last_successful_provider = None
        self.last_error_category = None

    def get_status(self) -> Dict:
        now = time.time()
        cooldown_state = {}
        for p, ts in self._cooldowns.items():
            rem = int(ts + settings.AI_PROVIDER_COOLDOWN_SECONDS - now)
            if rem > 0:
                cooldown_state[p] = f"{rem}s remaining"
        
        return {
            "chain": self._chain,
            "configured_providers": list(self._providers.keys()),
            "active_cooldowns": cooldown_state,
            "last_successful_provider": self.last_successful_provider,
            "last_error_category": self.last_error_category,
            "ai_available": any(p in self._providers and (p not in self._cooldowns or now > self._cooldowns[p] + settings.AI_PROVIDER_COOLDOWN_SECONDS) for p in self._chain)
        }

    def _execute_with_failover(self, method_name: str, *args, **kwargs) -> Any:
        """Executes an AI method with provider failover."""
        now = time.time()
        last_exception = None
        
        # Clean up expired cooldowns
        expired = [p for p, ts in self._cooldowns.items() if now > ts + settings.AI_PROVIDER_COOLDOWN_SECONDS]
        for p in expired:
            del self._cooldowns[p]

        for provider_name in self._chain:
            if provider_name not in self._providers:
                continue
                
            if provider_name in self._cooldowns:
                continue # Skip provider in cooldown
                
            provider = self._providers[provider_name]
            method = getattr(provider, method_name)
            
            for attempt in range(settings.AI_PROVIDER_MAX_RETRIES):
                try:
                    result = method(*args, **kwargs)
                    self.last_successful_provider = provider_name
                    self.last_error_category = None
                    return result
                except AIInternalValidationError as e:
                    # Internal bugs (like empty content or invalid inputs) should fail immediately without rotating.
                    logger.error(f"AIInternalValidationError: {str(e)}")
                    self.last_error_category = "internal_validation_error"
                    raise RuntimeError(f"Internal Validation Error: {str(e)}")
                except AIProviderMalformedResponseError as e:
                    # Provider-specific malformed response. Move to next provider.
                    logger.warning(f"AIProviderMalformedResponseError on {provider_name}: {str(e)}")
                    self.last_error_category = "provider_malformed_response"
                    last_exception = e
                    break # Break retry loop, move to next provider
                except AIAuthError as e:
                    logger.error(f"AIAuthError on {provider_name}: {str(e)}. Placing in cooldown.")
                    self._cooldowns[provider_name] = time.time()
                    self.last_error_category = "auth_error"
                    last_exception = e
                    break # Break retry loop, move to next provider
                except AITemporaryError as e:
                    logger.warning(f"AITemporaryError on {provider_name}: {str(e)}. Placing in cooldown.")
                    self._cooldowns[provider_name] = time.time()
                    self.last_error_category = "temporary_error"
                    last_exception = e
                    break # Break retry loop, move to next provider
                except Exception as e:
                    logger.error(f"Unknown error on {provider_name}: {str(e)}")
                    self.last_error_category = "unknown_error"
                    last_exception = e
                    break
        
        # If we got here, all providers failed or chain is empty
        logger.error(f"All AI providers in chain failed. Last error: {str(last_exception)}")
        raise RuntimeError(f"AI Service Unavailable. Last error: {self.last_error_category} - {str(last_exception)}")


# Global Manager Instance
manager = AIProviderManager()

def get_ai_status() -> Dict:
    return manager.get_status()

# ============================================================================
# PUBLIC API WRAPPERS
# ============================================================================

def analyze_mention(content: str, title: Optional[str] = None) -> Dict:
    # Let the RuntimeError bubble up to callers so they know it failed and avoid saving fake AIAnalysis rows.
    return manager._execute_with_failover("analyze_mention", content, title)

def generate_executive_brief(content: str) -> Dict:
    return manager._execute_with_failover("generate_executive_brief", content)

def expand_keyword(keyword: str) -> list[str]:
    try:
        return manager._execute_with_failover("expand_keyword", keyword)
    except RuntimeError:
        return []

async def draft_reputation_response(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    prompt = f"Dự thảo phản hồi CÔNG KHAI: {context}"
    return manager._execute_with_failover("draft_response", prompt, 300)

async def draft_correction_request(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    prompt = f"Dự thảo EMAIL YÊU CẦU ĐÍNH CHÍNH: {context}"
    return manager._execute_with_failover("draft_response", prompt, 500)

async def draft_platform_report(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    prompt = f"Dự thảo BÁO CÁO VI PHẠM: {context}"
    return manager._execute_with_failover("draft_response", prompt, 300)

async def draft_executive_brief(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    prompt = f"Dự thảo TÓM TẮT DÀNH CHO LÃNH ĐẠO: {context}"
    return manager._execute_with_failover("draft_response", prompt, 300)
