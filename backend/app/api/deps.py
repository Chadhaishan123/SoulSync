"""
Shared FastAPI dependencies.

`get_current_user` is the only place a request is turned into a User. Every
protected route depends on it, so authorisation logic has exactly one home.
"""

from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.db.session import get_db
from app.models import User, UserProfile

# auto_error=False so a missing header produces our own 401 with a
# WWW-Authenticate hint, rather than FastAPI's terser default.
_bearer = HTTPBearer(auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_token(credentials.credentials, expected_type=TOKEN_TYPE_ACCESS)
    except JWTError:
        # Covers expired, tampered, wrong-type and malformed tokens alike. The
        # client cannot distinguish them, which is intentional; the frontend
        # reacts to 401 by attempting a refresh once, then routing to login.
        raise CREDENTIALS_EXCEPTION

    subject = payload.get("sub")
    if not subject:
        raise CREDENTIALS_EXCEPTION

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise CREDENTIALS_EXCEPTION

    user = db.get(User, user_id)
    if user is None:
        # Token is validly signed but the account is gone (deleted). Treat as
        # unauthenticated so a deleted user's outstanding tokens stop working
        # immediately, without waiting for expiry.
        raise CREDENTIALS_EXCEPTION
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account is deactivated"
        )
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    For endpoints that personalise when signed in but still work when not
    (the crisis-resources page, for example, must never require a login).
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None


def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    """
    The user's profile, created on demand.

    Accounts predating a profile column, or created through a path that skipped
    profile creation, would otherwise 500 on every settings read. Creating it
    lazily keeps that from being a failure mode.
    """
    if user.profile is not None:
        return user.profile

    profile = UserProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_client_ip(request: Request) -> str:
    """
    Best-effort client IP for audit logging.

    X-Forwarded-For is only trustworthy behind a proxy that sets it; it is used
    here for logging only, never for an access decision.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def user_timezone(profile: UserProfile) -> str:
    return profile.timezone or "UTC"


def local_date_for(profile: UserProfile, moment: Optional[dt.datetime] = None) -> dt.date:
    """
    The user's local calendar date for a UTC instant.

    Every streak, "today" lookup and daily aggregate goes through this. Doing
    it in UTC instead would shift the day boundary for anyone not on UTC and
    quietly break their streaks.
    """
    from zoneinfo import ZoneInfo

    moment = moment or dt.datetime.now(dt.timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=dt.timezone.utc)
    try:
        tz = ZoneInfo(user_timezone(profile))
    except Exception:
        tz = dt.timezone.utc
    return moment.astimezone(tz).date()
