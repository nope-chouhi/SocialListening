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


# ============================================================================
# DUMMY AI PROVIDER (FOR TESTING)
# ============================================================================

class DummyAIProvider(AIProvider):
    """
    Dummy AI provider using keyword matching
    Used for testing and development
    """
    
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        start_time = time.time()
        
        content_lower = (content or "").lower()
        title_lower = (title or "").lower()
        full_text = f"{title_lower} {content_lower}"
        
        # Negative keywords (Vietnamese + English)
        negative_keywords = [
            'tệ', 'kém', 'dở', 'tồi', 'lừa đảo', 'scam', 'fake', 'giả mạo',
            'bad', 'terrible', 'awful', 'worst', 'fraud', 'cheat',
            'không tốt', 'thất vọng', 'disappointed', 'angry', 'tức giận',
            'lỗi', 'error', 'bug', 'broken', 'hỏng', 'sai', 'wrong',
            'chậm', 'slow', 'delay', 'trễ', 'không phản hồi', 'no response',
            'rác', 'trash', 'garbage', 'useless', 'vô dụng'
        ]
        
        # Positive keywords
        positive_keywords = [
            'tốt', 'good', 'great', 'excellent', 'xuất sắc', 'tuyệt vời',
            'hài lòng', 'satisfied', 'happy', 'vui', 'thích', 'like', 'love',
            'chất lượng', 'quality', 'nhanh', 'fast', 'quick', 'tốc độ',
            'recommend', 'khuyên dùng', 'đáng tin', 'trust', 'reliable'
        ]
        
        # Crisis keywords (high risk)
        crisis_keywords = [
            'chết', 'death', 'die', 'tử vong', 'nguy hiểm', 'danger',
            'bệnh viện', 'hospital', 'cấp cứu', 'emergency', 'khẩn cấp',
            'kiện', 'lawsuit', 'sue', 'court', 'tòa án', 'pháp luật',
            'scandal', 'bê bối', 'rò rỉ', 'leak', 'hack', 'breach',
            'virus', 'nhiễm độc', 'poison', 'toxic', 'độc hại',
            'cháy', 'fire', 'nổ', 'explosion', 'tai nạn', 'accident'
        ]
        
        # Count matches
        negative_count = sum(1 for kw in negative_keywords if kw in full_text)
        positive_count = sum(1 for kw in positive_keywords if kw in full_text)
        crisis_count = sum(1 for kw in crisis_keywords if kw in full_text)
        
        # Calculate sentiment
        if crisis_count > 0:
            sentiment = "negative_high"
        elif negative_count > positive_count + 2:
            sentiment = "negative_high"
        elif negative_count > positive_count:
            sentiment = "negative_medium"
        elif negative_count > 0:
            sentiment = "negative_low"
        elif positive_count > 0:
            sentiment = "positive"
        else:
            sentiment = "neutral"
        
        # Calculate risk score (0-100)
        base_risk = 30
        risk_score = base_risk + (negative_count * 10) + (crisis_count * 20)
        risk_score = min(risk_score, 100)
        
        # Calculate crisis level (1-5)
        if crisis_count > 0:
            crisis_level = 5
        elif risk_score >= 80:
            crisis_level = 4
        elif risk_score >= 60:
            crisis_level = 3
        elif risk_score >= 40:
            crisis_level = 2
        else:
            crisis_level = 1
        
        # Generate summary
        if sentiment == "negative_high":
            summary_vi = "Phát hiện nội dung tiêu cực nghiêm trọng. Cần xem xét và xử lý ngay."
        elif sentiment == "negative_medium":
            summary_vi = "Nội dung có xu hướng tiêu cực. Nên theo dõi và phản hồi."
        elif sentiment == "negative_low":
            summary_vi = "Nội dung có một số ý kiến tiêu cực nhẹ."
        elif sentiment == "positive":
            summary_vi = "Nội dung tích cực, phản hồi tốt từ người dùng."
        else:
            summary_vi = "Nội dung trung lập, không có ý kiến rõ ràng."
        
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
        elif risk_score >= 30:
            suggested_action = "monitor"
            responsible_department = "customer_service"
        else:
            suggested_action = "monitor"
            responsible_department = "customer_service"
        
        # Confidence score (keyword-based is less confident)
        confidence_score = 65.0 + (min(negative_count + positive_count + crisis_count, 10) * 2)
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "sentiment": sentiment,
            "risk_score": risk_score,
            "crisis_level": crisis_level,
            "summary_vi": summary_vi,
            "suggested_action": suggested_action,
            "responsible_department": responsible_department,
            "urgency": "high" if crisis_level >= 4 else ("medium" if risk_score >= 50 else "low"),
            "response_type": "escalate_to_legal" if crisis_level >= 4 else "contact_privately",
            "recommended_owner": "Manager",
            "deadline_suggestion": "within 2 hours" if crisis_level >= 4 else "within 24 hours",
            "escalation_needed": crisis_level >= 3,
            "why_it_matters": f"Nội dung này chứa {crisis_count} từ khóa khủng hoảng và {negative_count} từ tiêu cực.",
            "confidence_score": round(confidence_score, 2),
            "processing_time_ms": processing_time_ms
        }


# ============================================================================
# OPENAI PROVIDER
# ============================================================================

