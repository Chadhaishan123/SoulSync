"""Digital Therapist (CBT Clinical Mode) API router."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.therapist import (
    TherapistChatRequest,
    TherapistChatResponse,
    TherapistSummaryRequest,
    TherapistSummaryResponse,
)
from app.services.therapist_ai import (
    generate_therapist_reply,
    generate_clinical_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/therapist", tags=["therapist"])


@router.post("/chat", response_model=TherapistChatResponse)
def therapist_chat(
    payload: TherapistChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TherapistChatResponse:
    """Multi-turn CBT Clinical dialogue with real-time distortion detection."""
    return generate_therapist_reply(
        message=payload.message,
        history=payload.history,
    )


@router.post("/summary", response_model=TherapistSummaryResponse)
def therapist_session_summary(
    payload: TherapistSummaryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TherapistSummaryResponse:
    """Summarize the therapy session into trigger, distortion, balanced belief, and homework."""
    return generate_clinical_summary(history=payload.history)
