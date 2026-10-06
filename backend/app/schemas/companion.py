"""Pydantic schemas for the AI companion chat."""

from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import Field

from app.schemas.common import ORMModel


class CompanionRequest(ORMModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[int] = None


class CompanionResponse(ORMModel):
    reply: str
    session_id: int
    engine: str = "template"


class SessionOut(ORMModel):
    id: int
    title: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[dt.datetime] = None
    is_archived: bool = False
    created_at: dt.datetime
