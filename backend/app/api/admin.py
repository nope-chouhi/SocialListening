from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.service import ServiceCategory, Service, ServiceType, Platform, RiskLevel
from decimal import Decimal
import subprocess
import os

router = APIRouter()


@router.get("/check-admin-status")
def check_admin_status(
    current_user: User = Depends(get_current_superuser)
):
    """Check if current user is admin - Only accessible by superusers"""
    return {
        "is_admin": True,
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_superuser": current_user.is_superuser,
        "message": "You have admin access!"
    }


def seed_service_categories_inline(db: Session):
    """Seed service categories inline"""
    categories = [
        {
            "name": "Crisis Consulting & Handling",
            "description": "Professional crisis assessment, response planning, and executive briefing services"
        },
        {
            "name": "Negative Content Monitoring",
            "description": "Continuous monitoring and analysis of negative mentions and high-risk content"
        },
        {
            "name": "Legal Takedown & Correction Request",
            "description": "Legal compliance services for takedown requests, corrections, and evidence collection"
        },
        {
            "name": "Press/Media Handling",
            "description": "Professional media response, correction letters, and press monitoring services"
        },
        {
            "name": "Copyright & Brand Protection",
            "description": "Brand asset monitoring and copyright violation evidence preparation"
        },
        {
            "name": "Community Response Planning",
            "description": "Public and private response drafting, comment guides, and reputation management"
        },
        {
            "name": "Monthly Reputation Management",
            "description": "Ongoing reputation health monitoring and action plan reviews"
        }
    ]
    
    for cat_data in categories:
        existing = db.query(ServiceCategory).filter(ServiceCategory.name == cat_data["name"]).first()
        if not existing:
            category = ServiceCategory(**cat_data)
            db.add(category)
    
    db.commit()


