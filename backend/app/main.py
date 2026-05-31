import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import (
    auth, keywords, sources, mentions, alerts,
    incidents, reports, dashboard, crawl, takedown, services, admin, users, settings as settings_api,
    roles, api_keys, branding, audit, monitor, system, ai, evidence, ai_chat, competitors, influencers
)
from app.api import service_requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed data + start scheduler."""
    logger.info("Starting Social Listening Platform...")

    # Create tables (fallback if alembic hasn't run)
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.warning(f"create_all skipped (tables may already exist via alembic): {e}")

    # Seed service data
    try:
        from app.scripts.seed_services import seed_services_if_empty
        db = SessionLocal()
        try:
            seed_services_if_empty(db)
            logger.info("Service seed check complete")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Service seed skipped: {e}")

    # Start background scheduler
    import os
    if os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true":
        try:
            from app.services.scheduler_service import start_scheduler
            start_scheduler(is_embedded=True)
            logger.info("Embedded background scheduler started")
        except Exception as e:
            logger.warning(f"Embedded scheduler start failed: {e}")

    yield
    
    # Shutdown scheduler
    if os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true":
        try:
            from app.services.scheduler_service import stop_scheduler
            stop_scheduler()
            logger.info("Embedded background scheduler stopped")
        except Exception as e:
            logger.warning(f"Embedded scheduler stop failed: {e}")
    
    logger.info("Shutting down...")


app = FastAPI(
    title="Vietnamese Social Listening Platform",
    description="Monitor, analyze, and manage brand reputation across social media",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Must be added BEFORE routers and BEFORE any exception handlers
# allow_origins=["*"] so CORS headers appear even on 500 responses
_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://social-listening-azure.vercel.app",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in _cors_origins:
    _cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global exception handler — ensures 500s return JSON + CORS ───────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    """Health check with DB connectivity test."""
    db_status = "disconnected"
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    import os
    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "environment": os.environ.get("ENVIRONMENT", settings.ENVIRONMENT),
        "version": "1.0.0",
    }


# ─── Debug routes (non-production only) ───────────────────────────────────────
if settings.ENVIRONMENT != "production":
    @app.get("/api/debug/routes")
    def debug_routes():
        return [{"path": r.path, "methods": list(r.methods or [])} for r in app.routes]

    @app.get("/api/debug/db-tables")
    def debug_db_tables():
        from sqlalchemy import inspect as sa_inspect
        inspector = sa_inspect(engine)
        result = {}
        for table in inspector.get_table_names():
            result[table] = [c["name"] for c in inspector.get_columns(table)]
        return result


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,             prefix="/api/auth",             tags=["Authentication"])
app.include_router(keywords.router,         prefix="/api/keywords",         tags=["Keywords"])
app.include_router(sources.router,          prefix="/api/sources",          tags=["Sources"])
app.include_router(crawl.router,            prefix="/api/crawl",            tags=["Crawl"])
app.include_router(mentions.router,         prefix="/api/mentions",         tags=["Mentions"])
app.include_router(alerts.router,           prefix="/api/alerts",           tags=["Alerts"])
app.include_router(incidents.router,        prefix="/api/incidents",        tags=["Incidents"])
app.include_router(reports.router,          prefix="/api/reports",          tags=["Reports"])
app.include_router(dashboard.router,        prefix="/api/dashboard",        tags=["Dashboard"])
app.include_router(takedown.router,         prefix="/api/takedown",         tags=["Legal Response"])
app.include_router(services.router,         prefix="/api/services",         tags=["Services"])
app.include_router(admin.router,            prefix="/api/admin",            tags=["Admin"])
app.include_router(users.router,            prefix="/api/admin",            tags=["User Management"])
app.include_router(settings_api.router,     prefix="/api/admin/settings",   tags=["System Settings"])
app.include_router(roles.router,            prefix="/api/admin/roles",      tags=["Role Management"])
app.include_router(api_keys.router,         prefix="/api/api-keys",         tags=["API Keys"])
app.include_router(branding.router,         prefix="/api/branding",         tags=["Branding"])
app.include_router(audit.router,            prefix="/api/admin/audit",      tags=["Audit Logs"])
app.include_router(service_requests.router, prefix="/api/service-requests", tags=["Service Requests"])
app.include_router(monitor.router,          prefix="/api/monitor",           tags=["Monitor"])
app.include_router(system.router,           prefix="/api/system",            tags=["System"])
app.include_router(ai.router,               prefix="/api/ai",                tags=["AI"])
app.include_router(ai_chat.router,          prefix="/api/ai",                tags=["AI Chat"])
app.include_router(evidence.router,         prefix="/api/evidence",          tags=["Evidence Locker"])
app.include_router(competitors.router,      prefix="/api/competitors",       tags=["Competitors"])
app.include_router(influencers.router,      prefix="/api/influencers",       tags=["Influencers"])

@app.get("/")
def root():
    return {"message": "Vietnamese Social Listening Platform API", "docs": "/docs", "health": "/health"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
