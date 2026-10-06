"""Activity recommendation endpoints."""

from __future__ import annotations

import datetime as dt
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_profile, local_date_for
from app.core.security import utcnow
from app.db.session import get_db
from app.models import MoodEntry, Recommendation, User, UserProfile
from app.models.activity import Activity
from app.schemas.insights import ActivityInfo, FeedbackRequest, RecommendationOut

log = logging.getLogger("soulsync.recommendations")

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _build_recs(
    user: User, profile: UserProfile, db: Session
) -> List[Recommendation]:
    """
    Generate recommendations based on the user's latest check-in and
    the activity catalogue. Matches context tags to activity contexts.
    """
    latest = db.scalar(
        select(MoodEntry)
        .where(MoodEntry.user_id == user.id)
        .order_by(MoodEntry.recorded_at.desc())
    )
    if latest is None:
        return []

    # Determine context signals
    contexts = []
    if latest.stress_level and latest.stress_level >= 7:
        contexts.append("high_stress")
    if latest.energy_level and latest.energy_level <= 3:
        contexts.append("low_energy")
    if latest.mood_score <= 4:
        contexts.append("low_mood")
    if latest.sleep_quality and latest.sleep_quality <= 4:
        contexts.append("poor_sleep")

    # Fetch matching activities — if context signals exist, prefer matching;
    # otherwise pick a diverse sample
    activities = db.scalars(
        select(Activity)
        .where(Activity.is_active == True, Activity.is_builtin == True)
        .limit(20)
    ).all()

    # Score and rank
    scored = []
    for act in activities:
        act_contexts = act.contexts or []
        overlap = len(set(act_contexts) & set(contexts))
        score = overlap * 2.0 + 1.0  # base score of 1
        scored.append((act, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    # Create recommendation records for top 4
    now = utcnow()
    local_dt = local_date_for(profile, now)
    recs = []

    for act, score in scored[:4]:
        reason = _build_reason(act, contexts, latest)
        rec = Recommendation(
            user_id=user.id,
            activity_id=act.id,
            title=act.name,
            body=act.description,
            reason=reason,
            category=act.category,
            score=score,
            context={
                "mood": latest.mood_score,
                "stress": latest.stress_level,
                "energy": latest.energy_level,
                "contexts": contexts,
            },
            shown_at=now,
            created_at=now,
        )
        db.add(rec)
        recs.append(rec)

    db.commit()
    for r in recs:
        db.refresh(r)

    return recs


def _build_reason(act: Activity, contexts: List[str], latest: MoodEntry) -> str:
    """Build a human-readable reason for this recommendation."""
    parts = []
    act_contexts = act.contexts or []

    if "high_stress" in contexts and "high_stress" in act_contexts:
        parts.append(f"Your stress is at {latest.stress_level}/10")
    if "low_energy" in contexts and "low_energy" in act_contexts:
        parts.append(f"Your energy is at {latest.energy_level}/10")
    if "low_mood" in contexts and "low_mood" in act_contexts:
        parts.append(f"Your mood is at {latest.mood_score}/10")
    if "poor_sleep" in contexts and "poor_sleep" in act_contexts:
        parts.append(f"Sleep quality is {latest.sleep_quality}/10")

    if parts:
        return " — ".join(parts) + f". {act.category.title()} activities can help."
    return f"A {act.category} activity to support your overall wellbeing."


def _rec_to_out(rec: Recommendation, db: Session) -> RecommendationOut:
    """Serialize a recommendation with its activity info."""
    activity = None
    if rec.activity_id:
        act = db.get(Activity, rec.activity_id)
        if act:
            activity = ActivityInfo(
                id=act.id,
                name=act.name,
                description=act.description,
                category=act.category,
                duration_minutes=act.duration_minutes,
            )

    return RecommendationOut(
        id=rec.id,
        title=rec.title,
        reason=rec.reason,
        category=rec.category,
        score=rec.score,
        feedback=rec.feedback,
        activity=activity,
        created_at=rec.created_at,
    )


@router.get("", response_model=List[RecommendationOut])
def list_recommendations(
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> List[RecommendationOut]:
    """
    Get today's recommendations. Generates fresh ones if none exist yet.
    """
    today = local_date_for(profile)
    today_start = dt.datetime.combine(today, dt.time.min, tzinfo=dt.timezone.utc)

    existing = db.scalars(
        select(Recommendation)
        .where(
            Recommendation.user_id == user.id,
            Recommendation.created_at >= today_start,
        )
        .order_by(Recommendation.score.desc())
    ).all()

    if existing:
        return [_rec_to_out(r, db) for r in existing]

    # Generate fresh recommendations
    recs = _build_recs(user, profile, db)
    return [_rec_to_out(r, db) for r in recs]


@router.post("/{rec_id}/feedback")
def submit_feedback(
    rec_id: int,
    payload: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Record feedback on a recommendation."""
    rec = db.scalar(
        select(Recommendation).where(
            Recommendation.id == rec_id,
            Recommendation.user_id == user.id,
        )
    )
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found",
        )

    rec.feedback = 1  # thumbs up
    rec.feedback_at = utcnow()
    rec.acted_at = utcnow()
    db.commit()

    log.info("Feedback on rec_id=%s user_id=%s", rec_id, user.id)
    return {"detail": "Feedback recorded"}
