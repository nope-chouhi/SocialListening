"""
AI Service for Social Listening Platform
Supports multiple AI providers: OpenAI, Gemini, and Dummy (for testing)
"""
import os
import time
import json
from typing import Dict, Optional
from abc import ABC, abstractmethod
from app.core.config import settings


# ============================================================================
# AI PROVIDER INTERFACE
# ============================================================================

class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        """
        Analyze a mention and return structured results
        
        Returns:
            {
                "sentiment": str,  # positive, neutral, negative_low, negative_medium, negative_high
                "risk_score": float,  # 0-100
                "crisis_level": int,  # 1-5
                "summary_vi": str,  # Vietnamese summary
                "suggested_action": str,  # monitor, respond, escalate, legal_review
                "responsible_department": str,  # customer_service, PR, legal, executive
                "confidence_score": float,  # 0-100
                "processing_time_ms": int
            }
        """
        pass

    def generate_executive_brief(self, content: str) -> Dict:
        """
        Generate an executive brief in 3 formats based on content.
        
        Returns:
            {
                "summary_3_lines": str,
                "zalo_brief": str,
                "full_brief": str,
                "risk_level": str,
                "recommended_decision": str,
                "owner": str,
                "deadline": str
            }
        """
        return {
            "summary_3_lines": "1. Phát hiện sự cố/thảo luận.\n2. Nguy cơ tiềm ẩn trung bình.\n3. Cần theo dõi thêm.",
            "zalo_brief": "🚨 BÁO CÁO NHANH\n- Sự việc: Có thông tin cần lưu ý\n- Đánh giá: Rủi ro trung bình\n- Hành động: Theo dõi",
            "full_brief": "BÁO CÁO CHI TIẾT\n\n1. Tình hình: Đang có thảo luận liên quan đến thương hiệu.\n2. Phân tích: Nguy cơ lan rộng trung bình.\n3. Khuyến nghị: Theo dõi chặt chẽ và chuẩn bị kịch bản phản hồi.",
            "risk_level": "medium",
            "recommended_decision": "Theo dõi và báo cáo khi có diễn biến mới",
            "owner": "Quản lý",
            "deadline": "24h"
        }

    def expand_keyword(self, keyword: str) -> list[str]:
        """
        Dynamically generate synonyms or related keywords for a given keyword
        to improve search expansion coverage.
        """
        return []


# Dummy AI provider removed to enforce real AI usage in production


# ============================================================================
# OPENAI PROVIDER
# ============================================================================

class OpenAIProvider(AIProvider):
    """OpenAI GPT-4 provider for mention analysis"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("openai_dependency_missing: AI chưa sẵn sàng: thiếu package openai.")
    
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        start_time = time.time()
        
        full_text = f"{title}\n\n{content}" if title else content
        
        prompt = f"""Phân tích nội dung sau đây và trả về kết quả dưới dạng JSON:

Nội dung:
{full_text}

Yêu cầu phân tích:
1. sentiment: Đánh giá cảm xúc (chỉ được trả về 1 trong 3 giá trị: positive, neutral, negative)
2. risk_score: Điểm rủi ro từ 0-100 (0 = không rủi ro, 100 = rủi ro cực cao)
3. crisis_level: Mức độ khủng hoảng từ 1-5 (1 = bình thường, 5 = khủng hoảng nghiêm trọng)
4. summary_vi: Tóm tắt ngắn gọn bằng tiếng Việt (1-2 câu)
5. suggested_action: Hành động đề xuất (monitor, respond, escalate, legal_review)
6. responsible_department: Bộ phận chịu trách nhiệm (customer_service, PR, legal, executive, operations, technical)
7. urgency: Độ khẩn cấp (low, medium, high, critical)
8. response_type: Kiểu phản hồi gợi ý (monitor_only, reply_publicly, contact_privately, escalate_to_legal, create_incident...)
9. recommended_owner: Chức danh/Vai trò người nên xử lý (ví dụ: PR Manager, Legal Counsel)
10. deadline_suggestion: Gợi ý thời hạn xử lý (ví dụ: "trong 2 giờ", "trong 24 giờ")
11. escalation_needed: Cần leo thang không? (true/false)
12. why_it_matters: Tại sao vấn đề này quan trọng, có thể ảnh hưởng gì đến thương hiệu? (1-2 câu tiếng Việt)
13. confidence_score: Độ tin cậy của phân tích từ 0-100

