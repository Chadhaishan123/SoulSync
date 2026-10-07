"""User profile and consent schemas."""

from __future__ import annotations

import datetime as dt
from typing import List, Optional
from zoneinfo import available_timezones

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel

# Validated once at import; `available_timezones()` walks the tzdata tree.
_VALID_TIMEZONES = available_timezones()

CONSENT_TYPES = (
    "location",
    "environment",
    "nlp_analysis",
    "notifications",
    "personalization",
)


TIMEZONE_ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata",
    "Asia/Saigon": "Asia/Ho_Chi_Minh",
    "Asia/Katmandu": "Asia/Kathmandu",
    "Asia/Rangoon": "Asia/Yangon",
    "Asia/Ulan_Bator": "Asia/Ulaanbaatar",
    "Asia/Thimbu": "Asia/Thimphu",
    "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
    "UTC": "UTC",
    "GMT": "UTC",
}


def validate_timezone(value: str) -> str:
    """
    Validate and normalize IANA timezone names (e.g. Asia/Calcutta -> Asia/Kolkata).
    """
    v = value.strip()
    if v in TIMEZONE_ALIASES:
        v = TIMEZONE_ALIASES[v]
    if v in _VALID_TIMEZONES:
        return v
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(v)
        return v
    except Exception:
        pass
    raise ValueError(
        f"Unknown timezone {value!r}. Expected an IANA name like 'Asia/Kolkata'."
    )


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    timezone: Optional[str] = Field(default=None, max_length=64)
    wellness_goals: Optional[List[str]] = None
    reminder_hour: Optional[int] = Field(default=None, ge=0, le=23)
    sleep_goal_minutes: Optional[int] = Field(default=None, ge=180, le=780)

    @field_validator("timezone")
    @classmethod
    def _check_tz(cls, v: Optional[str]) -> Optional[str]:
        return validate_timezone(v) if v else v

    @field_validator("name")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Name cannot be blank")
        return cleaned

    @field_validator("wellness_goals")
    @classmethod
    def _limit_goals(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        cleaned = [g.strip()[:80] for g in v if g and g.strip()]
        return cleaned[:10]


class EmailUpdate(BaseModel):
    new_email: EmailStr
    # Requiring the current password stops a hijacked session from silently
    # moving the account to an attacker-controlled address.
    current_password: str = Field(min_length=1, max_length=72)


class LocationUpdate(BaseModel):
    """
    Real coordinates from the browser Geolocation API.

    Bounds are enforced because these values are forwarded to Open-Meteo; an
    out-of-range pair would come back as an upstream error rather than a
    useful message.
    """

    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    # Browser-reported accuracy in metres, kept for transparency about how
    # precise the reading behind an environment snapshot actually was.
    accuracy_m: Optional[float] = Field(default=None, ge=0)
    timezone: Optional[str] = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _check_tz(cls, v: Optional[str]) -> Optional[str]:
        return validate_timezone(v) if v else v


class ConsentUpdate(BaseModel):
    location_enabled: Optional[bool] = None
    environment_enabled: Optional[bool] = None
    nlp_analysis_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    personalization_enabled: Optional[bool] = None


class ConsentRecordOut(ORMModel):
    consent_type: str
    is_granted: bool
    granted_at: Optional[dt.datetime] = None
    revoked_at: Optional[dt.datetime] = None
    created_at: dt.datetime


class ProfileOut(ORMModel):
    timezone: str
    wellness_goals: List[str] = []
    personalization_enabled: bool
    location_enabled: bool
    environment_enabled: bool
    nlp_analysis_enabled: bool
    notifications_enabled: bool
    reminder_hour: int
    sleep_goal_minutes: int
    last_city: Optional[str] = None
    last_country_code: Optional[str] = None
    last_latitude: Optional[float] = None
    last_longitude: Optional[float] = None
    location_updated_at: Optional[dt.datetime] = None
    onboarded_at: Optional[dt.datetime] = None
    has_real_location: bool = False


class MeOut(BaseModel):
    """Everything the client needs about the signed-in user in one call."""

    id: int
    name: str
    email: EmailStr
    created_at: dt.datetime
    last_login_at: Optional[dt.datetime] = None
    profile: ProfileOut
    is_onboarded: bool


class OnboardingRequest(BaseModel):
    """Completes the 3-step first-run flow."""

    timezone: str = Field(max_length=64)
    wellness_goals: List[str] = Field(default_factory=list)
    reminder_hour: int = Field(default=20, ge=0, le=23)
    sleep_goal_minutes: int = Field(default=480, ge=180, le=780)
    location_enabled: bool = False
    environment_enabled: bool = False
    nlp_analysis_enabled: bool = True
    notifications_enabled: bool = False
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)

    @field_validator("timezone")
    @classmethod
    def _check_tz(cls, v: str) -> str:
        return validate_timezone(v)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=72)
    # Typed confirmation, because this cascades across every table and cannot
    # be undone.
    confirm: str

    @field_validator("confirm")
    @classmethod
    def _must_confirm(cls, v: str) -> str:
        if v.strip().upper() != "DELETE":
            raise ValueError("Type DELETE to confirm account deletion")
        return v
