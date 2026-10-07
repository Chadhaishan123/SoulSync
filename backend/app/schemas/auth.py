"""Authentication schemas."""

from __future__ import annotations

import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings
from app.core.security import password_problems
from app.schemas.common import ORMModel


class _PasswordField(BaseModel):
    """
    Shared password validation.

    The same rule set is exported to the frontend strength meter via
    /auth/password-policy, so the client and server can never disagree about
    what counts as acceptable — a mismatch there means a user watches the meter
    turn green and then gets a 422.
    """

    password: str = Field(
        min_length=settings.MIN_PASSWORD_LENGTH,
        max_length=settings.MAX_PASSWORD_LENGTH,
    )

    @field_validator("password")
    @classmethod
    def _check_strength(cls, v: str) -> str:
        problems = password_problems(v)
        if problems:
            raise ValueError("; ".join(problems))
        return v


class RegisterRequest(_PasswordField):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    # IANA timezone from the browser, e.g. "Asia/Kolkata". Captured at signup
    # so streaks and "today" are correct from the very first check-in.
    timezone: Optional[str] = Field(default=None, max_length=64)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Name cannot be blank")
        return cleaned


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=settings.MAX_PASSWORD_LENGTH)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Seconds until the access token expires. The frontend uses this to refresh
    # proactively instead of waiting for a 401, which is what made the previous
    # build appear to log users out at random.
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """
    Always reports the same message regardless of whether the email exists —
    otherwise this endpoint becomes an account enumeration oracle.
    """

    detail: str
    dev_token: Optional[str] = None
    reset_link: Optional[str] = None
    expires_in_minutes: Optional[int] = None


class ResetPasswordRequest(_PasswordField):
    token: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=settings.MAX_PASSWORD_LENGTH)
    new_password: str = Field(
        min_length=settings.MIN_PASSWORD_LENGTH,
        max_length=settings.MAX_PASSWORD_LENGTH,
    )

    @field_validator("new_password")
    @classmethod
    def _check_strength(cls, v: str) -> str:
        problems = password_problems(v)
        if problems:
            raise ValueError("; ".join(problems))
        return v


class PasswordPolicy(BaseModel):
    """Served to the frontend so the strength meter mirrors the server rules."""

    min_length: int
    max_length: int
    requires_lowercase: bool = True
    requires_uppercase: bool = True
    requires_digit: bool = True
    rules: List[str]


class UserPublic(ORMModel):
    id: int
    name: str
    email: EmailStr
    is_active: bool
    created_at: dt.datetime
    last_login_at: Optional[dt.datetime] = None


class AuthResponse(BaseModel):
    """Returned by register and login: the tokens plus who you are."""

    user: UserPublic
    tokens: TokenPair
    # False until onboarding is finished, so the client can route correctly on
    # first login without an extra round trip.
    is_onboarded: bool = False
