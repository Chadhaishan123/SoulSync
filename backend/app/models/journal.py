"""Journal, NLP analysis, gratitude, cognitive reframing and time capsules."""

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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime, utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User

# A journal row serves three surfaces; `kind` keeps them queryable apart while
# sharing one NLP pipeline and one search index.
KIND_REFLECTION = "reflection"
KIND_GRATITUDE = "gratitude"
KIND_REFRAME = "reframe"

# Which engine produced an analysis. This is surfaced on the Model
# Transparency page — the previous build silently fell back to keyword
# matching and still presented the result as DistilBERT output.
ENGINE_TRANSFORMER = "transformer"
ENGINE_LEXICON = "lexicon"


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_journal_user_written", "user_id", "written_at"),
        Index("ix_journal_user_kind", "user_id", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(
        String(20), default=KIND_REFLECTION, nullable=False
    )
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    written_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, nullable=False, index=True
    )
    local_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)

    # True when dictated through the Web Speech API rather than typed.
    was_dictated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="journal_entries")
    analysis: Mapped[Optional["JournalAnalysis"]] = relationship(
        back_populates="entry", uselist=False, cascade="all, delete-orphan"
    )
    gratitude_items: Mapped[List["GratitudeItem"]] = relationship(
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="GratitudeItem.position",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<JournalEntry id={self.id} kind={self.kind} words={self.word_count}>"


class JournalAnalysis(Base):
    """
    The NLP output for one entry.

    `engine` and `model_version` are stored, not assumed. If transformers were
    unavailable and the lexicon scorer ran instead, the row says so and the UI
    labels it honestly rather than claiming a DistilBERT result.
    """

    __tablename__ = "journal_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    # Continuous -1.0 (negative) .. +1.0 (positive)
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sentiment_label: Mapped[str] = mapped_column(
        String(20), default="neutral", nullable=False
    )
    sentiment_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Full probability distribution, e.g. {"joy": 0.62, "sadness": 0.11, ...}
    emotions: Mapped[Dict[str, float]] = mapped_column(JSON, default=dict)
    dominant_emotion: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    dominant_emotion_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )

    # TF-IDF ranked terms and mapped wellbeing themes.
    keywords: Mapped[List[str]] = mapped_column(JSON, default=list)
    themes: Mapped[List[str]] = mapped_column(JSON, default=list)
    # TextRank extractive summary (sentences pulled from the entry itself, so
    # nothing in it is generated text).
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Crisis assessment result recorded for auditability.
    safety_level: Mapped[str] = mapped_column(
        String(20), default="none", nullable=False
    )

    engine: Mapped[str] = mapped_column(
        String(20), default=ENGINE_LEXICON, nullable=False
    )
    model_version: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    processing_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    analyzed_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    entry: Mapped["JournalEntry"] = relationship(back_populates="analysis")


class GratitudeItem(Base):
    """
    One line of a gratitude entry. Split out from the journal text so the
    Gratitude Wall can render individual notes as tiles and so each line can
    be scored on its own.
    """

    __tablename__ = "gratitude_items"
    __table_args__ = (Index("ix_gratitude_entry_pos", "journal_entry_id", "position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    journal_entry_id: Mapped[int] = mapped_column(
        ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )

    entry: Mapped["JournalEntry"] = relationship(back_populates="gratitude_items")


class ReframeEntry(Base, TimestampMixin):
    """
    A CBT-style thought record. Both sides are the user's own words; NLP only
    helps surface the automatic thought and suggest which distortion pattern it
    resembles. `mood_before` / `mood_after` make the exercise measurable.
    """

    __tablename__ = "reframe_entries"
    __table_args__ = (Index("ix_reframe_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    situation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    automatic_thought: Mapped[str] = mapped_column(Text, nullable=False)
    # Detected pattern label, e.g. "all_or_nothing", "catastrophising".
    distortion_type: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    distortion_confidence: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    evidence_for: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_against: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    balanced_thought: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    mood_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mood_after: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="reframe_entries")

    @property
    def mood_delta(self) -> Optional[int]:
        if self.mood_before is None or self.mood_after is None:
            return None
        return self.mood_after - self.mood_before


class TimeCapsule(Base, TimestampMixin):
    """A message to your future self, locked until `unlock_date`."""

    __tablename__ = "time_capsules"
    __table_args__ = (Index("ix_capsule_user_unlock", "user_id", "unlock_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)
    unlock_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    opened_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )

    # Snapshot of how the user was doing when they wrote it, so opening the
    # capsule can show real then-vs-now numbers.
    mood_at_write: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    context_at_write: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    user: Mapped["User"] = relationship(back_populates="time_capsules")

    def is_unlocked(self, today: Optional[dt.date] = None) -> bool:
        today = today or dt.date.today()
        return today >= self.unlock_date