LƯU Ý QUAN TRỌNG:
- KHÔNG đề xuất hành động bất hợp pháp (hack, DDoS, spam, scraping trái phép)
- Với nội dung có hại: đề xuất thu thập bằng chứng, yêu cầu sửa đổi, dự thảo takedown hợp pháp, báo cáo vi phạm chính sách nền tảng
- Luôn yêu cầu phê duyệt của con người cho các hành động quan trọng

Trả về JSON thuần túy, không có markdown:"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích social listening. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            
            result = json.loads(result_text)
            
            # Validate and normalize
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "Không có tóm tắt")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            result["urgency"] = result.get("urgency", "low")
            result["response_type"] = result.get("response_type", "monitor_only")
            result["recommended_owner"] = result.get("recommended_owner", "CS Staff")
            result["deadline_suggestion"] = result.get("deadline_suggestion", "N/A")
            result["escalation_needed"] = bool(result.get("escalation_needed", False))
            result["why_it_matters"] = result.get("why_it_matters", "")
            
            # Vietnamese Context fields
            result["vietnamese_context_label"] = result.get("vietnamese_context_label", "")
            result["tone"] = result.get("tone", "")
            result["sarcasm_possible"] = bool(result.get("sarcasm_possible", False))
            result["complaint_type"] = result.get("complaint_type", "")
            result["sensitive_signal"] = bool(result.get("sensitive_signal", False))
            result["explanation"] = result.get("explanation", "")
            
            result["confidence_score"] = float(result.get("confidence_score", 80))
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            
            return result
            
        except Exception as e:
            # Do not fallback to dummy analysis. Fail gracefully.
            logger = logging.getLogger(__name__)
            logger.error(f"OpenAI analysis failed: {e}")
            raise ValueError(f"OpenAI analysis failed: {e}")

    def generate_executive_brief(self, content: str) -> Dict:
        prompt = f"""Tạo báo cáo điều hành (Executive Brief) cho nội dung sau:

Nội dung:
{content}

Bạn phải trả về JSON thuần túy (không markdown) với cấu trúc sau:
{{
  "summary_3_lines": "Tóm tắt đúng 3 gạch đầu dòng: 1. Chuyện gì xảy ra? 2. Mức độ nghiêm trọng? 3. Cần quyết định/hành động gì?",
  "zalo_brief": "Báo cáo cực ngắn, súc tích, phong cách Zalo (có dùng emoji phù hợp) để gửi trong group chat lãnh đạo.",
  "full_brief": "Báo cáo đầy đủ gồm: bối cảnh, phân tích rủi ro, cảm xúc đám đông, và đề xuất chi tiết.",
  "risk_level": "low/medium/high/critical",
  "recommended_decision": "Quyết định đề xuất ngắn gọn",
  "owner": "Người/Bộ phận phụ trách",
  "deadline": "Thời hạn xử lý đề xuất (VD: Trong vòng 2h)"
}}

Tuyệt đối chỉ trả về JSON, không có code block markdown:"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia phân tích khủng hoảng và báo cáo cho ban lãnh đạo. Trả về JSON thuần túy."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800
            )
            
            result_text = response.choices[0].message.content.strip()
            
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            
            return json.loads(result_text)
            
        except Exception as e:
            print(f"OpenAI brief generation failed: {e}")
            return super().generate_executive_brief(content)

    def expand_keyword(self, keyword: str) -> list[str]:
        prompt = f"""You are an SEO and search expert. Given the primary keyword '{keyword}', generate 5 highly relevant alternative keywords or synonyms (in Vietnamese if the keyword is Vietnamese) that a user might use to search for this entity/topic on the internet. Return ONLY a valid JSON array of strings. Do not include markdown formatting or any other text. Example: ["keyword1", "keyword2"]"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=150
            )
            result_text = response.choices[0].message.content.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            expansions = json.loads(result_text)
            if isinstance(expansions, list):
                return [str(e) for e in expansions]
            return []
        except Exception as e:
            print(f"OpenAI Keyword expansion failed: {e}")
            return []