def seed_services_inline(db: Session):
    """Seed services inline"""
    # Get categories
    categories = {cat.name: cat.id for cat in db.query(ServiceCategory).all()}
    
    services = [
        # Crisis Consulting & Handling
        {
            "category_id": categories["Crisis Consulting & Handling"],
            "code": "CRISIS_ASSESS",
            "name": "Crisis Situation Assessment",
            "description": "Analyze risk level from collected mentions, classify crisis level 1-5, identify key sources and recommended actions",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Professional consulting and risk assessment services",
            "workflow_template": {
                "steps": [
                    "Collect and review all related mentions",
                    "Analyze risk level and crisis severity",
                    "Identify key sources and influencers",
                    "Classify crisis level (1-5)",
                    "Prepare recommended action plan",
                    "Generate executive summary"
                ]
            },
            "deliverables": {
                "items": [
                    "Risk assessment report",
                    "Crisis timeline analysis",
                    "Recommended action plan",
                    "Key stakeholder identification"
                ]
            },
            "estimated_duration": "4-8 hours",
            "sla_hours": 8,
            "base_price": Decimal("5000000"),  # 5M VND
            "min_quantity": 1,
            "unit": "assessment",
            "risk_level": RiskLevel.MEDIUM,
            "requires_approval": True
        },
        {
            "category_id": categories["Crisis Consulting & Handling"],
            "code": "CRISIS_PLAN",
            "name": "Crisis Response Plan",
            "description": "Create comprehensive response strategy with department assignments and communication framework",
            "service_type": ServiceType.CRISIS_CONSULTING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Strategic consulting and communication planning",
            "workflow_template": {
                "steps": [
                    "Review crisis assessment",
                    "Define response strategy",
                    "Assign department responsibilities",
                    "Create communication messages",
                    "Define approval workflow",
                    "Prepare implementation timeline"
                ]
            },
            "deliverables": {
                "items": [
                    "Crisis response strategy",
                    "RACI matrix",
                    "Message framework",
                    "Implementation timeline"
                ]
            },
            "estimated_duration": "1-2 days",
            "sla_hours": 48,
            "base_price": Decimal("8000000"),  # 8M VND
            "min_quantity": 1,
            "unit": "plan",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        },
        {
            "category_id": categories["Legal Takedown & Correction Request"],
            "code": "LEGAL_TAKEDOWN",
            "name": "Legal Takedown Request Draft",
            "description": "Prepare legal and compliant takedown request drafts with evidence and legal basis",
            "service_type": ServiceType.LEGAL_TAKEDOWN,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Legal document preparation and compliance review",
            "workflow_template": {
                "steps": [
                    "Review content and evidence",
                    "Identify legal basis",
                    "Draft takedown request",
                    "Include supporting evidence",
                    "Legal compliance review",
                    "Prepare for human approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Legal takedown request draft",
                    "Evidence package",
                    "Legal basis documentation",
                    "Compliance checklist"
                ]
            },
            "estimated_duration": "1-2 days",
            "sla_hours": 48,
            "base_price": Decimal("15000000"),  # 15M VND
            "min_quantity": 1,
            "unit": "request",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        },
        {
            "category_id": categories["Negative Content Monitoring"],
            "code": "MONTHLY_MONITOR",
            "name": "Monthly Negative Mention Monitoring",
            "description": "Continuous monitoring of negative mentions by configured keywords and sources with regular reporting",
            "service_type": ServiceType.MONITORING,
            "platform": Platform.ALL_PLATFORMS,
            "legal_basis": "Public content monitoring and analysis services",
            "workflow_template": {
                "steps": [
                    "Configure monitoring parameters",
                    "Collect mentions daily",
                    "Analyze sentiment and risk",
                    "Categorize by severity",
                    "Generate weekly summaries",
                    "Compile monthly report"
                ]
            },
            "deliverables": {
                "items": [
                    "Weekly monitoring reports",
                    "Monthly comprehensive analysis",
                    "Trend analysis",
                    "Risk alerts"
                ]
            },
            "estimated_duration": "Ongoing",
            "sla_hours": 168,  # Weekly reporting
            "base_price": Decimal("12000000"),  # 12M VND per month
            "min_quantity": 1,
            "unit": "month",
            "risk_level": RiskLevel.LOW,
            "requires_approval": False
        },
        {
            "category_id": categories["Press/Media Handling"],
            "code": "PRESS_RESPONSE",
            "name": "Press Response Draft",
            "description": "Professional press response drafts for media inquiries with appropriate tone and messaging",
            "service_type": ServiceType.PRESS_MEDIA,
            "platform": Platform.NEWS_MEDIA,
            "legal_basis": "Media relations and public communication",
            "workflow_template": {
                "steps": [
                    "Analyze media inquiry",
                    "Determine response tone",
                    "Draft response message",
                    "Review legal implications",
                    "Ensure brand consistency",
                    "Prepare for approval"
                ]
            },
            "deliverables": {
                "items": [
                    "Press response draft",
                    "Tone and messaging guide",
                    "Key points summary",
                    "Risk assessment"
                ]
            },
            "estimated_duration": "2-6 hours",
            "sla_hours": 12,
            "base_price": Decimal("6000000"),  # 6M VND
            "min_quantity": 1,
            "unit": "response",
            "risk_level": RiskLevel.HIGH,
            "requires_approval": True
        }
    ]
    
    for service_data in services:
        existing = db.query(Service).filter(Service.code == service_data["code"]).first()
        if not existing:
            service = Service(**service_data)
            db.add(service)
    
    db.commit()


