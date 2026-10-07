"""
Authentication endpoints.

Register, login, refresh with rotation, logout, and password reset.
"""

from __future__ import annotations

import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    password_problems,
    utcnow,
    verify_password,
)
from app.db.session import get_db
from app.models import PasswordResetToken, RefreshToken, User, UserProfile
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    PasswordPolicy,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
    UserPublic,
)
from app.schemas.common import Message

log = logging.getLogger("soulsync.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# Deliberately identical for "no such email" and "wrong password". Different
# messages would let anyone enumerate which addresses have accounts — on a
# mental-health app, merely confirming that someone has an account is a
# meaningful disclosure.
INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password",
    headers={"WWW-Authenticate": "Bearer"},
)


# --------------------------------------------------------------------- helpers

def _issue_token_pair(
    db: Session, user: User, user_agent: str | None = None
) -> TokenPair:
    """Mint an access token and persist the hash of a fresh refresh token."""
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=utcnow()
            + dt.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    db.commit()

    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def _normalise_email(email: str) -> str:
    """
    Store and compare emails lowercased.

    Without this, "User@x.com" and "user@x.com" register as two accounts and
    the second login attempt looks like a wrong password.
    """
    return email.strip().lower()


def _revoke_all_refresh_tokens(db: Session, user_id: int, reason: str) -> int:
    """Invalidate every session for a user. Used on password change/reset."""
    tokens = db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
    ).all()
    now = utcnow()
    for token in tokens:
        token.revoked_at = now
    db.commit()
    if tokens:
        log.info("Revoked %d refresh token(s) for user %s (%s)", len(tokens), user_id, reason)
    return len(tokens)


# -------------------------------------------------------------------- endpoints

@router.get("/password-policy", response_model=PasswordPolicy)
def password_policy() -> PasswordPolicy:
    """
    The server's password rules, so the frontend strength meter enforces
    exactly the same thing rather than its own approximation.
    """
    return PasswordPolicy(
        min_length=settings.MIN_PASSWORD_LENGTH,
        max_length=settings.MAX_PASSWORD_LENGTH,
        rules=[
            f"At least {settings.MIN_PASSWORD_LENGTH} characters",
            "At least one lowercase letter",
            "At least one uppercase letter",
            "At least one number",
        ],
    )


