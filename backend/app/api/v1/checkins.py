"""Daily mood check-in endpoints."""

from __future__ import annotations

import datetime as dt
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_profile, local_date_for
from app.core.security import utcnow
from app.db.session import get_db
from app.models import MoodEntry, User, UserProfile
from app.schemas.tracking import CheckinCreate, CheckinOut

log = logging.getLogger("soulsync.checkins")

router = APIRouter(prefix="/users", tags=["check-ins"])


@router.post("/me/checkins", response_model=CheckinOut, status_code=status.HTTP_201_CREATED)
def create_checkin(
    payload: CheckinCreate,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> CheckinOut:
    """
    Record a daily mood check-in.

    Computes `local_date` from the user's profile timezone so streaks and
    daily aggregates respect their actual calendar day.
    """
    now = utcnow()
    local_dt = local_date_for(profile, now)

    entry = MoodEntry(
        user_id=user.id,
        mood_score=payload.mood_score,
        stress_level=payload.stress_level,
        energy_level=payload.energy_level,
        sleep_quality=payload.sleep_quality,
        primary_emotion=payload.primary_emotion,
        context_tags=payload.context_tags,
        note=payload.notes,
        recorded_at=now,
        local_date=local_dt,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log.info(
        "Check-in created user_id=%s mood=%s date=%s",
        user.id, entry.mood_score, local_dt,
    )
    return CheckinOut.model_validate(entry)


@router.get("/me/checkins", response_model=List[CheckinOut])
def list_checkins(
    limit: int = Query(default=50, ge=1, le=200),
    days: Optional[int] = Query(default=None, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[CheckinOut]:
    """
    List check-ins for the current user, newest first.

    Optional `days` parameter filters to the last N days.
    """
    stmt = (
        select(MoodEntry)
        .where(MoodEntry.user_id == user.id)
        .order_by(MoodEntry.recorded_at.desc())
    )

    if days is not None:
        cutoff = utcnow() - dt.timedelta(days=days)
        stmt = stmt.where(MoodEntry.recorded_at >= cutoff)

    stmt = stmt.limit(limit)

    entries = db.scalars(stmt).all()
    return [CheckinOut.model_validate(e) for e in entries]
