"""AI companion chat endpoints — ML-grounded."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import utcnow
from app.db.session import get_db
from app.models import (
    ConversationMessage,
    ConversationSession,
    MoodEntry,
    User,
)
from app.models.companion import ROLE_ASSISTANT, ROLE_USER
from app.schemas.companion import CompanionRequest, CompanionResponse, MessageOut, SessionOut
from app.services.companion import generate_response
from app.services.ml import cluster_user, detect_anomalies, predict_trend

log = logging.getLogger("soulsync.companion")

router = APIRouter(prefix="/users", tags=["companion"])


@router.post("/me/companion", response_model=CompanionResponse)
def send_message(
    payload: CompanionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompanionResponse:
    """
    Send a message to the companion. Creates a session if none specified.
    Response is grounded in the user's real data and ML insights.
    """
    now = utcnow()

    # Get or create session
    session = None
    if payload.session_id:
        session = db.scalar(
            select(ConversationSession).where(
                ConversationSession.id == payload.session_id,
                ConversationSession.user_id == user.id,
            )
        )
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

    if session is None:
        title = payload.message[:80].strip()
        if len(payload.message) > 80:
            title += "..."
        session = ConversationSession(
            user_id=user.id,
            title=title,
            message_count=0,
        )
        db.add(session)
        db.flush()

    # Save user message
    user_msg = ConversationMessage(
        session_id=session.id,
        role=ROLE_USER,
        content=payload.message,
        created_at=now,
    )
    db.add(user_msg)

    # Fetch recent entries for grounding
    entries = list(
        db.scalars(
            select(MoodEntry)
            .where(MoodEntry.user_id == user.id)
            .order_by(MoodEntry.recorded_at.desc())
            .limit(30)
        ).all()
    )

    ml_trend = predict_trend(entries) if entries else None
    ml_anomaly = detect_anomalies(entries) if entries else None
    ml_cluster = cluster_user(entries) if entries else None

    # Fetch recent messages in this session for conversational context
    recent_history = list(
        db.scalars(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session.id)
            .order_by(ConversationMessage.created_at.desc())
            .limit(10)
        ).all()
    )
    recent_history.reverse()

    # Generate response
    result = generate_response(
        user_message=payload.message,
        entries=entries,
        ml_trend=ml_trend,
        ml_cluster=ml_cluster,
        ml_anomaly=ml_anomaly,
        conversation_history=recent_history,
    )

    # Save assistant reply
    assistant_msg = ConversationMessage(
        session_id=session.id,
        role=ROLE_ASSISTANT,
        content=result["reply"],
        engine=result["engine"],
        safety_level=result["safety"].get("level", "none"),
        grounding={
            "entry_count": len(entries),
            "trend": ml_trend.get("direction") if ml_trend else None,
            "cluster": ml_cluster.get("current_pattern") if ml_cluster else None,
        },
        created_at=now,
    )
    db.add(assistant_msg)

    # Update session
    session.message_count += 2
    session.last_message_at = now

    db.commit()
    db.refresh(session)

    log.info("Companion reply session_id=%s engine=%s", session.id, result["engine"])

    return CompanionResponse(
        reply=result["reply"],
        session_id=session.id,
        engine=result["engine"],
    )


@router.get("/me/companion/sessions", response_model=List[SessionOut])
def list_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SessionOut]:
    """List conversation sessions, newest first."""
    sessions = db.scalars(
        select(ConversationSession)
        .where(ConversationSession.user_id == user.id)
        .order_by(ConversationSession.updated_at.desc())
        .limit(20)
    ).all()
    return [SessionOut.model_validate(s) for s in sessions]


@router.get("/me/companion/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_session_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[MessageOut]:
    """Retrieve all messages in a conversation session, chronologically."""
    session = db.scalar(
        select(ConversationSession).where(
            ConversationSession.id == session_id,
            ConversationSession.user_id == user.id,
        )
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages = db.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session.id)
        .order_by(ConversationMessage.created_at.asc())
    ).all()
    return [MessageOut.model_validate(m) for m in messages]
