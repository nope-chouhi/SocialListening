from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import hashlib
from datetime import datetime, timezone
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.reputation import (
    ReputationCase, ReputationEvidence, ReputationAction,
    ReputationCaseType, ReputationCaseStatus, RiskLevel,
    ReputationActionType, ReputationActionStatus
)
from app.models.mention import Mention
from app.schemas.reputation import (
    ReputationCaseOut, ReputationCaseCreate, ReputationCaseUpdate, ReputationCaseDetail,
    ReputationEvidenceOut, ReputationEvidenceCreate,
    ReputationActionOut, ReputationActionCreate, ReputationActionUpdate
)

router = APIRouter()
logger = logging.getLogger(__name__)

# CASES
@router.get("/cases", response_model=List[ReputationCaseOut])
def list_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    query = db.query(ReputationCase)
    # Role based filtering if needed, but for now viewer can see all
    return query.order_by(ReputationCase.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/cases/{case_id}", response_model=ReputationCaseDetail)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/cases", response_model=ReputationCaseOut)
def create_case(
    case_in: ReputationCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_case = ReputationCase(**case_in.dict(), created_by_user_id=current_user.id)
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return new_case

@router.patch("/cases/{case_id}", response_model=ReputationCaseOut)
def update_case(
    case_id: int,
    case_in: ReputationCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    update_data = case_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(case, field, value)
        
    if case_in.status == ReputationCaseStatus.CLOSED and case.closed_at is None:
        case.closed_at = datetime.now(timezone.utc)
        
    db.commit()
    db.refresh(case)
    return case

@router.post("/cases/from-mention/{mention_id}", response_model=ReputationCaseOut)
def create_case_from_mention(
    mention_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mention = db.query(Mention).filter(Mention.id == mention_id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found")
        
    # Suggest risk level
    risk = RiskLevel.LOW
    if mention.sentiment == "negative":
        risk = RiskLevel.MEDIUM
        if (mention.engagement or 0) > 1000:
            risk = RiskLevel.HIGH

    # Suggest case type
    case_type = ReputationCaseType.NEGATIVE_CONTENT
    
    new_case = ReputationCase(
        title=f"Mention: {mention.title or 'Unknown'}",
        description=mention.content[:1000] if mention.content else None,
        case_type=case_type,
        risk_level=risk,
        status=ReputationCaseStatus.NEW,
        source_url=mention.url,
        source_name=mention.source.name if mention.source else None,
        source_type=mention.source.source_type if mention.source else None,
        original_author=mention.author,
        mention_id=mention.id,
        created_by_user_id=current_user.id
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    # Create first evidence
    captured_text = mention.content or mention.title or ""
    content_hash = hashlib.md5(f"{captured_text}{mention.url}{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()
    evidence = ReputationEvidence(
        case_id=new_case.id,
        mention_id=mention.id,
        original_url=mention.url,
        source_name=mention.source.name if mention.source else None,
        source_type=mention.source.source_type if mention.source else None,
        captured_text=captured_text,
        captured_title=mention.title,
        captured_author=mention.author,
        content_hash=content_hash,
        created_by_user_id=current_user.id
    )
    db.add(evidence)
    db.commit()
    
    return new_case

# EVIDENCE
@router.get("/cases/{case_id}/evidence", response_model=List[ReputationEvidenceOut])
def list_evidence(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ReputationEvidence).filter(ReputationEvidence.case_id == case_id).all()

@router.post("/cases/{case_id}/evidence", response_model=ReputationEvidenceOut)
def add_evidence(
    case_id: int,
    evidence_in: ReputationEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content_hash = hashlib.md5(f"{evidence_in.captured_text}{evidence_in.original_url}{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()
    new_evidence = ReputationEvidence(
        **evidence_in.dict(),
        case_id=case_id,
        content_hash=content_hash,
        created_by_user_id=current_user.id
    )
    db.add(new_evidence)
    db.commit()
    db.refresh(new_evidence)
    return new_evidence

# ACTIONS & DRAFTS
@router.get("/cases/{case_id}/actions", response_model=List[ReputationActionOut])
def list_actions(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ReputationAction).filter(ReputationAction.case_id == case_id).order_by(ReputationAction.created_at.desc()).all()

@router.post("/cases/{case_id}/actions", response_model=ReputationActionOut)
def add_action(
    case_id: int,
    action_in: ReputationActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_action = ReputationAction(
        **action_in.dict(),
        case_id=case_id,
        created_by_user_id=current_user.id
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return new_action

@router.patch("/actions/{action_id}", response_model=ReputationActionOut)
def update_action(
    action_id: int,
    action_in: ReputationActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    action = db.query(ReputationAction).filter(ReputationAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
        
    update_data = action_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)
        
    if action_in.status == ReputationActionStatus.EXECUTED and action.executed_at is None:
        action.executed_at = datetime.now(timezone.utc)
        
    db.commit()
    db.refresh(action)
    return action

# AI DRAFTS
from app.services.ai_service import (
    draft_reputation_response, 
    draft_correction_request, 
    draft_platform_report, 
    draft_executive_brief
)

@router.post("/cases/{case_id}/draft-response", response_model=ReputationActionOut)
async def api_draft_response(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    content = await draft_reputation_response(case)
    action = ReputationAction(
        case_id=case.id,
        action_type=ReputationActionType.DRAFT_PUBLIC_RESPONSE,
        title="Dự thảo phản hồi công khai",
        content=content,
        status=ReputationActionStatus.DRAFT,
        requires_approval=True,
        created_by_user_id=current_user.id
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@router.post("/cases/{case_id}/draft-correction-request", response_model=ReputationActionOut)
async def api_draft_correction(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    content = await draft_correction_request(case)
    action = ReputationAction(
        case_id=case.id,
        action_type=ReputationActionType.DRAFT_CORRECTION_REQUEST,
        title="Yêu cầu đính chính",
        content=content,
        status=ReputationActionStatus.DRAFT,
        requires_approval=True,
        created_by_user_id=current_user.id
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@router.post("/cases/{case_id}/draft-platform-report", response_model=ReputationActionOut)
async def api_draft_report(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    content = await draft_platform_report(case)
    action = ReputationAction(
        case_id=case.id,
        action_type=ReputationActionType.DRAFT_PLATFORM_REPORT,
        title="Báo cáo nền tảng",
        content=content,
        status=ReputationActionStatus.DRAFT,
        requires_approval=True,
        created_by_user_id=current_user.id
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@router.post("/cases/{case_id}/executive-brief", response_model=ReputationActionOut)
async def api_executive_brief(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(ReputationCase).filter(ReputationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    content = await draft_executive_brief(case)
    action = ReputationAction(
        case_id=case.id,
        action_type=ReputationActionType.INTERNAL_NOTE,
        title="Báo cáo lãnh đạo (Executive Brief)",
        content=content,
        status=ReputationActionStatus.DRAFT,
        requires_approval=False,
        created_by_user_id=current_user.id
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action
