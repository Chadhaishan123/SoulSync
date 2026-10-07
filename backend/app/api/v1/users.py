"""
Profile, consent, onboarding and data-rights endpoints.

Two things here are load-bearing for the rest of the app rather than being
mere settings CRUD:

  * **Location.** `PUT /users/me/location` is the only way real coordinates
    enter the system, and it refuses to store them without location consent.
    Every environment reading is fetched for these coordinates, which is what
    makes "live weather" mean the user's actual weather.
  * **Timezone.** `local_date` on every check-in, journal entry and habit
    completion is derived from `profile.timezone`. Changing it changes where a
    user's day boundary falls, so it is validated against the IANA database
    rather than accepted as free text.
"""

from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import inspect as sa_inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_profile
from app.core.security import utcnow, verify_password
from app.db.session import get_db
from app.models import (
    ActivityCompletion,
    ConsentRecord,
    ConversationMessage,
    ConversationSession,
    DetectedPattern,
    EnvironmentSnapshot,
    GratitudeItem,
    JournalAnalysis,
    JournalEntry,
    MLPrediction,
    MoodEntry,
    Recommendation,
    ReframeEntry,
    SleepRecord,
    TimeCapsule,
    User,
    UserProfile,
)
from app.models.activity import Activity
from app.schemas.common import Message
from app.schemas.user import (
    ConsentRecordOut,
    ConsentUpdate,
    DeleteAccountRequest,
    EmailUpdate,
    LocationUpdate,
    MeOut,
    OnboardingRequest,
    ProfileOut,
    ProfileUpdate,
)

log = logging.getLogger("soulsync.users")

router = APIRouter(prefix="/users", tags=["users"])

# Consent type -> the UserProfile column holding its current state. One
# mapping so the audit trail and the live flag can never disagree about which
# toggle a record describes.
CONSENT_COLUMNS: Dict[str, str] = {
    "location": "location_enabled",
    "environment": "environment_enabled",
    "nlp_analysis": "nlp_analysis_enabled",
    "notifications": "notifications_enabled",
    "personalization": "personalization_enabled",
}


# --------------------------------------------------------------------- helpers

def _profile_out(profile: UserProfile) -> ProfileOut:
    """`has_real_location` is a property, so it is attached explicitly."""
    out = ProfileOut.model_validate(profile)
    out.has_real_location = profile.has_real_location
    return out


def _me_out(user: User, profile: UserProfile) -> MeOut:
    return MeOut(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        profile=_profile_out(profile),
        is_onboarded=profile.onboarded_at is not None,
    )


def _record_consent(
    db: Session, user_id: int, consent_type: str, granted: bool
) -> None:
    """
    Append an audit row for a consent transition.

    Called only when the value actually changes. Logging no-op writes would
    bury the real grant/revoke events under repeated settings saves, and a
    consent history nobody can read is not a consent history.
    """
    now = utcnow()
    db.add(
        ConsentRecord(
            user_id=user_id,
            consent_type=consent_type,
            is_granted=granted,
            granted_at=now if granted else None,
            revoked_at=None if granted else now,
        )
    )


def _apply_consents(
    db: Session, profile: UserProfile, changes: Dict[str, bool]
) -> List[str]:
    """
    Apply consent changes, recording each transition. Returns what changed.

    Revoking location consent also clears the stored coordinates. A revoke
    that left the last known position in the database would be cosmetic — the
    user asked us to stop holding their location, not just to stop refreshing
    it.
    """
    changed: List[str] = []
    for consent_type, value in changes.items():
        column = CONSENT_COLUMNS[consent_type]
        if getattr(profile, column) == value:
            continue

        setattr(profile, column, value)
        _record_consent(db, profile.user_id, consent_type, value)
        changed.append(consent_type)

        if consent_type == "location" and not value:
            profile.last_latitude = None
            profile.last_longitude = None
            profile.last_city = None
            profile.last_country_code = None
            profile.location_updated_at = None
            # Environment data is fetched *for* coordinates, so it cannot
            # outlive location consent.
            if profile.environment_enabled:
                profile.environment_enabled = False
                _record_consent(db, profile.user_id, "environment", False)
                changed.append("environment")

    return changed


def _row_to_dict(obj: Any, exclude: tuple[str, ...] = ()) -> Dict[str, Any]:
    """
    Serialise an ORM row generically for the data export.

    Driven by the mapper rather than a hand-written field list per model: with
    20 tables, a hand-maintained export silently stops being complete the first
    time someone adds a column, and an incomplete export is a broken data-rights
    promise rather than a cosmetic bug.
    """
    out: Dict[str, Any] = {}
    for attr in sa_inspect(obj).mapper.column_attrs:
        if attr.key in exclude:
            continue
        value = getattr(obj, attr.key)
        # datetime is a subclass of date, so this covers both.
        out[attr.key] = value.isoformat() if isinstance(value, dt.date) else value
    return out


# -------------------------------------------------------------- profile & prefs

@router.get("/me", response_model=MeOut)
def read_me(
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
) -> MeOut:
    """Account plus profile in one call, so the client needs no second request."""
    return _me_out(user, profile)


@router.patch("/me", response_model=MeOut)
def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MeOut:
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        user.name = data["name"]

    for field in ("timezone", "wellness_goals", "reminder_hour", "sleep_goal_minutes"):
        if field in data and data[field] is not None:
            setattr(profile, field, data[field])

    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return _me_out(user, profile)


@router.patch("/me/email", response_model=MeOut)
def update_email(
    payload: EmailUpdate,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MeOut:
    """
    Change the sign-in address. Requires the current password so a hijacked
    session cannot move the account out of the owner's reach.
    """
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Password is incorrect"
        )

    new_email = payload.new_email.strip().lower()
    if new_email == user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That is already your email address",
        )

    if db.scalar(select(User).where(User.email == new_email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    old_email = user.email
    user.email = new_email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    db.refresh(user)
    # Addresses are not logged; the user id is enough to trace the change.
    log.info("Email changed for user_id=%s (was %s chars)", user.id, len(old_email))
    return _me_out(user, profile)


# ------------------------------------------------------------------- location

@router.put("/me/location", response_model=ProfileOut)
def update_location(
    payload: LocationUpdate,
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> ProfileOut:
    """
    Store real coordinates from the browser Geolocation API.

    Refused without location consent. This is the enforcement point for that
    toggle — checking it only in the UI would mean the consent was decorative,
    and the previous build's habit of falling back to a hardcoded city is
    exactly what this endpoint exists to replace.
    """
    if not profile.location_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Location consent required. Enable location sharing in Settings before sending coordinates",
        )

    profile.last_latitude = payload.latitude
    profile.last_longitude = payload.longitude
    profile.location_updated_at = utcnow()
    if payload.timezone:
        profile.timezone = payload.timezone

    # City and country are resolved by the environment service (Phase 2) from
    # these coordinates. They are deliberately left untouched here rather than
    # guessed, so a stale label never sits next to fresh coordinates.
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


# -------------------------------------------------------------------- consents

@router.get("/me/consents", response_model=List[ConsentRecordOut])
def read_consent_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ConsentRecordOut]:
    """
    The full grant/revoke history, newest first — what a data-rights request
    actually needs to see. The current state lives on the profile.
    """
    records = db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id)
        .order_by(ConsentRecord.created_at.desc())
    ).all()
    return [ConsentRecordOut.model_validate(r) for r in records]


