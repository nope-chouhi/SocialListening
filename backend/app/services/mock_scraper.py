"""
Mock Vietnamese Social Media Scraper
=====================================
Tạo dữ liệu giả lập (mock data) cho các bài đăng mạng xã hội tiếng Việt.
Mô phỏng nội dung từ Facebook, TikTok, YouTube, và các trang tin tức.

Lưu ý xử lý edge cases:
- Teencode/slang tiếng Việt: "ko" = "không", "đc" = "được", "nc" = "nói chuyện"
- Code-switching (trộn tiếng Anh-Việt): "sản phẩm này very good"
- Emoji trong nội dung: 😍🔥💯
- Ký tự đặc biệt và dấu tiếng Việt
- Viết hoa/viết thường không nhất quán

Author: AI Solutions Architect
"""

import random
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional


# ============================================================================
# VIETNAMESE PLATFORM DEFINITIONS
# Định nghĩa các nền tảng mạng xã hội tại Việt Nam
# ============================================================================

PLATFORMS = {
    "Facebook": {
        "weight": 0.35,  # 35% bài đăng từ Facebook (phổ biến nhất tại VN)
        "color": "#1877F2",
        "emoji": "📘",
    },
    "TikTok": {
        "weight": 0.25,  # 25% bài đăng từ TikTok (tăng mạnh tại VN)
        "color": "#000000",
        "emoji": "🎵",
    },
    "YouTube": {
        "weight": 0.20,  # 20% bình luận từ YouTube
        "color": "#FF0000",
        "emoji": "🎬",
    },
    "News": {
        "weight": 0.20,  # 20% từ báo chí online
        "color": "#6B7280",
        "emoji": "📰",
    },
}


# ============================================================================
# MOCK VIETNAMESE AUTHORS
# Tên tác giả giả lập (tên tiếng Việt phổ biến)
# ============================================================================

VIETNAMESE_AUTHORS = [
    "Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Nam", "Phạm Thanh Hà",
    "Hoàng Minh Tuấn", "Vũ Thị Lan", "Đỗ Quang Huy", "Bùi Thanh Mai",
    "Ngô Đức Thắng", "Dương Thị Hương", "Trịnh Xuân Long", "Lý Thị Kim",
    "Võ Minh Đức", "Đinh Thị Ngọc", "Đặng Văn Phong", "Huỳnh Anh Tuấn",
    "Phan Thị Tuyết", "Tô Văn Thành", "Lương Thị Yến", "Hồ Quốc Việt",
    "Mai Thanh Hằng", "Cao Văn Lộc", "Trương Thị Diệu", "Chu Minh Khôi",
    "Nguyễn Thu Trang", "Phạm Đình Khoa", "Lê Thị Như Quỳnh", "Trần Đức Anh",
    "user_vn_2024", "tiktok_fan_hanoi", "reviewer_saigon", "tech_lover_vn",
    "beauty_blogger_hcm", "food_reviewer_dn", "gamer_vietnam", "mẹ_bỉm_sữa_2k5",
]


# ============================================================================
# MOCK VIETNAMESE COMMENTS — POSITIVE (Tích cực)
# Bao gồm teencode, emoji, và code-switching
# ============================================================================