# ============================================================================
# GEMINI PROVIDER
# ============================================================================

class GeminiProvider(AIProvider):
    """Google Gemini provider for mention analysis"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        try:
            import google.generativeai as genai
            self.genai = genai
            self.genai.configure(api_key=api_key)
            self.model = self.genai.GenerativeModel('gemini-pro')
        except ImportError:
            raise ImportError("google-generativeai package not installed. Run: pip install google-generativeai")
    
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        start_time = time.time()
        
        full_text = f"{title}\n\n{content}" if title else content
        
        prompt = f"""Phân tích nội dung sau đây và trả về kết quả dưới dạng JSON:

Nội dung:
{full_text}

Yêu cầu phân tích:
1. sentiment: Đánh giá cảm xúc (chỉ được trả về 1 trong 3 giá trị: positive, neutral, negative)
2. risk_score: Điểm rủi ro từ 0-100 (0 = không rủi ro, 100 = rủi ro cực cao)
3. crisis_level: Mức độ khủng hoảng từ 1-5 (1 = bình thường, 5 = khủng hoảng nghiêm trọng)
4. summary_vi: Tóm tắt ngắn gọn bằng tiếng Việt (1-2 câu)
5. suggested_action: Hành động đề xuất (monitor, respond, escalate, legal_review)
6. responsible_department: Bộ phận chịu trách nhiệm (customer_service, PR, legal, executive, operations, technical)
7. urgency: Độ khẩn cấp (low, medium, high, critical)
8. response_type: Kiểu phản hồi gợi ý (monitor_only, reply_publicly, contact_privately, escalate_to_legal, create_incident...)
9. recommended_owner: Chức danh/Vai trò người nên xử lý (ví dụ: PR Manager, Legal Counsel)
10. deadline_suggestion: Gợi ý thời hạn xử lý (ví dụ: "trong 2 giờ", "trong 24 giờ")
11. escalation_needed: Cần leo thang không? (true/false)
12. why_it_matters: Tại sao vấn đề này quan trọng, có thể ảnh hưởng gì đến thương hiệu? (1-2 câu tiếng Việt)
13. confidence_score: Độ tin cậy của phân tích từ 0-100

LƯU Ý QUAN TRỌNG:
- KHÔNG đề xuất hành động bất hợp pháp (hack, DDoS, spam, scraping trái phép)
- Với nội dung có hại: đề xuất thu thập bằng chứng, yêu cầu sửa đổi, dự thảo takedown hợp pháp, báo cáo vi phạm chính sách nền tảng
- Luôn yêu cầu phê duyệt của con người cho các hành động quan trọng

