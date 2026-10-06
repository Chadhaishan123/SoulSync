"""Sleep tracking endpoints."""

from __future__ import annotations

import datetime as dt
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_profile
from app.core.security import utcnow
from app.db.session import get_db
from app.models import SleepRecord, User, UserProfile
from app.schemas.tracking import SleepCreate, SleepOut

log = logging.getLogger("soulsync.sleep")

router = APIRouter(prefix="/users", tags=["sleep"])


@router.post("/me/sleep", response_model=SleepOut, status_code=status.HTTP_201_CREATED)
def create_sleep_record(
    payload: SleepCreate,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> SleepOut:
    """
    Log a sleep record.

    `bedtime` and `wake_time` are derived from `sleep_date` and
    `duration_minutes`: wake is 8:00 AM on sleep_date, bedtime is
    duration_minutes before that. This keeps the input simple while
    the model stores both timestamps.
    """
    # Check for duplicate
    existing = db.scalar(
        select(SleepRecord).where(
            SleepRecord.user_id == user.id,
            SleepRecord.sleep_date == payload.sleep_date,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sleep record already exists for {payload.sleep_date}",
        )

    # Derive bedtime/wake_time from sleep_date + duration
    wake_time = dt.datetime.combine(
        payload.sleep_date, dt.time(8, 0), tzinfo=dt.timezone.utc
    )
    bedtime = wake_time - dt.timedelta(minutes=payload.duration_minutes)

    record = SleepRecord(
        user_id=user.id,
        sleep_date=payload.sleep_date,
        bedtime=bedtime,
        wake_time=wake_time,
        duration_minutes=payload.duration_minutes,
        quality=payload.quality_rating,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    log.info(
        "Sleep logged user_id=%s date=%s dur=%dm",
        user.id, payload.sleep_date, payload.duration_minutes,
    )
    return SleepOut.model_validate(record)


@router.get("/me/sleep", response_model=List[SleepOut])
def list_sleep_records(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SleepOut]:
    """List sleep records, newest first."""
    records = db.scalars(
        select(SleepRecord)
        .where(SleepRecord.user_id == user.id)
        .order_by(SleepRecord.sleep_date.desc())
        .limit(60)
    ).all()
    return [SleepOut.model_validate(r) for r in records]