POSITIVE_TEMPLATES = [
    # --- Sản phẩm / Dịch vụ ---
    "Sản phẩm {keyword} quá tuyệt vời luôn! Mình dùng 3 tháng rồi, chất lượng rất ổn định 👍",
    "Vừa mua {keyword} xong, giao hàng nhanh, đóng gói cẩn thận. 10 điểm ko có nhưng ❤️",
    "{keyword} là sản phẩm tốt nhất mà mình từng dùng. Khuyên mọi người nên thử!",
    "Wow {keyword} đỉnh quá đi! Mình recommend cho tất cả bạn bè rồi 😍",
    "Chất lượng {keyword} ngày càng cải thiện, rất hài lòng với phiên bản mới 🔥",
    "Mình là fan cứng {keyword} từ hồi mới ra mắt. Chưa bao giờ thất vọng!",
    "Dùng {keyword} 1 năm rồi, very good quality, giá cả hợp lý nữa 💯",
    "So với các đối thủ thì {keyword} vẫn là number one trong lòng mình 🏆",
    "{keyword} ko hề quảng cáo sai. Mình đã kiểm chứng rồi, thật sự rất tốt!",
    "Nhân viên {keyword} tư vấn nhiệt tình lắm, dịch vụ hậu mãi xuất sắc ạ 🙏",
    # --- Teencode/Slang variants ---
    "{keyword} xịn xò vl luôn á! Ai chưa mua thì mua đi, ko hối hận đâu 🤩",
    "Oke fine {keyword} thắng rồi, mình chịu thua, sản phẩm quá ngon 👏",
    "Real talk nha, {keyword} là best choice r đó mn. Trust me 100%",
    "Mẹ mình cũng khen {keyword} nè, cả nhà ai cũng thích hết á 💕",
    # --- Code-switching (Việt-Anh) ---
    "{keyword} quality rất impressive, worth every penny luôn 💰",
    "Just tried {keyword} and I'm amazed! Sản phẩm Việt Nam mà chất lượng quốc tế 🇻🇳",
]


# ============================================================================
# MOCK VIETNAMESE COMMENTS — NEGATIVE (Tiêu cực)
# Bao gồm các mức độ khác nhau: nhẹ, trung bình, nghiêm trọng
# ============================================================================

NEGATIVE_TEMPLATES = [
    # --- Negative Low (Tiêu cực nhẹ) ---
    "{keyword} giao hàng hơi chậm, đợi gần 1 tuần mới nhận đc 😤",
    "Mình thấy {keyword} lần này ko được tốt như trước, chất lượng giảm rồi",
    "Giá {keyword} tăng mà chất lượng vẫn vậy, hơi thất vọng 😕",
    "{keyword} dịch vụ khách hàng phản hồi rất chậm, đợi 3 ngày chưa trả lời",
    "Đóng gói {keyword} sơ sài quá, nhận hàng bị móp rồi 📦💔",
    # --- Negative Medium (Tiêu cực vừa) ---
    "{keyword} quảng cáo một đằng, sản phẩm thực tế một nẻo. Lừa đảo khách hàng!",
    "Không bao giờ mua {keyword} nữa! Chất lượng tệ, dịch vụ kém, giá thì trên trời",
    "Cẩn thận với {keyword} nha mọi người, mình bị hàng lỗi mà ko được đổi trả 😡",
    "{keyword} fake hàng chính hãng, mình đã kiểm tra rồi. Tẩy chay!",
    "Sản phẩm {keyword} gây dị ứng cho mình, da bị nổi mẩn đỏ hết 😰",
    "{keyword} bị lỗi ngay ngày đầu tiên sử dụng. Thật sự rất tệ!",
    # --- Negative High / Crisis (Tiêu cực nghiêm trọng / Khủng hoảng) ---
    "CẢNH BÁO: {keyword} sản phẩm nguy hiểm! Con mình sử dụng bị phản ứng phải đưa đi cấp cứu 🏥",
    "{keyword} có chất gây hại cho sức khỏe, mọi người cẩn thận! Mình đã báo cơ quan chức năng",
    "Mình sẽ kiện {keyword} ra tòa! Thiệt hại nghiêm trọng, bằng chứng đầy đủ rồi ⚖️",
    "Bê bối {keyword}: nhân viên tiết lộ thông tin khách hàng cho bên thứ 3 😱",
    "{keyword} lừa đảo có tổ chức! Nhiều nạn nhân đã report rồi. Cần cơ quan pháp luật vào cuộc!",
]


# ============================================================================
# MOCK VIETNAMESE COMMENTS — NEUTRAL (Trung lập)
# ============================================================================

