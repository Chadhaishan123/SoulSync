from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database.session import get_db
from app.models.models import User, JournalEntry, JournalAnalysis
from app.schemas.schemas import JournalEntryCreate, JournalEntryResponse, JournalAnalysisResponse
from app.api.deps import get_current_user
from app.services.ai_service import ai_service
import datetime

router = APIRouter()

@router.post("", response_model=JournalEntryResponse)
def create_journal_entry(
    journal_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Create journal entry
    new_entry = JournalEntry(
        user_id=current_user.id,
        content=journal_in.content
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # 2. Trigger NLP analysis
    try:
        analysis_result = ai_service.analyze_text(journal_in.content)
        analysis = JournalAnalysis(
            journal_id=new_entry.id,
            sentiment_score=analysis_result["sentiment_score"],
            dominant_emotion=analysis_result["dominant_emotion"],
            emotion_probabilities=analysis_result["emotion_probabilities"],
            themes=analysis_result["themes"],
            summary=analysis_result["summary"],
            model_version=analysis_result["model_version"]
        )
        db.add(analysis)
        db.commit()
    except Exception as e:
        print(f"NLP Analysis failed: {e}")
        # Insert a default fallback analysis in case NLP fails
        analysis = JournalAnalysis(
            journal_id=new_entry.id,
            sentiment_score=0.0,
            dominant_emotion="Neutral",
            emotion_probabilities={"Neutral": 1.0},
            themes=[],
            summary="No summary available.",
            model_version="fallback"
        )
        db.add(analysis)
        db.commit()
        
    db.refresh(new_entry)
    return new_entry


@router.get("", response_model=List[JournalEntryResponse])
def read_journal_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(JournalEntry).filter(
        JournalEntry.user_id == current_user.id
    ).order_by(desc(JournalEntry.created_at)).all()


@router.get("/{journal_id}", response_model=JournalEntryResponse)
def read_journal_entry(
    journal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(JournalEntry).filter(
        JournalEntry.id == journal_id,
        JournalEntry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.put("/{journal_id}", response_model=JournalEntryResponse)
def update_journal_entry(
    journal_id: int,
    journal_in: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(JournalEntry).filter(
        JournalEntry.id == journal_id,
        JournalEntry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    entry.content = journal_in.content
    entry.updated_at = datetime.datetime.utcnow()
    db.commit()
    
    # Re-analyze
    if entry.analysis:
        db.delete(entry.analysis)
        db.commit()
        
    try:
        analysis_result = ai_service.analyze_text(journal_in.content)
        analysis = JournalAnalysis(
            journal_id=entry.id,
            sentiment_score=analysis_result["sentiment_score"],
            dominant_emotion=analysis_result["dominant_emotion"],
            emotion_probabilities=analysis_result["emotion_probabilities"],
            themes=analysis_result["themes"],
            summary=analysis_result["summary"],
            model_version=analysis_result["model_version"]
        )
        db.add(analysis)
        db.commit()
    except Exception as e:
        print(f"NLP Re-analysis failed: {e}")
        
    db.refresh(entry)
    return entry


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_entry(
    journal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(JournalEntry).filter(
        JournalEntry.id == journal_id,
        JournalEntry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    db.delete(entry)
    db.commit()
    return None


@router.post("/{journal_id}/analyze", response_model=JournalAnalysisResponse)
def analyze_journal_entry(
    journal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(JournalEntry).filter(
        JournalEntry.id == journal_id,
        JournalEntry.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    if entry.analysis:
        db.delete(entry.analysis)
        db.commit()
        
    analysis_result = ai_service.analyze_text(entry.content)
    analysis = JournalAnalysis(
        journal_id=entry.id,
        sentiment_score=analysis_result["sentiment_score"],
        dominant_emotion=analysis_result["dominant_emotion"],
        emotion_probabilities=analysis_result["emotion_probabilities"],
        themes=analysis_result["themes"],
        summary=analysis_result["summary"],
        model_version=analysis_result["model_version"]
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis
