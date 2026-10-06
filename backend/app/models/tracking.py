"""Daily tracking: mood check-ins, sleep records, and live environment snapshots."""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime, utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User

# Where a metric came from. Everything today is "self_report"; wearable
# integrations (Google Fit, Fitbit, Apple Health) will write "device" once real
# OAuth is wired up. The column exists now so those rows slot in without a
# migration — and so no chart ever has to guess whether a number was measured
# or typed.
SOURCE_SELF_REPORT = "self_report"
SOURCE_DEVICE = "device"

ENTRY_KIND_FULL = "full"
ENTRY_KIND_QUICK = "quick"


class MoodEntry(Base, TimestampMixin):
    """
    One check-in. The atomic unit of SoulSync — every model, score, streak and
    correlation is computed from these rows and nothing else.
    """

    __tablename__ = "mood_entries"
    __table_args__ = (
        Index("ix_mood_user_recorded", "user_id", "recorded_at"),
        Index("ix_mood_user_localdate", "user_id", "local_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # 1-10 self-report scales. Validated in the schema layer, not here, so the
    # DB stays permissive if the product later widens a scale.
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    stress_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    energy_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sleep_quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    primary_emotion: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    context_tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    recorded_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )
    # The user's *local* calendar date, computed from their IANA timezone at
    # write time. Streaks and "today" comparisons must use this: a 11pm IST
    # check-in is 17:30 UTC the same day, but a 1am IST one is the previous
    # UTC day, and a streak computed in UTC would break for no reason.
    local_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)

    entry_kind: Mapped[str] = mapped_column(
        String(16), default=ENTRY_KIND_FULL, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(20), default=SOURCE_SELF_REPORT, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="mood_entries")
    environment_snapshot: Mapped[Optional["EnvironmentSnapshot"]] = relationship(
        back_populates="mood_entry",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MoodEntry id={self.id} mood={self.mood_score} on={self.local_date}>"


class SleepRecord(Base, TimestampMixin):
    """A night of sleep. `duration_minutes` is derived, never asked for."""

    __tablename__ = "sleep_records"
    __table_args__ = (
        # One record per night per user. The date is the *wake* date, which is
        # how people naturally describe a night ("I slept badly last night").
        UniqueConstraint("user_id", "sleep_date", name="uq_sleep_user_date"),
        Index("ix_sleep_user_date", "user_id", "sleep_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    sleep_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    bedtime: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False
    )
    wake_time: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-10
    awakenings: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Local clock minutes-since-midnight for bedtime, used for the bedtime
    # standard deviation behind the consistency score. Storing it avoids
    # re-deriving local time from UTC on every read.
    bedtime_local_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    source: Mapped[str] = mapped_column(
        String(20), default=SOURCE_SELF_REPORT, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="sleep_records")

    @property
    def duration_hours(self) -> float:
        return round(self.duration_minutes / 60.0, 2)


class EnvironmentSnapshot(Base):
    """
    A live reading from Open-Meteo (weather + air quality + astronomy), stored
    at the moment of a check-in.

    `mood_entry_id` is the important column: it is what makes
    "does PM2.5 affect my mood?" answerable. Without the join, environment
    data is decoration. Every field here is a real measurement fetched for the
    user's actual coordinates — nothing is estimated or filled in.
    """

    __tablename__ = "environment_snapshots"
    __table_args__ = (Index("ix_env_user_captured", "user_id", "captured_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    mood_entry_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mood_entries.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
        index=True,
    )

    captured_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )

    # Real coordinates this reading is for.
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Weather
    temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    apparent_temperature_c: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    humidity_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pressure_hpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cloud_cover_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    precipitation_mm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weather_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Air quality
    pm2_5: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pm10: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ozone: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    nitrogen_dioxide: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sulphur_dioxide: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    carbon_monoxide: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    us_aqi: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    european_aqi: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uv_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pollen_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Astronomy / daylight — the circadian context for sleep insights.
    sunrise: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    sunset: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    daylight_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Calendar context from Nager.Date.
    is_holiday: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    holiday_name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)

    # Which upstream produced this, so the transparency page can attribute it.
    provider: Mapped[str] = mapped_column(
        String(60), default="open-meteo", nullable=False
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="environment_snapshots")
    mood_entry: Mapped[Optional["MoodEntry"]] = relationship(
        back_populates="environment_snapshot"
    )