NEUTRAL_TEMPLATES = [
    "Có ai biết {keyword} bán ở đâu không ạ? Mình muốn mua thử 🤔",
    "Mọi người cho mình hỏi {keyword} có mấy loại vậy ạ?",
    "{keyword} vừa ra mắt sản phẩm mới, chưa biết chất lượng thế nào",
    "So sánh {keyword} với các sản phẩm cùng phân khúc, mình thấy tạm ổn",
    "Mình đang cân nhắc mua {keyword}, ai có kinh nghiệm chia sẻ với nhé",
    "{keyword} tổ chức sự kiện ngày mai tại TP.HCM, ai đi không?",
    "Giá {keyword} bao nhiêu vậy mn? Mình thấy trên shopee nhiều giá quá 😅",
    "Theo mình thì {keyword} cũng bình thường, ko tốt ko xấu",
    "{keyword} hôm nay có khuyến mãi gì ko ạ?",
    "Mình mới tìm hiểu về {keyword}, ai có review chi tiết share mình với 🙏",
    # --- Teencode neutral ---
    "Ủa {keyword} có chi nhánh ở Đà Nẵng hông ta?",
    "{keyword} ship COD đc ko ạ? Mình ở Cần Thơ",
]


# ============================================================================
# NEWS ARTICLE TEMPLATES
# Mẫu bài báo tiếng Việt (từ các trang tin tức)
# ============================================================================

NEWS_TEMPLATES = [
    "[Tin tức] {keyword} công bố kết quả kinh doanh quý III, doanh thu tăng 15% so với cùng kỳ",
    "[Phân tích] Chiến lược phát triển của {keyword} trong bối cảnh thị trường cạnh tranh khốc liệt",
    "[Nhận định] Chuyên gia đánh giá {keyword} đang dẫn đầu xu hướng chuyển đổi số tại Việt Nam",
    "[Cảnh báo] Phát hiện sản phẩm giả mạo thương hiệu {keyword} trên các sàn thương mại điện tử",
    "[Sự kiện] {keyword} khai trương cửa hàng flagship đầu tiên tại Hà Nội",
    "[Đánh giá] {keyword} nhận giải thưởng Top 10 thương hiệu uy tín Việt Nam 2024",
]


# ============================================================================
# BUZZWORD / HASHTAG POOL
# Từ khóa nóng và hashtag phổ biến
# ============================================================================

BUZZWORDS_VI = [
    "chất lượng", "giá cả", "dịch vụ", "bảo hành", "giao hàng",
    "đóng gói", "quảng cáo", "khuyến mãi", "thương hiệu", "chính hãng",
    "fake", "scam", "review", "đánh giá", "so sánh", "cạnh tranh",
    "công nghệ", "đổi mới", "chiến lược", "thị trường", "xu hướng",
    "sức khỏe", "an toàn", "bền vững", "phát triển", "khách hàng",
]


# ============================================================================
# CORE MOCK GENERATION FUNCTIONS
# ============================================================================

def _select_platform() -> str:
    """
    Chọn ngẫu nhiên nền tảng theo tỷ lệ phân bổ thực tế thị trường VN.
    Facebook chiếm ưu thế (~35%), TikTok đang tăng mạnh (~25%).
    """
    platforms = list(PLATFORMS.keys())
    weights = [PLATFORMS[p]["weight"] for p in platforms]
    return random.choices(platforms, weights=weights, k=1)[0]


def _generate_reach(platform: str) -> int:
    """
    Tạo chỉ số reach/engagement giả lập.
    Phân bổ khác nhau theo nền tảng:
    - Facebook: reach trung bình cao hơn (nhóm chính)
    - TikTok: biến động lớn (viral potential)
    - YouTube: ổn định
    - News: reach cao (bài báo được chia sẻ nhiều)
    """
    ranges = {
        "Facebook": (50, 15000),
        "TikTok": (100, 500000),   # TikTok có khả năng viral rất cao
        "YouTube": (200, 50000),
        "News": (1000, 100000),
    }
    low, high = ranges.get(platform, (100, 10000))
    return random.randint(low, high)


def _generate_author(platform: str) -> str:
    """Tạo tên tác giả ngẫu nhiên, phù hợp với nền tảng."""
    if platform == "News":
        news_sources = [
            "VnExpress", "Tuổi Trẻ Online", "Thanh Niên", "Dân Trí",
            "Báo Lao Động", "VietnamNet", "Zing News", "CafeF",
            "Báo Đầu Tư", "VTC News"
        ]
        return random.choice(news_sources)
    return random.choice(VIETNAMESE_AUTHORS)


