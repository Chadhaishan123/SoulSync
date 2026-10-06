"""
Password hashing and JWT issuance.

Token design
------------
SoulSync issues a short-lived **access token** (30 min) plus a long-lived
**refresh token** (30 days) that is rotated on every use. This replaces the
common single-7-day-JWT approach, which silently logs users out with no
warning and cannot be revoked.

Refresh and password-reset tokens are stored in the database as SHA-256
hashes, never in plaintext: a database leak must not hand an attacker
usable sessions.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def utcnow() -> dt.datetime:
    """Timezone-aware UTC now. (datetime.utcnow() is deprecated in 3.12+.)"""
    return dt.datetime.now(dt.timezone.utc)


# ------------------------------------------------------------------ passwords

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        # Malformed/legacy hash — treat as a failed login, never a 500.
        return False


def password_problems(password: str) -> list[str]:
    """
    Returns a list of human-readable reasons the password is unacceptable.
    Empty list == acceptable. Used by the register/reset endpoints so the
    frontend strength meter and the server agree on the same rules.
    """
    problems: list[str] = []
    if len(password) < settings.MIN_PASSWORD_LENGTH:
        problems.append(
            f"Must be at least {settings.MIN_PASSWORD_LENGTH} characters long."
        )
    # bcrypt truncates silently past 72 bytes — reject rather than mislead.
    if len(password.encode("utf-8")) > settings.MAX_PASSWORD_LENGTH:
        problems.append(
            f"Must be at most {settings.MAX_PASSWORD_LENGTH} bytes long."
        )
    if not any(c.islower() for c in password):
        problems.append("Must include a lowercase letter.")
    if not any(c.isupper() for c in password):
        problems.append("Must include an uppercase letter.")
    if not any(c.isdigit() for c in password):
        problems.append("Must include a number.")
    return problems


# --------------------------------------------------------------------- tokens

def _create_token(
    subject: str | int,
    token_type: str,
    expires_delta: dt.timedelta,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    now = utcnow()
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        # jti lets a specific token be identified/revoked
        "jti": secrets.token_urlsafe(16),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int | str) -> str:
    return _create_token(
        user_id,
        TOKEN_TYPE_ACCESS,
        dt.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int | str) -> str:
    return _create_token(
        user_id,
        TOKEN_TYPE_REFRESH,
        dt.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Decodes and validates a JWT. Raises JWTError on any problem, including a
    token whose `type` claim does not match `expected_type` — this is what
    stops a refresh token being replayed as an access token.
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if expected_type is not None and payload.get("type") != expected_type:
        raise JWTError(
            f"Expected a {expected_type} token, got {payload.get('type')!r}"
        )
    return payload


# ------------------------------------------------- opaque tokens (DB-persisted)

def generate_opaque_token() -> str:
    """A high-entropy token for password reset links."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """
    SHA-256 for DB storage of refresh/reset tokens.

    bcrypt is deliberately not used here: these tokens are already
    high-entropy random strings (not guessable human passwords), and they are
    verified on hot paths where bcrypt's intentional slowness would hurt.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
