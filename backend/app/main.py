import os
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import (
    collectors,
    auth, keywords, sources, mentions, alerts,
    incidents, reports, dashboard, crawl, takedown, services, admin, users, settings as settings_api,
    roles, api_keys, branding, audit, monitor, system, ai, evidence, ai_chat, competitors, influencers,
    reputation, discovery, integrations, realtime, saved_filters,
    organizations, billing
)
from app.api import service_requests, webinar

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed data + start scheduler."""
    logger.info("Starting Social Listening Platform...")

    # Run database migrations automatically
    try:
        import os
        import alembic.config
        import alembic.command
        logger.info("Running automatic database migrations...")
        
        # __file__ is backend/app/main.py
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_ini_path = os.path.join(base_dir, "alembic.ini")
        
        # We must change dir so alembic script_location resolves correctly
        original_cwd = os.getcwd()
        os.chdir(base_dir)
        
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations applied successfully.")
        
        # Restore cwd just in case
        os.chdir(original_cwd)
    except Exception as e:
        logger.warning(f"create_all skipped (tables may already exist via alembic): {e}")

    try:
        # FORCE PROMOTE ADMIN ON STARTUP
        db = SessionLocal()
        try:
            from sqlalchemy import text
            db.execute(text("UPDATE users SET is_superuser = true, is_active = true, role = 'super_admin' WHERE email = 'honguyenhung2010@gmail.com'"))
            db.commit()
            logger.info("Successfully granted admin privileges to honguyenhung2010@gmail.com")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to grant admin privileges: {e}")

    try:
        from app.models.webinar import WebinarRegistration
        WebinarRegistration.metadata.create_all(bind=engine)
        logger.info("Webinar table created/verified")
    except Exception as e:
        logger.warning(f"Webinar table creation failed: {e}")

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

    # Start background scheduler (embedded or SCHEDULER_ENABLED)
    enable_scheduler = (
        os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true"
        or os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    )
    if enable_scheduler:
        try:
            from app.services.scheduler_service import start_scheduler
            is_started = start_scheduler(is_embedded=os.getenv("ENABLE_EMBEDDED_SCHEDULER", "false").lower() == "true")
            if is_started:
                logger.info("Background scheduler started")
            else:
                logger.warning("Scheduler start failed or was disabled")
        except Exception as e:
            logger.warning(f"Scheduler start failed: {e}")

    yield
    
    # Shutdown scheduler
    if enable_scheduler:
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi.exceptions import HTTPException

# ─── Global exception handler — ensures 500s return JSON + CORS ───────────────
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    # Temporarily expose full detail in production for debugging
    if exc.status_code >= 500:
        logger.error(f"HTTPException 500 on {request.method} {request.url}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

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
app.include_router(collectors.router,       prefix="/api/collectors",      tags=["Collectors"])
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
app.include_router(webinar.router,          prefix="/api/webinar",           tags=["Webinar"])
app.include_router(ai.router,               prefix="/api/ai",                tags=["AI"])
app.include_router(ai_chat.router,          prefix="/api/ai",                tags=["AI Chat"])
app.include_router(evidence.router,         prefix="/api/evidence",          tags=["Evidence Locker"])
app.include_router(competitors.router,      prefix="/api/competitors",       tags=["Competitors"])
app.include_router(influencers.router,      prefix="/api/influencers",       tags=["Influencers"])
app.include_router(reputation.router,       prefix="/api/reputation",        tags=["Reputation Handling"])
app.include_router(discovery.router,        prefix="/api/discovery",         tags=["Auto Discovery"])
app.include_router(integrations.router,     prefix="/api/integrations",      tags=["Integrations"])
app.include_router(realtime.router,         prefix="/api/realtime",          tags=["Realtime"])
app.include_router(saved_filters.router,    prefix="/api/saved-filters",    tags=["Saved Filters"])
app.include_router(organizations.router,    prefix="/api/organizations",    tags=["Organizations"])
app.include_router(billing.router,          prefix="/api/billing",          tags=["Billing"])

@app.get("/")
def root():
    return {"message": "Vietnamese Social Listening Platform API", "docs": "/docs", "health": "/health"}


from sqlalchemy import text
from app.core.database import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

@app.get("/api/sys/db-stats")
def get_db_stats(db: Session = Depends(get_db)):
    # Count sentiments
    stats = {}
    mentions = db.execute(text("SELECT sentiment, COUNT(*) as count FROM mentions GROUP BY sentiment")).fetchall()
    for row in mentions:
        stats[row[0] if row[0] is not None else "null"] = row[1]
    return {"status": "ok", "stats": stats}

@app.get("/api/sys/run-backfill")
def run_prod_backfill(db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE mentions SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        db.execute(text("UPDATE ai_analysis SET sentiment = 'negative' WHERE sentiment IN ('negative_low', 'negative_medium', 'negative_high')"))
        db.execute(text("""
            UPDATE mentions
            SET sentiment = (
                SELECT sentiment FROM ai_analysis 
                WHERE ai_analysis.mention_id = mentions.id
                LIMIT 1
            )
            WHERE sentiment IS NULL OR sentiment = ''
        """))
        db.execute(text("UPDATE mentions SET sentiment = 'neutral' WHERE sentiment IS NULL OR sentiment = ''"))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/sys/run-visit-migration")
def run_visit_migration(db: Session = Depends(get_db)):
    try:
        # PostgreSQL syntax for adding columns safely
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT FALSE"))
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0"))
        db.execute(text("ALTER TABLE mentions ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMP WITH TIME ZONE NULL"))
        
        # Check if mention_visits exists, if not create it
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS mention_visits (
                id SERIAL PRIMARY KEY,
                mention_id INTEGER NOT NULL,
                user_id INTEGER,
                project_id INTEGER,
                visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                original_url TEXT,
                source_type VARCHAR(50),
                user_agent TEXT,
                ip_hash VARCHAR(64)
            )
        """))
        
        db.commit()
        return {"status": "success", "message": "Migration completed successfully"}
    except Exception as e:
        db.rollback()
        # Fallback to SQLite syntax if we are running locally
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN is_reviewed BOOLEAN DEFAULT 0"))
        except: pass
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN visit_count INTEGER DEFAULT 0"))
        except: pass
        try:
            db.execute(text("ALTER TABLE mentions ADD COLUMN last_visited_at DATETIME NULL"))
        except: pass
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS mention_visits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mention_id INTEGER NOT NULL,
                    user_id INTEGER,
                    project_id INTEGER,
                    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    original_url TEXT,
                    source_type VARCHAR(50),
                    user_agent TEXT,
                    ip_hash VARCHAR(64)
                )
            """))
        except: pass
        db.commit()
        return {"status": "partial", "error": str(e), "message": "Ran SQLite fallback migration"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
@app.get("/api/debug/migrate")
def debug_migrate():
    import traceback
    import alembic.config
    import alembic.command
    import os
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        original_cwd = os.getcwd()
        os.chdir(base_dir)
        alembic_cfg = alembic.config.Config("alembic.ini")
        alembic.command.upgrade(alembic_cfg, "head")
        os.chdir(original_cwd)
        return {"status": "success"}
    except Exception as e:
        os.chdir(original_cwd)
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