Trả về JSON thuần túy, không có markdown:
{{
  "sentiment": "...",
  "risk_score": 0,
  "crisis_level": 0,
  "summary_vi": "...",
  "suggested_action": "...",
  "responsible_department": "...",
  "urgency": "...",
  "response_type": "...",
  "recommended_owner": "...",
  "deadline_suggestion": "...",
  "escalation_needed": false,
  "why_it_matters": "...",
  "confidence_score": 0
}}"""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            
            result = json.loads(result_text)
            
            # Validate and normalize
            result["sentiment"] = result.get("sentiment", "neutral")
            result["risk_score"] = float(result.get("risk_score", 50))
            result["crisis_level"] = int(result.get("crisis_level", 2))
            result["summary_vi"] = result.get("summary_vi", "Không có tóm tắt")
            result["suggested_action"] = result.get("suggested_action", "monitor")
            result["responsible_department"] = result.get("responsible_department", "customer_service")
            result["urgency"] = result.get("urgency", "low")
            result["response_type"] = result.get("response_type", "monitor_only")
            result["recommended_owner"] = result.get("recommended_owner", "CS Staff")
            result["deadline_suggestion"] = result.get("deadline_suggestion", "N/A")
            result["escalation_needed"] = bool(result.get("escalation_needed", False))
            result["why_it_matters"] = result.get("why_it_matters", "")
            
            # Vietnamese Context fields
            result["vietnamese_context_label"] = result.get("vietnamese_context_label", "")
            result["tone"] = result.get("tone", "")
            result["sarcasm_possible"] = bool(result.get("sarcasm_possible", False))
            result["complaint_type"] = result.get("complaint_type", "")
            result["sensitive_signal"] = bool(result.get("sensitive_signal", False))
            result["explanation"] = result.get("explanation", "")
            
            result["confidence_score"] = float(result.get("confidence_score", 80))
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            
            return result
            
        except Exception as e:
            # Do not fallback to dummy analysis. Fail gracefully.
            logger = logging.getLogger(__name__)
            logger.error(f"Gemini analysis failed: {e}")
            raise ValueError(f"Gemini analysis failed: {e}")

    def generate_executive_brief(self, content: str) -> Dict:
        prompt = f"""Tạo báo cáo điều hành (Executive Brief) cho nội dung sau:

Nội dung:
{content}

Bạn phải trả về JSON thuần túy (không markdown) với cấu trúc sau:
{{
  "summary_3_lines": "Tóm tắt đúng 3 gạch đầu dòng: 1. Chuyện gì xảy ra? 2. Mức độ nghiêm trọng? 3. Cần quyết định/hành động gì?",
  "zalo_brief": "Báo cáo cực ngắn, súc tích, phong cách Zalo (có dùng emoji phù hợp) để gửi trong group chat lãnh đạo.",
  "full_brief": "Báo cáo đầy đủ gồm: bối cảnh, phân tích rủi ro, cảm xúc đám đông, và đề xuất chi tiết.",
  "risk_level": "low/medium/high/critical",
  "recommended_decision": "Quyết định đề xuất ngắn gọn",
  "owner": "Người/Bộ phận phụ trách",
  "deadline": "Thời hạn xử lý đề xuất (VD: Trong vòng 2h)"
}}

