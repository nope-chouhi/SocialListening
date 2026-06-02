# Social Listening — Hướng dẫn chạy local

> **Lưu ý:** Dự án dùng **FastAPI + PostgreSQL + Next.js**, không phải Express/MongoDB. Các tính năng Brand24-style đã được tích hợp trên stack hiện tại.

## Yêu cầu

- Node.js 18+
- Python 3.10+
- PostgreSQL
- (Tuỳ chọn) Twitter Bearer Token, News API key cho social crawl
- (Tuỳ chọn) GPU/RAM cho DistilBERT sentiment service (~500MB+)

## 1. Database

```bash
createdb social_listening
cd backend
cp .env.example .env
# Chỉnh DATABASE_URL trong .env
alembic upgrade head
```

## 2. AI Sentiment Service (Flask + DistilBERT)

```bash
cd ai-services
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Service chạy tại `http://localhost:5001` — endpoint `POST /api/ai/sentiment`.

## 3. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
# .env: SCHEDULER_ENABLED=true, SENTIMENT_SERVICE_URL=http://localhost:5001
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tính năng backend mới:

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/realtime/metrics` | Stats + volume 5 phút (refresh 5s từ frontend) |
| `WS /api/realtime/ws?token=JWT` | WebSocket `new-mention` events |
| `GET /api/mentions/export` | Xuất CSV |
| `POST /api/ai/sentiment` | Gọi DistilBERT service |
| Scheduler 5 phút | Social crawl Reddit/News (+ Twitter nếu có token) |

## 4. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Mở http://localhost:3000

## Biến môi trường quan trọng

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social_listening
SECRET_KEY=your-secret-key
SCHEDULER_ENABLED=true
SENTIMENT_SERVICE_URL=http://localhost:5001
TWITTER_BEARER_TOKEN=          # optional
NEWS_API_KEY=                  # optional
SOCIAL_CRAWL_ENABLED=true
```

## Kiểm tra nhanh

1. Đăng nhập → Dashboard → section **Real-time Monitor** (refresh 5s).
2. Thêm **Keywords** active → đợi scheduler social crawl (hoặc trigger thủ công qua Scan Center).
3. **Mentions** → lọc platform → **Xuất CSV**.
4. WebSocket: mở DevTools → Network → WS khi đã login.

## Khác biệt so với spec Node/MongoDB

| Spec gốc | Triển khai thực tế |
|-----------|-------------------|
| Express + MongoDB | FastAPI + PostgreSQL (SQLAlchemy) |
| Socket.io | FastAPI native WebSocket |
| node-cron | APScheduler (embedded trong uvicorn) |
| Mongoose Mention | Model `mentions` đã có sẵn + trường analytics |