class OpenAIProvider(AIProvider):
    """OpenAI GPT-4 provider for mention analysis"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        try:
            import openai
            self.openai = openai
            self.openai.api_key = api_key
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")
    
    def analyze_mention(self, content: str, title: Optional[str] = None) -> Dict:
        start_time = time.time()
        
        full_text = f"{title}\n\n{content}" if title else content
        
        prompt = f"""Phân tích nội dung sau đây và trả về kết quả dưới dạng JSON:

Nội dung:
{full_text}

Yêu cầu phân tích:
1. sentiment: Đánh giá cảm xúc (positive, neutral, negative_low, negative_medium, negative_high)
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
            response = self.openai.ChatCompletion.create(
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
            result["confidence_score"] = float(result.get("confidence_score", 80))
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            
            return result
            
        except Exception as e:
            # Fallback to dummy analysis if OpenAI fails and not in production
            print(f"OpenAI analysis failed: {e}")
            if settings.ENVIRONMENT.lower() == "production":
                raise ValueError(f"OpenAI analysis failed and dummy fallback is disabled in production: {e}")
            dummy = DummyAIProvider()
            return dummy.analyze_mention(content, title)

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
            response = self.openai.ChatCompletion.create(
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
1. sentiment: Đánh giá cảm xúc (positive, neutral, negative_low, negative_medium, negative_high)
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
            result["confidence_score"] = float(result.get("confidence_score", 80))
            result["processing_time_ms"] = int((time.time() - start_time) * 1000)
            
            return result
            
        except Exception as e:
            # Fallback to dummy analysis if Gemini fails and not in production
            print(f"Gemini analysis failed: {e}")
            if settings.ENVIRONMENT.lower() == "production":
                raise ValueError(f"Gemini analysis failed and dummy fallback is disabled in production: {e}")
            dummy = DummyAIProvider()
            return dummy.analyze_mention(content, title)

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
        
        # Fallback nếu PhoBERT không khả dụng
        if not self._available:
            if settings.ENVIRONMENT.lower() == "production":
                raise ValueError("PhoBERT model is unavailable and dummy fallback is disabled in production.")
            dummy = DummyAIProvider()
            result = dummy.analyze_mention(content, title)
            result["ai_provider"] = "dummy_fallback"
            return result
        
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
                # Phân loại mức độ tiêu cực dựa trên confidence score
                if score >= 0.9:
                    sentiment = "negative_high"
                    risk_score = 80 + (score - 0.9) * 200  # 80-100
                    crisis_level = 4
                elif score >= 0.7:
                    sentiment = "negative_medium"
                    risk_score = 55 + (score - 0.7) * 125  # 55-80
                    crisis_level = 3
                else:
                    sentiment = "negative_low"
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
                if sentiment.startswith("negative"):
                    sentiment = "negative_high"
            
            # Tạo summary tiếng Việt
            sentiment_labels = {
                "positive": "Nội dung tích cực, phản hồi tốt từ người dùng.",
                "neutral": "Nội dung trung lập, không có ý kiến rõ ràng.",
                "negative_low": "Nội dung có một số ý kiến tiêu cực nhẹ.",
                "negative_medium": "Nội dung có xu hướng tiêu cực. Nên theo dõi và phản hồi.",
                "negative_high": "Phát hiện nội dung tiêu cực nghiêm trọng. Cần xem xét và xử lý ngay.",
            }
            summary_vi = sentiment_labels.get(sentiment, "Đang phân tích...")
            
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
            print(f"PhoBERT analysis failed: {e}")
            if settings.ENVIRONMENT.lower() == "production":
                raise ValueError(f"PhoBERT analysis failed and dummy fallback is disabled in production: {e}")
            dummy = DummyAIProvider()
            result = dummy.analyze_mention(content, title)
            result["ai_provider"] = "dummy_fallback"
            return result



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
            raise ValueError("OpenAI API key is missing. Please configure OPENAI_API_KEY in settings.")
        return OpenAIProvider(api_key)
    
    elif provider_name == "gemini":
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("Gemini API key is missing. Please configure GEMINI_API_KEY in settings.")
        return GeminiProvider(api_key)
    
    elif provider_name == "phobert":
        # PhoBERT: Vietnamese-specific sentiment analysis via HuggingFace
        # Requires: pip install transformers torch
        provider = PhoBERTProvider()
        if provider._available:
            return provider
        if is_production:
            raise ValueError("PhoBERT model is unavailable and dummy fallback is disabled in production.")
        print("WARNING: PhoBERT unavailable, falling back to dummy AI")
        return DummyAIProvider()
    
    elif provider_name == "dummy":
        if is_production:
            raise ValueError("Dummy AI provider is not allowed in production environment.")
        return DummyAIProvider()
    
    else:
        if is_production:
            raise ValueError(f"Unknown/dummy AI provider '{provider_name}' is not allowed in production environment.")
        return DummyAIProvider()


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


# ============================================================================
# BACKWARD COMPATIBILITY
# ============================================================================

def analyze_mention_with_dummy_ai(content: str, title: str = None) -> Dict:
    """
    DEPRECATED: Use analyze_mention() instead
    Kept for backward compatibility
    """
    return analyze_mention(content, title)
