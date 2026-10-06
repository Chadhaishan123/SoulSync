"""User account, profile, consent and token models."""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime, utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.activity import ActivityCompletion, Recommendation
    from app.models.companion import ConversationSession
    from app.models.journal import JournalEntry, ReframeEntry, TimeCapsule
    from app.models.ml import DetectedPattern, MLPrediction
    from app.models.tracking import EnvironmentSnapshot, MoodEntry, SleepRecord


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    # Every child relationship cascades on delete. This is what makes the
    # GDPR "delete my account" endpoint actually erase everything rather than
    # orphaning rows that still describe a real person's mental health.
    profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    consents: Mapped[List["ConsentRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    reset_tokens: Mapped[List["PasswordResetToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    mood_entries: Mapped[List["MoodEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sleep_records: Mapped[List["SleepRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    environment_snapshots: Mapped[List["EnvironmentSnapshot"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[List["JournalEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    reframe_entries: Mapped[List["ReframeEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    time_capsules: Mapped[List["TimeCapsule"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    activity_completions: Mapped[List["ActivityCompletion"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    recommendations: Mapped[List["Recommendation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ml_predictions: Mapped[List["MLPrediction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    detected_patterns: Mapped[List["DetectedPattern"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    conversation_sessions: Mapped[List["ConversationSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r}>"


class UserProfile(Base, TimestampMixin):
    """
    Per-user settings and the last known real location.

    `last_latitude` / `last_longitude` exist so every environment endpoint can
    report weather for where the user *actually is*. The previous
    implementation hardcoded a fallback city even when location consent had
    been granted, which quietly made every "live" weather reading wrong.
    """

    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # IANA timezone name, e.g. "Asia/Kolkata". Sent by the browser.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    wellness_goals: Mapped[List[str]] = mapped_column(JSON, default=list)

    # Feature consents (mirrored in ConsentRecord for an auditable history)
    personalization_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    location_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Separate from location on purpose: a user may be willing to share
    # coordinates for a city label while not wanting weather/AQI readings
    # fetched and stored alongside every check-in. Collapsing the two would
    # make one consent silently authorise the other.
    environment_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    nlp_analysis_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Last real coordinates the browser reported, with consent.
    last_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    last_country_code: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    location_updated_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    # Local hour (0-23) for the daily check-in reminder.
    reminder_hour: Mapped[int] = mapped_column(Integer, default=20)
    # Target sleep in minutes; used for sleep-debt against the user's own goal.
    sleep_goal_minutes: Mapped[int] = mapped_column(Integer, default=480)

    onboarded_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="profile")

    @property
    def has_real_location(self) -> bool:
        return (
            self.location_enabled
            and self.last_latitude is not None
            and self.last_longitude is not None
        )


class ConsentRecord(Base):
    """
    Append-only-ish consent audit trail.

    UserProfile holds the *current* state for fast reads; this table records
    when each consent was granted or revoked, which is what a data-rights
    request actually needs to see.
    """

    __tablename__ = "consent_records"
    __table_args__ = (Index("ix_consent_user_type", "user_id", "consent_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # "location" | "environment" | "nlp_analysis" | "notifications"
    consent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    is_granted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    granted_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    revoked_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="consents")


class RefreshToken(Base):
    """
    A rotated refresh token. Stored as a SHA-256 hash so a database leak
    cannot be replayed as a live session.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False
    )
    revoked_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    # Set when this token is rotated, so a replayed old token is detectable.
    replaced_by_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")

    def is_usable(self, now: Optional[dt.datetime] = None) -> bool:
        # UTCDateTime guarantees `expires_at` is aware UTC on read, so this
        # comparison is safe on SQLite as well as Postgres.
        now = now or utcnow()
        return self.revoked_at is None and self.expires_at > now


class PasswordResetToken(Base):
    """Single-use, time-limited password reset token (stored hashed)."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False
    )
    used_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="reset_tokens")

    def is_usable(self, now: Optional[dt.datetime] = None) -> bool:
        now = now or utcnow()
        return self.used_at is None and self.expires_at > now