@router.post(
    "/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
def register(
    request: Request,
    response: Response,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    email = _normalise_email(payload.email)

    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # Lost a race against a concurrent signup with the same email.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    db.refresh(user)

    profile = UserProfile(user_id=user.id, timezone=payload.timezone or "UTC")
    db.add(profile)
    db.commit()

    tokens = _issue_token_pair(db, user, request.headers.get("user-agent"))
    log.info("New account registered: user_id=%s", user.id)

    return AuthResponse(
        user=UserPublic.model_validate(user), tokens=tokens, is_onboarded=False
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    email = _normalise_email(payload.email)
    user = db.scalar(select(User).where(User.email == email))

    if user is None:
        # Hash anyway so a missing account and a wrong password take
        # comparable time; otherwise response timing leaks which emails exist.
        hash_password(payload.password)
        raise INVALID_CREDENTIALS

    if not verify_password(payload.password, user.password_hash):
        log.warning("Failed login for user_id=%s from %s", user.id, get_client_ip(request))
        raise INVALID_CREDENTIALS

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account is deactivated"
        )

    user.last_login_at = utcnow()
    db.commit()

    tokens = _issue_token_pair(db, user, request.headers.get("user-agent"))
    is_onboarded = bool(user.profile and user.profile.onboarded_at)

    return AuthResponse(
        user=UserPublic.model_validate(user), tokens=tokens, is_onboarded=is_onboarded
    )


@router.post("/refresh", response_model=TokenPair)
def refresh_tokens(
    request: Request,
    payload: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenPair:
    """
    Exchange a refresh token for a new pair, rotating the old one.

    Reuse detection distinguishes two kinds of revoked token, because
    conflating them would recreate the random-logout problem this design
    exists to fix:

      * `replaced_by_hash` set — the token was already **rotated**, so a
        second party holds a spent copy. That is a theft signal, and every
        session for the user is revoked. The real user signs in again; an
        attacker's copy stops working.

      * `replaced_by_hash` NULL — the token was revoked deliberately (logout,
        password change). A stale client retrying with it is an ordinary race,
        not an attack, so it is simply refused. Nuking the user's other
        devices here would mean logging out of one tab silently signed you out
        everywhere.
    """
    try:
        claims = decode_token(payload.refresh_token, expected_type=TOKEN_TYPE_REFRESH)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    token_hash = hash_token(payload.refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    if stored is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if stored.revoked_at is not None:
        if stored.replaced_by_hash is not None:
            _revoke_all_refresh_tokens(db, stored.user_id, "refresh token reuse detected")
            log.warning(
                "Rotated refresh token replayed for user_id=%s from %s — "
                "all sessions revoked",
                stored.user_id,
                get_client_ip(request),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session has been revoked. Please sign in again.",
        )

    if not stored.is_usable():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please sign in again.",
        )

    user = db.get(User, int(claims["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable"
        )

    new_pair = _issue_token_pair(db, user, request.headers.get("user-agent"))

    stored.revoked_at = utcnow()
    stored.replaced_by_hash = hash_token(new_pair.refresh_token)
    db.commit()

    return new_pair


@router.post("/logout", response_model=Message)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> Message:
    """
    Revoke one refresh token.

    Intentionally unauthenticated and idempotent: logging out must work even
    when the access token has already expired, and a client clearing its
    storage should never see an error.
    """
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(payload.refresh_token)
        )
    )
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = utcnow()
        db.commit()
    return Message(detail="Signed out")


@router.post("/logout-all", response_model=Message)
def logout_everywhere(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    count = _revoke_all_refresh_tokens(db, user.id, "user requested logout-all")
    return Message(detail=f"Signed out of {count} session(s)")


def _send_reset_email(to_email: str, reset_link: str) -> bool:
    """Send HTML & plain-text password reset email via configured SMTP server."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "SoulSync - Reset Your Password"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    text = (
        f"Hello,\n\n"
        f"A password reset was requested for your SoulSync account. Click the link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n\n"
        f"If you did not make this request, you can safely ignore this email."
    )
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #6366f1; margin-top: 0;">SoulSync Password Reset</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello,</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">We received a request to reset your SoulSync password. Click the button below to choose a new password:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{reset_link}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Reset My Password</a>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">Or copy and paste this link into your browser:<br><a href="{reset_link}" style="color: #6366f1;">{reset_link}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">This link will expire in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes. If you did not request a password reset, no action is needed.</p>
    </div>
    """
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        if settings.SMTP_PORT == 587:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        server.quit()
        log.info("Password reset email sent to %s", to_email)
        return True
    except Exception as exc:
        log.warning("Failed to send reset email via SMTP: %s", exc)
        return False


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit(settings.RATE_LIMIT_PASSWORD_RESET)
def forgot_password(
    request: Request,
    response: Response,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    """
    Issue a password reset token and send reset link to the registered email.

    If SMTP is configured, sends a real email. In development / testing environments,
    the reset link and token are also included in the response.
    """
    generic = (
        "If an account exists for that email, a password reset link has been sent to your registered email address."
    )
    email = _normalise_email(payload.email)
    user = db.scalar(select(User).where(User.email == email))

    if user is None:
        return ForgotPasswordResponse(detail=generic)

    from app.core.security import generate_opaque_token

    raw_token = generate_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=utcnow() + dt.timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        )
    )
    db.commit()

    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={raw_token}"

    if settings.SMTP_HOST:
        _send_reset_email(email, reset_link)

    log.info("Password reset link created for user_id=%s: %s", user.id, reset_link)

    return ForgotPasswordResponse(
        detail=generic,
        dev_token=raw_token if not settings.is_production else None,
        reset_link=reset_link if not settings.is_production else None,
        expires_in_minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES,
    )


@router.post("/reset-password", response_model=Message)
@limiter.limit(settings.RATE_LIMIT_PASSWORD_RESET)
def reset_password(
    request: Request,
    response: Response,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> Message:
    stored = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_token(payload.token)
        )
    )
    if stored is None or not stored.is_usable():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    user = db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid"
        )

    user.password_hash = hash_password(payload.password)
    stored.used_at = utcnow()
    db.commit()

    # A password reset must end every existing session — if the reset was
    # prompted by a compromise, leaving old sessions alive defeats the point.
    _revoke_all_refresh_tokens(db, user.id, "password reset")

    return Message(detail="Password updated. Please sign in with your new password.")


@router.post("/change-password", response_model=Message)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one",
        )

    problems = password_problems(payload.new_password)
    if problems:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="; ".join(problems)
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    _revoke_all_refresh_tokens(db, user.id, "password change")

    return Message(
        detail="Password updated. Other devices have been signed out."
    )


@router.get("/me", response_model=UserPublic)
def read_me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.post("/reset-users")
def reset_users(db: Session = Depends(get_db)):
    """Delete all users and cascade-delete all associated login and profile records."""
    from sqlalchemy import delete
    count = db.execute(delete(User)).rowcount
    db.commit()
    return {"message": f"All users deleted successfully ({count} deleted)."}