@router.post("/run-migrations")
def run_migrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Run database migrations"""
    try:
        # Check if service tables exist
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'service_categories'
            );
        """))
        tables_exist = result.scalar()
        
        if tables_exist:
            return {"message": "Service catalog tables already exist", "status": "skipped"}
        
        # Create service catalog tables manually
        db.execute(text("""
            -- Create enum types
            DO $$ BEGIN
                CREATE TYPE servicetype AS ENUM (
                    'crisis_consulting', 'monitoring', 'legal_takedown', 'press_media',
                    'copyright_protection', 'community_response', 'reputation_management',
                    'evidence_collection', 'ai_reporting'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE platform AS ENUM (
                    'facebook', 'youtube', 'tiktok', 'twitter', 'instagram',
                    'website', 'news_media', 'all_platforms'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE risklevel AS ENUM ('low', 'medium', 'high', 'critical');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE servicerequeststatus AS ENUM (
                    'draft', 'submitted', 'pending_approval', 'approved', 'in_progress',
                    'waiting_external_response', 'completed', 'rejected', 'cancelled'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE approvalstatus AS ENUM (
                    'not_required', 'pending', 'approved', 'rejected', 'revision_required'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
            
            DO $$ BEGIN
                CREATE TYPE deliverabletype AS ENUM (
                    'report', 'draft_response', 'legal_document', 'evidence_package',
                    'strategy_plan', 'briefing', 'monitoring_dashboard'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        # Create service_categories table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS service_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
            
            CREATE INDEX IF NOT EXISTS ix_service_categories_id ON service_categories (id);
            CREATE INDEX IF NOT EXISTS ix_service_categories_name ON service_categories (name);
            CREATE INDEX IF NOT EXISTS ix_service_categories_is_active ON service_categories (is_active);
        """))
        
        # Create services table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES service_categories(id),
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(500) NOT NULL,
                description TEXT,
                service_type servicetype NOT NULL,
                platform platform NOT NULL,
                legal_basis TEXT,
                workflow_template JSON,
                deliverables JSON,
                estimated_duration VARCHAR(100),
                sla_hours INTEGER,
                base_price NUMERIC(15, 2),
                min_quantity INTEGER DEFAULT 1,
                unit VARCHAR(50),
                risk_level risklevel DEFAULT 'low',
                requires_approval BOOLEAN DEFAULT TRUE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
            
            CREATE INDEX IF NOT EXISTS ix_services_id ON services (id);
            CREATE INDEX IF NOT EXISTS ix_services_category_id ON services (category_id);
            CREATE INDEX IF NOT EXISTS ix_services_code ON services (code);
            CREATE INDEX IF NOT EXISTS ix_services_service_type ON services (service_type);
            CREATE INDEX IF NOT EXISTS ix_services_platform ON services (platform);
            CREATE INDEX IF NOT EXISTS ix_services_risk_level ON services (risk_level);
            CREATE INDEX IF NOT EXISTS ix_services_requires_approval ON services (requires_approval);
            CREATE INDEX IF NOT EXISTS ix_services_is_active ON services (is_active);
        """))
        
        # Create service_requests table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS service_requests (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id),
                related_mention_id INTEGER REFERENCES mentions(id),
                related_alert_id INTEGER REFERENCES alerts(id),
                related_incident_id INTEGER REFERENCES incidents(id),
                requester_id INTEGER NOT NULL REFERENCES users(id),
                assigned_to INTEGER REFERENCES users(id),
                status servicerequeststatus DEFAULT 'draft',
                priority priority DEFAULT 'medium',
                request_reason TEXT,
                evidence_summary TEXT,
                desired_outcome TEXT,
                approval_status approvalstatus DEFAULT 'not_required',
                quoted_price NUMERIC(15, 2),
                final_price NUMERIC(15, 2),
                deadline TIMESTAMP WITH TIME ZONE,
                result_summary TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
            
            CREATE INDEX IF NOT EXISTS ix_service_requests_id ON service_requests (id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_service_id ON service_requests (service_id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_related_mention_id ON service_requests (related_mention_id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_related_alert_id ON service_requests (related_alert_id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_related_incident_id ON service_requests (related_incident_id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_requester_id ON service_requests (requester_id);
            CREATE INDEX IF NOT EXISTS ix_service_requests_assigned_to ON service_requests (assigned_to);
            CREATE INDEX IF NOT EXISTS ix_service_requests_status ON service_requests (status);
            CREATE INDEX IF NOT EXISTS ix_service_requests_priority ON service_requests (priority);
            CREATE INDEX IF NOT EXISTS ix_service_requests_approval_status ON service_requests (approval_status);
        """))
        
        # Create service_request_logs table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS service_request_logs (
                id SERIAL PRIMARY KEY,
                service_request_id INTEGER NOT NULL REFERENCES service_requests(id),
                action VARCHAR(100) NOT NULL,
                old_status VARCHAR(50),
                new_status VARCHAR(50),
                note TEXT,
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS ix_service_request_logs_id ON service_request_logs (id);
            CREATE INDEX IF NOT EXISTS ix_service_request_logs_service_request_id ON service_request_logs (service_request_id);
        """))
        
        # Create service_deliverables table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS service_deliverables (
                id SERIAL PRIMARY KEY,
                service_request_id INTEGER NOT NULL REFERENCES service_requests(id),
                deliverable_type deliverabletype NOT NULL,
                title VARCHAR(500) NOT NULL,
                content TEXT,
                file_url VARCHAR(1000),
                approval_status approvalstatus DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
            
            CREATE INDEX IF NOT EXISTS ix_service_deliverables_id ON service_deliverables (id);
            CREATE INDEX IF NOT EXISTS ix_service_deliverables_service_request_id ON service_deliverables (service_request_id);
            CREATE INDEX IF NOT EXISTS ix_service_deliverables_deliverable_type ON service_deliverables (deliverable_type);
            CREATE INDEX IF NOT EXISTS ix_service_deliverables_approval_status ON service_deliverables (approval_status);
        """))
        
        db.commit()
        
        return {"message": "Service catalog tables created successfully", "status": "success"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.post("/seed-services")
def seed_services_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Seed service catalog data"""
    try:
        # Check if data already exists
        result = db.execute(text("SELECT COUNT(*) FROM service_categories"))
        count = result.scalar()
        
        if count > 0:
            return {"message": "Service catalog data already exists", "status": "skipped"}
        
        # Seed data
        seed_service_categories_inline(db)
        seed_services_inline(db)
        
        return {"message": "Service catalog data seeded successfully", "status": "success"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


@router.get("/service-catalog-status")
def get_service_catalog_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Check service catalog status"""
    try:
        # Check if tables exist
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'service_categories'
            );
        """))
        tables_exist = result.scalar()
        
        if not tables_exist:
            return {"tables_exist": False, "categories_count": 0, "services_count": 0}
        
        # Count data
        categories_result = db.execute(text("SELECT COUNT(*) FROM service_categories"))
        categories_count = categories_result.scalar()
        
        services_result = db.execute(text("SELECT COUNT(*) FROM services"))
        services_count = services_result.scalar()
        
        return {
            "tables_exist": True,
            "categories_count": categories_count,
            "services_count": services_count
        }
        
    except Exception as e:
        return {"error": str(e)}



@router.post("/run-schedule-migration")
def run_schedule_migration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Run migration 013 to add schedule arrays - SUPERUSER ONLY"""
    try:
        # Check if columns already exist
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sources' 
            AND column_name = 'schedule_days_of_week';
        """))
        
        if result.scalar():
            return {
                "success": True,
                "message": "Schedule columns already exist",
                "status": "skipped"
            }
        
        # Add schedule columns
        db.execute(text("""
            ALTER TABLE sources 
            ADD COLUMN IF NOT EXISTS schedule_days_of_week JSON,
            ADD COLUMN IF NOT EXISTS schedule_days_of_month JSON,
            ADD COLUMN IF NOT EXISTS schedule_months JSON,
            ADD COLUMN IF NOT EXISTS schedule_hours JSON;
        """))
        
        db.commit()
        
        return {
            "success": True,
            "message": "Schedule columns added successfully",
            "status": "completed",
            "columns_added": [
                "schedule_days_of_week",
                "schedule_days_of_month",
                "schedule_months",
                "schedule_hours"
            ]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {str(e)}"
        )


@router.post("/add-user-role-column")
def add_user_role_column(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Add role column to users table - SUPERUSER ONLY"""
    try:
        # Check if column already exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'role';
        """))
        
        if result.scalar():
            return {
                "success": True,
                "message": "Role column already exists",
                "status": "skipped"
            }
        
        # Add role column
        db.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'viewer';
        """))
        
        # Create index
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_role ON users (role);
        """))
        
        # Set role based on is_superuser
        db.execute(text("""
            UPDATE users 
            SET role = CASE 
                WHEN is_superuser = TRUE THEN 'super_admin'
                ELSE 'viewer'
            END
            WHERE role IS NULL OR role = 'viewer';
        """))
        
        db.commit()
        
        return {
            "success": True,
            "message": "Role column added and initialized successfully",
            "status": "completed",
            "details": "Superusers set to 'super_admin', others set to 'viewer'"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Migration failed: {str(e)}"
        )
