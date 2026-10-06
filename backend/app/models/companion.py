"""Companion conversation persistence."""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
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

ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"

# Which engine produced an assistant turn. Recorded per message because the
# companion degrades gracefully: while FLAN-T5 weights are still downloading it
# answers from grounded templates, and the UI should be able to say which.
ENGINE_LOCAL_LLM = "local_llm"
ENGINE_TEMPLATE = "template"
ENGINE_SAFETY = "safety"

# Intents the router recognises.
INTENT_REFLECT = "reflect"
INTENT_DATA_QUESTION = "data_question"
INTENT_RECOMMENDATION = "recommendation"
INTENT_GREETING = "greeting"
INTENT_CRISIS = "crisis"
INTENT_SMALLTALK = "smalltalk"


class ConversationSession(Base, TimestampMixin):
    """A conversation thread. Memory is per-session, persisted, and the user's."""

    __tablename__ = "conversation_sessions"
    __table_args__ = (Index("ix_convo_user_updated", "user_id", "updated_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Derived from the first user message; never model-invented prose.
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_message_at: Mapped[Optional[dt.datetime]] = mapped_column(
        UTCDateTime, nullable=True
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="conversation_sessions")
    messages: Mapped[List["ConversationMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )


class ConversationMessage(Base):
    """
    One turn.

    `grounding` holds the real facts retrieved from the user's own rows and the
    live environment that were placed in the model's context — the retrieved
    check-in averages, journal themes, sleep figures and weather readings. It
    is stored so any claim in a reply can be traced back to the data that
    supports it, and so the UI can show "based on your last 14 check-ins".
    """

    __tablename__ = "conversation_messages"
    __table_args__ = (Index("ix_msg_session_created", "session_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="CASCADE"), index=True
    )

    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Set on user turns by the intent classifier.
    intent: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    intent_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Crisis assessment level for this turn ("none" | "elevated" | "critical").
    safety_level: Mapped[str] = mapped_column(
        String(20), default="none", nullable=False
    )

    # Set on assistant turns.
    engine: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    grounding: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    generation_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False, index=True
    )

    session: Mapped["ConversationSession"] = relationship(back_populates="messages")