Tuyệt đối chỉ trả về JSON, không có code block markdown:"""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            
            return json.loads(result_text)
            
        except Exception as e:
            print(f"Gemini brief generation failed: {e}")
            return super().generate_executive_brief(content)

    def expand_keyword(self, keyword: str) -> list[str]:
        prompt = f"""You are an SEO and search expert. Given the primary keyword '{keyword}', generate 5 highly relevant alternative keywords or synonyms (in Vietnamese if the keyword is Vietnamese) that a user might use to search for this entity/topic on the internet. Return ONLY a valid JSON array of strings. Do not include markdown formatting or any other text. Example: ["keyword1", "keyword2"]"""
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            expansions = json.loads(result_text)
            if isinstance(expansions, list):
                return [str(e) for e in expansions]
            return []
        except Exception as e:
            print(f"Gemini Keyword expansion failed: {e}")
            return []


# ============================================================================
# PHOBERT PROVIDER (Vietnamese NLP)
# ============================================================================

class PhoBERTProvider(AIProvider):
    """
    PhoBERT-based Vietnamese sentiment analysis provider.
    Uses HuggingFace transformers pipeline with wonrax/phobert-base-vietnamese-sentiment.
    
    Mô hình PhoBERT được pre-train trên dữ liệu tiếng Việt, cho kết quả chính xác hơn
    so với các mô hình đa ngôn ngữ khi phân tích cảm xúc tiếng Việt.
    
    Requirements:
        pip install transformers torch
        (Lưu ý: ~2GB dependencies, chỉ cài khi cần dùng PhoBERT)
    """
    
    def __init__(self):
        try:
            from transformers import pipeline
            # wonrax/phobert-base-vietnamese-sentiment phân loại 3 nhãn:
            # NEG (Negative), POS (Positive), NEU (Neutral)
            self.classifier = pipeline(
                "sentiment-analysis",
                model="wonrax/phobert-base-vietnamese-sentiment",
                tokenizer="wonrax/phobert-base-vietnamese-sentiment",
                max_length=256,
                truncation=True
            )
            self._available = True
        except ImportError:
            print("WARNING: transformers/torch not installed. PhoBERT unavailable.")
            print("Install with: pip install transformers torch")
            self._available = False
        except Exception as e:
            print(f"WARNING: Failed to load PhoBERT model: {e}")
            self._available = False
    
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        start_time = time.time()
        
        # PhoBERT not fully supported in this context without dependencies
        if not self._available:
            raise ValueError("PhoBERT model is unavailable. Please install required dependencies.")
        
        full_text = f"{title} {content}" if title else content
        # Truncate cho PhoBERT (max 256 tokens)
        full_text = full_text[:512]
        
        try:
            # Chạy sentiment classification
            results = self.classifier(full_text)
            # results = [{'label': 'POS'/'NEG'/'NEU', 'score': 0.95}]
            
            label = results[0]["label"].upper()
            score = results[0]["score"]
            
            # Map PhoBERT labels → SentimentScore enum values
            if label == "POS":
                sentiment = "positive"
                risk_score = max(0, 30 - (score * 25))
                crisis_level = 1
            elif label == "NEU":
                sentiment = "neutral"
                risk_score = 30 + (1 - score) * 10
                crisis_level = 1
            else:  # NEG
                sentiment = "negative"
                # Phân loại mức độ tiêu cực dựa trên confidence score để tính risk_score
                if score >= 0.9:
                    risk_score = 80 + (score - 0.9) * 200  # 80-100
                    crisis_level = 4
                elif score >= 0.7:
                    risk_score = 55 + (score - 0.7) * 125  # 55-80
                    crisis_level = 3
                else:
                    risk_score = 35 + (score - 0.5) * 100  # 35-55
                    crisis_level = 2
            
            risk_score = min(max(risk_score, 0), 100)
            
            # Kiểm tra thêm crisis keywords để tăng chính xác
            # (bổ sung cho PhoBERT vì model có thể miss context nguy hiểm)
            content_lower = full_text.lower()
            crisis_keywords = [
                'chết', 'tử vong', 'nguy hiểm', 'cấp cứu', 'kiện',
                'tòa án', 'bê bối', 'rò rỉ', 'hack', 'cháy', 'tai nạn',
                'độc hại', 'nhiễm độc'
            ]
            crisis_found = sum(1 for kw in crisis_keywords if kw in content_lower)
            if crisis_found > 0:
                risk_score = min(risk_score + crisis_found * 15, 100)
                crisis_level = max(crisis_level, 4)
                if sentiment == "negative" or label == "NEG":
                    sentiment = "negative"
            
            # Tạo summary tiếng Việt
            sentiment_labels = {
                "positive": "Nội dung tích cực, phản hồi tốt từ người dùng.",
                "neutral": "Nội dung trung lập, không có ý kiến rõ ràng.",
                "negative": "Nội dung tiêu cực. Có thể cần theo dõi và phản hồi.",
            }
            summary_vi = sentiment_labels.get(sentiment, "Đang phân tích...")
            
            if crisis_level >= 4:
                summary_vi = "Phát hiện nội dung tiêu cực nghiêm trọng. Cần xem xét và xử lý ngay."
            
            # Suggested action
            if crisis_level >= 4:
                suggested_action = "legal_review"
                responsible_department = "legal"
            elif crisis_level >= 3:
                suggested_action = "escalate"
                responsible_department = "executive"
            elif risk_score >= 50:
                suggested_action = "respond"
                responsible_department = "PR"
            else:
                suggested_action = "monitor"
                responsible_department = "customer_service"
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            return {
                "sentiment": sentiment,
                "risk_score": round(risk_score, 1),
                "crisis_level": crisis_level,
                "summary_vi": summary_vi,
                "suggested_action": suggested_action,
                "responsible_department": responsible_department,
                "urgency": "high" if crisis_level >= 4 else "low",
                "response_type": "monitor_only",
                "recommended_owner": "Manager",
                "deadline_suggestion": "24h",
                "escalation_needed": crisis_level >= 3,
                "why_it_matters": "Xác định rủi ro dựa trên mô hình ngôn ngữ.",
                "confidence_score": round(score * 100, 2),
                "processing_time_ms": processing_time_ms,
                "ai_provider": "phobert",
            }
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"PhoBERT analysis failed: {e}")
            raise ValueError(f"PhoBERT analysis failed: {e}")

    def expand_keyword(self, keyword: str) -> list[str]:
        return []



# ============================================================================
# AI SERVICE FACTORY
# ============================================================================

def get_ai_provider() -> AIProvider:
    """
    Get the configured AI provider based on settings
    
    Returns:
        AIProvider instance
    """
    provider_name = settings.AI_PROVIDER.lower()
    is_production = settings.ENVIRONMENT.lower() == "production"
    
    if provider_name == "openai":
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        return OpenAIProvider(api_key)
    
    elif provider_name == "gemini":
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")
        return GeminiProvider(api_key)
    
    elif provider_name == "phobert":
        provider = PhoBERTProvider()
        if provider._available:
            return provider
        raise ValueError("PhoBERT model is unavailable.")
    
    else:
        raise ValueError(f"Unknown or unsupported AI provider '{provider_name}'.")


def analyze_mention(content: str, title: Optional[str] = None) -> Dict:
    """
    Analyze a mention using the configured AI provider
    
    Args:
        content: The mention content to analyze
        title: Optional title of the mention
    
    Returns:
        Analysis results dictionary
    """
    provider = get_ai_provider()
    return provider.analyze_mention(content, title)


# Removed analyze_mention_with_dummy_ai for production constraints


# ============================================================================
# REPUTATION HANDLING DRAFTS
# ============================================================================

async def draft_reputation_response(case) -> str:
    # Build content context from evidence
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    
    prompt = f"""Dự thảo một phản hồi CÔNG KHAI, lịch sự và chuyên nghiệp cho bình luận/bài viết sau:
