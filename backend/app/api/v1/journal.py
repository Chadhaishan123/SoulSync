"""Journal and NLP analysis endpoints."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_profile, local_date_for
from app.core.security import utcnow
from app.db.session import get_db
from app.models import JournalAnalysis, JournalEntry, User, UserProfile
from app.schemas.journal import AnalysisOut, JournalCreate, JournalOut
from app.services.nlp import analyze_text

log = logging.getLogger("soulsync.journal")

router = APIRouter(prefix="/users", tags=["journal"])


@router.post("/me/journal", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: JournalCreate,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> JournalOut:
    """Create a journal entry. Word count is computed server-side."""
    now = utcnow()
    word_count = len(payload.content.split())

    entry = JournalEntry(
        user_id=user.id,
        title=payload.title,
        content=payload.content,
        kind=payload.kind,
        word_count=word_count,
        written_at=now,
        local_date=local_date_for(profile, now),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log.info("Journal entry created user_id=%s id=%s words=%s", user.id, entry.id, word_count)
    return JournalOut.model_validate(entry)


@router.get("/me/journal", response_model=List[JournalOut])
def list_entries(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[JournalOut]:
    """List journal entries with nested NLP analysis, newest first."""
    entries = db.scalars(
        select(JournalEntry)
        .options(joinedload(JournalEntry.analysis))
        .where(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.written_at.desc())
        .limit(50)
    ).unique().all()
    return [JournalOut.model_validate(e) for e in entries]


@router.post(
    "/me/journal/{entry_id}/analyze",
    response_model=AnalysisOut,
)
def analyze_entry(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisOut:
    """
    Run NLP analysis on a journal entry.

    Uses the lexicon-based scorer (stub). Will be upgraded to DistilBERT in
    Phase 2. If analysis already exists, it is replaced with a fresh run.
    """
    entry = db.scalar(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == user.id,
        )
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    # Run NLP
    result = analyze_text(entry.content)

    # Upsert analysis
    existing = db.scalar(
        select(JournalAnalysis).where(JournalAnalysis.journal_entry_id == entry.id)
    )
    if existing:
        for key, value in result.items():
            setattr(existing, key, value)
        existing.analyzed_at = utcnow()
        analysis = existing
    else:
        analysis = JournalAnalysis(
            journal_entry_id=entry.id,
            analyzed_at=utcnow(),
            **result,
        )
        db.add(analysis)

    db.commit()
    db.refresh(analysis)

    log.info(
        "NLP analysis for entry_id=%s engine=%s sentiment=%s",
        entry.id, result["engine"], result["sentiment_label"],
    )
    return AnalysisOut.model_validate(analysis)