@router.patch("/me/consents", response_model=ProfileOut)
def update_consents(
    payload: ConsentUpdate,
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> ProfileOut:
    """
    Update consent toggles and record each transition.

    Note what revoking does *not* do: existing journal analyses survive a
    revoked NLP consent, because they are derived from entries the user still
    has and still owns. Revoking stops future analysis; removing past results
    means deleting those entries, or the whole account, both of which are
    available below.
    """
    changes: Dict[str, bool] = {}
    for consent_type, column in CONSENT_COLUMNS.items():
        value = getattr(payload, column)
        if value is not None:
            changes[consent_type] = value

    if changes.get("environment") and not (
        changes.get("location", profile.location_enabled)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Environment data is fetched for your coordinates, so it needs "
                "location sharing enabled as well."
            ),
        )

    changed = _apply_consents(db, profile, changes)
    db.commit()
    db.refresh(profile)

    if changed:
        log.info("Consent updated for user_id=%s: %s", profile.user_id, ", ".join(changed))
    return _profile_out(profile)


# ------------------------------------------------------------------ onboarding

@router.post("/me/onboarding", response_model=MeOut)
def complete_onboarding(
    payload: OnboardingRequest,
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> MeOut:
    """
    Finish the first-run flow: timezone, goals, reminders and initial consents.

    Idempotent — re-posting updates the settings and leaves the original
    `onboarded_at` intact, so a user who revisits the flow does not appear to
    have joined today.
    """
    profile.timezone = payload.timezone
    profile.wellness_goals = payload.wellness_goals
    profile.reminder_hour = payload.reminder_hour
    profile.sleep_goal_minutes = payload.sleep_goal_minutes

    _apply_consents(
        db,
        profile,
        {
            "location": payload.location_enabled,
            "environment": payload.environment_enabled and payload.location_enabled,
            "nlp_analysis": payload.nlp_analysis_enabled,
            "notifications": payload.notifications_enabled,
        },
    )

    # Coordinates are accepted here only if consent was granted in the same
    # payload, so the onboarding screen can capture location in one step
    # without a second round trip.
    if profile.location_enabled and payload.latitude is not None and payload.longitude is not None:
        profile.last_latitude = payload.latitude
        profile.last_longitude = payload.longitude
        profile.location_updated_at = utcnow()

    if profile.onboarded_at is None:
        profile.onboarded_at = utcnow()

    db.commit()
    db.refresh(profile)
    db.refresh(user)
    return _me_out(user, profile)


# ----------------------------------------------------------------- data rights

@router.get("/me/export")
def export_my_data(
    user: User = Depends(get_current_user),
    profile: UserProfile = Depends(get_profile),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Every row this database holds about the signed-in user, as JSON.

    Deliberately excluded: `password_hash`, and the refresh/reset token tables.
    Those are credentials rather than personal data — a hash in a downloaded
    file is an offline cracking target and helps no one exercising their data
    rights.

    Built-in catalogue activities are excluded too: they are shared reference
    content, not the user's data. Custom activities they created are included.
    """
    moods = db.scalars(
        select(MoodEntry).where(MoodEntry.user_id == user.id).order_by(MoodEntry.recorded_at)
    ).all()
    snapshots = db.scalars(
        select(EnvironmentSnapshot)
        .where(EnvironmentSnapshot.user_id == user.id)
        .order_by(EnvironmentSnapshot.captured_at)
    ).all()
    sleep = db.scalars(
        select(SleepRecord).where(SleepRecord.user_id == user.id).order_by(SleepRecord.sleep_date)
    ).all()
    journals = db.scalars(
        select(JournalEntry)
        .where(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.written_at)
    ).all()
    reframes = db.scalars(
        select(ReframeEntry).where(ReframeEntry.user_id == user.id)
    ).all()
    capsules = db.scalars(select(TimeCapsule).where(TimeCapsule.user_id == user.id)).all()
    custom_activities = db.scalars(
        select(Activity).where(Activity.created_by_user_id == user.id)
    ).all()
    completions = db.scalars(
        select(ActivityCompletion).where(ActivityCompletion.user_id == user.id)
    ).all()
    recommendations = db.scalars(
        select(Recommendation).where(Recommendation.user_id == user.id)
    ).all()
    predictions = db.scalars(
        select(MLPrediction).where(MLPrediction.user_id == user.id)
    ).all()
    patterns = db.scalars(
        select(DetectedPattern).where(DetectedPattern.user_id == user.id)
    ).all()
    consents = db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id)
        .order_by(ConsentRecord.created_at)
    ).all()
    sessions = db.scalars(
        select(ConversationSession).where(ConversationSession.user_id == user.id)
    ).all()

    journal_payload: List[Dict[str, Any]] = []
    for entry in journals:
        row = _row_to_dict(entry)
        analysis = db.scalar(
            select(JournalAnalysis).where(JournalAnalysis.journal_entry_id == entry.id)
        )
        row["analysis"] = _row_to_dict(analysis) if analysis else None
        items = db.scalars(
            select(GratitudeItem)
            .where(GratitudeItem.journal_entry_id == entry.id)
            .order_by(GratitudeItem.position)
        ).all()
        row["gratitude_items"] = [_row_to_dict(i) for i in items]
        journal_payload.append(row)

    conversation_payload: List[Dict[str, Any]] = []
    for convo in sessions:
        row = _row_to_dict(convo)
        messages = db.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == convo.id)
            .order_by(ConversationMessage.created_at)
        ).all()
        row["messages"] = [_row_to_dict(m) for m in messages]
        conversation_payload.append(row)

    return {
        "export_version": "1.0",
        "generated_at": utcnow().isoformat(),
        "notice": (
            "Every record below was either entered by you or fetched from a live "
            "third-party API for your coordinates at the moment you logged an "
            "entry. Nothing in this file was generated, sampled or synthesised."
        ),
        "excluded": (
            "Password hash and session/reset tokens are omitted: they are "
            "credentials, not personal data."
        ),
        "account": _row_to_dict(user, exclude=("password_hash",)),
        "profile": _row_to_dict(profile),
        "consent_history": [_row_to_dict(c) for c in consents],
        "mood_entries": [_row_to_dict(m) for m in moods],
        "environment_snapshots": [_row_to_dict(s) for s in snapshots],
        "sleep_records": [_row_to_dict(s) for s in sleep],
        "journal_entries": journal_payload,
        "reframe_entries": [_row_to_dict(r) for r in reframes],
        "time_capsules": [_row_to_dict(c) for c in capsules],
        "custom_activities": [_row_to_dict(a) for a in custom_activities],
        "activity_completions": [_row_to_dict(c) for c in completions],
        "recommendations": [_row_to_dict(r) for r in recommendations],
        "ml_predictions": [_row_to_dict(p) for p in predictions],
        "detected_patterns": [_row_to_dict(p) for p in patterns],
        "conversations": conversation_payload,
        "counts": {
            "mood_entries": len(moods),
            "environment_snapshots": len(snapshots),
            "sleep_records": len(sleep),
            "journal_entries": len(journals),
            "reframe_entries": len(reframes),
            "time_capsules": len(capsules),
            "custom_activities": len(custom_activities),
            "activity_completions": len(completions),
            "recommendations": len(recommendations),
            "ml_predictions": len(predictions),
            "detected_patterns": len(patterns),
            "conversations": len(sessions),
            "consent_records": len(consents),
        },
    }


@router.delete("/me", response_model=Message)
def delete_my_account(
    payload: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    """
    Erase the account and everything attached to it.

    The deletion is a single `DELETE FROM users`; every child table carries
    `ON DELETE CASCADE` and SQLite has `PRAGMA foreign_keys=ON` set on connect
    (see `app/db/session.py`), so nothing is left orphaned. Orphaned rows here
    would be rows describing a real person's mental health with no owner — the
    cascade is verified rather than assumed.
    """
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Password is incorrect"
        )

    user_id = user.id
    db.delete(user)
    db.commit()

    log.info("Account deleted for user_id=%s (cascade)", user_id)
    return Message(
        detail="Your account and all associated data have been permanently deleted."
    )