Nội dung gốc: {context}

Yêu cầu:
1. Giữ giọng văn bình tĩnh, tôn trọng, giải quyết vấn đề.
2. KHÔNG nhận lỗi nếu chưa có kết luận rõ ràng.
3. Mời khách hàng liên hệ qua kênh riêng (inbox, email, hotline) để giải quyết chi tiết.
4. KHÔNG dùng ngôn ngữ tấn công hoặc đe dọa.
5. Ngắn gọn, súc tích (dưới 100 chữ)."""
    
    try:
        provider = get_ai_provider()
        if hasattr(provider, 'client'):
            response = provider.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        elif hasattr(provider, 'model'):
            response = provider.model.generate_content(prompt)
            return response.text.strip()
    except Exception as e:
        logger.error(f"AI draft response failed: {e}")
        
    return "Chào bạn, chúng tôi đã ghi nhận thông tin và đang tiến hành kiểm tra. Bạn vui lòng kiểm tra hộp thư tin nhắn hoặc cung cấp thêm thông tin liên hệ để chúng tôi hỗ trợ kịp thời nhé. Cảm ơn bạn!"

async def draft_correction_request(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    
    prompt = f"""Dự thảo MỘT EMAIL/CÔNG VĂN YÊU CẦU ĐÍNH CHÍNH thông tin sai lệch:
