from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import json

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.incident import EvidenceFile, Incident
from app.schemas.incident import EvidenceFileCreate, EvidenceFileResponse

router = APIRouter()

@router.post("/{incident_id}", response_model=EvidenceFileResponse, status_code=201)
def create_evidence(
    incident_id: int,
    body: EvidenceFileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Save an evidence file (or text snapshot) to an incident.
    """
    incident = db.execute(select(Incident).where(Incident.id == incident_id)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    evidence = EvidenceFile(
        **body.dict(),
        incident_id=incident_id,
        captured_by=current_user.id
    )
    
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    
    return evidence

@router.get("/incident/{incident_id}", response_model=List[EvidenceFileResponse])
def list_evidence(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all evidence for an incident"""
    incident = db.execute(select(Incident).where(Incident.id == incident_id)).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    evidence = db.execute(
        select(EvidenceFile).where(EvidenceFile.incident_id == incident_id)
    ).scalars().all()
    
    return evidence

@router.delete("/{evidence_id}", status_code=204)
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an evidence file"""
    evidence = db.execute(select(EvidenceFile).where(EvidenceFile.id == evidence_id)).scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    db.delete(evidence)
    db.commit()