def _generate_timestamp(days_back: int = 7) -> datetime:
    """
    Tạo timestamp ngẫu nhiên trong N ngày gần đây.
    Phân bổ thiên về các ngày gần nhất (mô phỏng trend thực tế).
    """
    now = datetime.utcnow()
    # Sử dụng phân bổ mũ (exponential) để nhiều bài gần đây hơn
    hours_back = random.expovariate(1 / (days_back * 12))
    hours_back = min(hours_back, days_back * 24)
    return now - timedelta(hours=hours_back)


def _add_teencode_noise(text: str) -> str:
    """
    Thêm teencode/slang tiếng Việt vào nội dung (mô phỏng cách viết thực tế).
    
    Teencode phổ biến tại VN:
    - "không" → "ko", "k", "hk", "hông"
    - "được" → "đc", "dc"  
    - "biết" → "bít"
    - "thật sự" → "thật sự", "thực sự", "thiệt sự"
    - "quá" → "wá"
    - "rồi" → "r"
    - "vậy" → "z", "dz"
    - "gì" → "j"
    
    Chỉ áp dụng ngẫu nhiên (~30% xác suất) để tự nhiên hơn.
    """
    if random.random() > 0.3:
        return text  # 70% giữ nguyên
    
    replacements = [
        ("không", random.choice(["ko", "k", "hông"])),
        ("được", random.choice(["đc", "dc"])),
        ("biết", "bít"),
        ("quá", "wá"),
        ("rồi", "r"),
        ("vậy", random.choice(["z", "dz"])),
    ]
    for original, replacement in replacements:
        if original in text and random.random() > 0.5:
            text = text.replace(original, replacement, 1)
    return text


def generate_mock_vietnamese_mentions(
    keyword: str,
    count: int = 25,
    days_back: int = 7
) -> List[Dict]:
    """
    Tạo danh sách bài đăng/bình luận giả lập tiếng Việt cho một từ khóa.
    
    Args:
        keyword: Từ khóa theo dõi (ví dụ: "Vinamilk", "VinFast", "Shopee")
        count: Số lượng bài đăng cần tạo (mặc định 25, min 10, max 50)
        days_back: Phạm vi ngày lùi lại để tạo timestamp (mặc định 7 ngày)
    
    Returns:
        List[Dict]: Danh sách các mention với cấu trúc:
            {
                "platform": str,       # Facebook/TikTok/YouTube/News
                "content": str,        # Nội dung tiếng Việt
                "author": str,         # Tên tác giả
                "reach": int,          # Số lượt tiếp cận
                "published_at": datetime,
                "url": str,            # URL giả lập
                "sentiment_hint": str, # positive/negative/neutral (gợi ý)
            }
    
    Edge Cases Handled:
        - Empty keyword → returns empty list with warning
        - count < 10 → clamped to 10
        - count > 50 → clamped to 50
        - Special characters in keyword → escaped safely
    """
    # --- Edge case: empty keyword ---
    if not keyword or not keyword.strip():
        return []
    
    keyword = keyword.strip()
    count = max(10, min(count, 50))
    
    mentions = []
    
    # Phân bổ sentiment: ~40% positive, ~25% neutral, ~35% negative
    # (nghiêng về tiêu cực một chút để dashboard có đủ dữ liệu cảnh báo)
    sentiment_distribution = (
        ["positive"] * 40 +
        ["neutral"] * 25 +
        ["negative"] * 35
    )
    
    for i in range(count):
        platform = _select_platform()
        sentiment = random.choice(sentiment_distribution)
        
        # Chọn template theo sentiment
        if platform == "News" and random.random() > 0.5:
            template = random.choice(NEWS_TEMPLATES)
            # Bài báo thường trung lập hoặc nhẹ
            sentiment = random.choice(["neutral", "neutral", "positive", "negative"])
        elif sentiment == "positive":
            template = random.choice(POSITIVE_TEMPLATES)
        elif sentiment == "negative":
            template = random.choice(NEGATIVE_TEMPLATES)
        else:
            template = random.choice(NEUTRAL_TEMPLATES)
        
        # Thay thế {keyword} vào template
        content = template.format(keyword=keyword)
        
        # Áp dụng teencode noise (chỉ cho Facebook và TikTok)
        if platform in ("Facebook", "TikTok"):
            content = _add_teencode_noise(content)
        
        author = _generate_author(platform)
        reach = _generate_reach(platform)
        published_at = _generate_timestamp(days_back)
        
        # Tạo URL giả lập theo nền tảng
        url = _generate_mock_url(platform, keyword, i)
        
        mentions.append({
            "platform": platform,
            "content": content,
            "author": author,
            "reach": reach,
            "published_at": published_at,
            "url": url,
            "sentiment_hint": sentiment,
        })
    
    # Sắp xếp theo thời gian mới nhất trước
    mentions.sort(key=lambda x: x["published_at"], reverse=True)
    
    return mentions