Nội dung sai lệch đang lan truyền: {context}

Yêu cầu:
1. Giọng văn trang trọng, pháp lý, cứng rắn nhưng lịch sự.
2. Trích dẫn URL gốc: {case.source_url or 'không rõ'}.
3. Yêu cầu tác giả/nền tảng gỡ bỏ hoặc đính chính thông tin trong vòng 24-48 giờ.
4. Nhấn mạnh việc bảo lưu quyền sử dụng các biện pháp pháp lý nếu không hợp tác.
5. Ngắn gọn (1-2 đoạn)."""
    
    try:
        provider = get_ai_provider()
        if hasattr(provider, 'client'):
            response = provider.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=500
            )
            return response.choices[0].message.content.strip()
        elif hasattr(provider, 'model'):
            response = provider.model.generate_content(prompt)
            return response.text.strip()
    except Exception as e:
        logger.error(f"AI draft correction failed: {e}")
        
    return "Kính gửi Bộ phận phụ trách/Tác giả bài viết,\n\nChúng tôi phát hiện nội dung bài viết tại liên kết trên chứa thông tin không chính xác, gây ảnh hưởng đến danh tiếng công ty chúng tôi. Chúng tôi yêu cầu gỡ bỏ hoặc đính chính thông tin này trong thời gian sớm nhất.\n\nTrân trọng,"

async def draft_platform_report(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    
    prompt = f"""Dự thảo lý do BÁO CÁO VI PHẠM (Report) gửi cho đội ngũ hỗ trợ của nền tảng {case.platform or 'Mạng xã hội'}:
Nội dung vi phạm: {context}
URL vi phạm: {case.source_url}

Yêu cầu:
1. Nêu rõ nội dung vi phạm điều khoản nào (ví dụ: bôi nhọ danh dự, spam, tin giả, mạo danh).
2. Trình bày ngắn gọn, dễ hiểu để kiểm duyệt viên nền tảng đọc nhanh (dưới 100 chữ).
3. Bằng tiếng Việt và Tiếng Anh (nếu là nền tảng quốc tế)."""
    
    try:
        provider = get_ai_provider()
        if hasattr(provider, 'client'):
            response = provider.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        elif hasattr(provider, 'model'):
            response = provider.model.generate_content(prompt)
            return response.text.strip()
    except Exception as e:
        logger.error(f"AI draft report failed: {e}")
        
    return "Nội dung này vi phạm chính sách cộng đồng (lan truyền thông tin sai lệch/bôi nhọ danh dự). Vui lòng xem xét và gỡ bỏ."

async def draft_executive_brief(case) -> str:
    evidence_texts = [e.captured_text for e in case.evidence] if case.evidence else []
    context = "\n".join(evidence_texts)
    
    prompt = f"""Dự thảo một ĐOẠN TÓM TẮT DÀNH CHO LÃNH ĐẠO (Executive Brief) về sự cố sau:
Tiêu đề: {case.title}
Mức rủi ro: {case.risk_level}
Nội dung tóm tắt: {context[:500]}

Yêu cầu:
1. Format 3 gạch đầu dòng: (1) Tình hình, (2) Đánh giá rủi ro, (3) Đề xuất xử lý.
2. Ngắn gọn, đi thẳng vào vấn đề.
3. Không markdown code block."""

    try:
        provider = get_ai_provider()
        if hasattr(provider, 'client'):
            response = provider.client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        elif hasattr(provider, 'model'):
            response = provider.model.generate_content(prompt)
            return response.text.strip()
    except Exception as e:
        logger.error(f"AI brief failed: {e}")
        
    return "- Tình hình: Đang có bài viết/phản ánh có thể ảnh hưởng danh tiếng.\n- Đánh giá: Cần chú ý theo dõi.\n- Đề xuất: Chờ thu thập thêm bằng chứng và lên phương án phản hồi."
