"""Activities, habits, completions and recommendations."""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
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

# Context conditions an activity suits. These are matched against the *live*
# environment reading, which is what turns a static catalogue into a real
# recommendation: high PM2.5 outdoors is a bad suggestion, and we can know
# that from the actual air-quality number rather than guessing.
CONTEXT_HIGH_STRESS = "high_stress"
CONTEXT_LOW_ENERGY = "low_energy"
CONTEXT_LOW_MOOD = "low_mood"
CONTEXT_POOR_SLEEP = "poor_sleep"
CONTEXT_HIGH_AQI = "high_aqi"
CONTEXT_GOOD_AIR = "good_air"
CONTEXT_HIGH_UV = "high_uv"
CONTEXT_CLEAR_WEATHER = "clear_weather"
CONTEXT_RAIN = "rain"
CONTEXT_COLD = "cold"
CONTEXT_HOT = "hot"
CONTEXT_EVENING = "evening"
CONTEXT_MORNING = "morning"
CONTEXT_HOLIDAY = "holiday"
CONTEXT_INDOOR = "indoor"


class Activity(Base, TimestampMixin):
    """
    A wellbeing activity. Built-ins ship as a seeded catalogue (the one thing
    seeded in this project — it is reference content, not fabricated user
    data); users can also add their own, and mark any of them as a habit to
    track daily.
    """

    __tablename__ = "activities"
    __table_args__ = (Index("ix_activity_user_habit", "created_by_user_id", "is_habit"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # "movement" | "mindfulness" | "social" | "rest" | "creative" | "nature"
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contexts: Mapped[List[str]] = mapped_column(JSON, default=list)

    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_habit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # NULL for built-in catalogue rows shared by everyone.
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    completions: Mapped[List["ActivityCompletion"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Activity slug={self.slug!r} category={self.category}>"


class ActivityCompletion(Base):
    """
    A logged completion. `mood_before` / `mood_after` are what let the
    recommendation ranker learn from measured outcomes instead of just
    thumbs-up counts.
    """

    __tablename__ = "activity_completions"
    __table_args__ = (
        Index("ix_completion_user_date", "user_id", "local_date"),
        # One completion per habit per local day, so streaks cannot be gamed by
        # tapping the same habit repeatedly.
        UniqueConstraint(
            "user_id", "activity_id", "local_date", name="uq_completion_user_act_date"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )

    completed_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )
    local_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)

    mood_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mood_after: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="activity_completions")
    activity: Mapped["Activity"] = relationship(back_populates="completions")

    @property
    def mood_delta(self) -> Optional[int]:
        if self.mood_before is None or self.mood_after is None:
            return None
        return self.mood_after - self.mood_before


class Recommendation(Base):
    """
    A recommendation actually served to the user, with the live context that
    produced it.

    Persisting `context` and `score` is what makes the feedback loop real: when
    the user rates a suggestion, we know which conditions and which ranking
    weights led to it, so the next ranking can shift. It is also the audit
    trail for the transparency page.
    """

    __tablename__ = "recommendations"
    __table_args__ = (Index("ix_reco_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    activity_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Human-readable justification, e.g. "PM2.5 is 78 ug/m3 near you right now".
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # The live signals that produced this ranking (aqi, uv, temp, mood, sleep…).
    context: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    shown_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    acted_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    dismissed_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    # +1 thumbs up, -1 thumbs down, NULL not rated.
    feedback: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False, index=True
    )

    user: Mapped["User"] = relationship(back_populates="recommendations")