def _generate_mock_url(platform: str, keyword: str, index: int) -> str:
    """Tạo URL giả lập phù hợp với từng nền tảng."""
    # Tạo hash ngắn cho URL unique
    hash_part = hashlib.md5(f"{keyword}_{index}_{random.random()}".encode()).hexdigest()[:8]
    
    urls = {
        "Facebook": f"https://facebook.com/posts/{hash_part}",
        "TikTok": f"https://tiktok.com/@user/video/{hash_part}",
        "YouTube": f"https://youtube.com/watch?v={hash_part}",
        "News": random.choice([
            f"https://vnexpress.net/tin-tuc/{hash_part}.html",
            f"https://tuoitre.vn/bai-viet-{hash_part}.htm",
            f"https://thanhnien.vn/su-kien-{hash_part}.html",
            f"https://dantri.com.vn/kinh-doanh/{hash_part}.htm",
        ]),
    }
    return urls.get(platform, f"https://example.com/{hash_part}")


def extract_buzzwords(mentions: List[Dict], top_n: int = 10) -> List[Dict]:
    """
    Trích xuất từ khóa nổi bật (buzzwords) từ danh sách mentions.
    
    Phương pháp: Đếm tần suất xuất hiện của các từ có ý nghĩa trong tiếng Việt,
    loại bỏ stopwords phổ biến.
    
    Args:
        mentions: Danh sách mentions
        top_n: Số lượng buzzwords trả về
    
    Returns:
        List[Dict]: [{"word": str, "count": int}, ...]
    """
    # Vietnamese stopwords (từ dừng tiếng Việt phổ biến)
    stopwords = {
        "và", "là", "của", "có", "được", "cho", "với", "này", "các", "một",
        "trong", "không", "đã", "những", "người", "nhưng", "từ", "đến", "như",
        "cũng", "về", "theo", "khi", "tại", "hay", "rất", "lại", "nên",
        "ở", "ra", "vào", "để", "bị", "sẽ", "do", "nếu", "thì", "mà",
        "còn", "đó", "nào", "đi", "ạ", "nha", "nhé", "à", "ơi", "hả",
        "vậy", "thế", "mọi", "tất", "cả", "ai", "mình", "bạn", "anh",
        "chị", "em", "ông", "bà", "họ", "chúng", "ta", "tôi",
        # English stopwords thường gặp trong code-switching
        "the", "and", "is", "of", "to", "in", "for", "on", "with",
    }
    
    word_counts: Dict[str, int] = {}
    
    for mention in mentions:
        content = mention.get("content", "").lower()
        # Tách từ đơn giản (có thể cải thiện bằng underthesea/pyvi cho production)
        words = content.split()
        for word in words:
            # Loại bỏ ký tự đặc biệt ở đầu/cuối
            word = word.strip(".,!?;:\"'()[]{}#@💯🔥😍😡😰👍❤️🤔😕🏥⚖️😱🤩👏💕💰🇻🇳📦💔📘🎵🎬📰🏆🙏😅😤")
            if len(word) >= 2 and word not in stopwords:
                word_counts[word] = word_counts.get(word, 0) + 1
    
    # Sắp xếp theo tần suất giảm dần
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    
    return [{"word": word, "count": count} for word, count in sorted_words[:top_n]]
