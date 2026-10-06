"""Pydantic schemas for mood check-ins and sleep records."""

from __future__ import annotations

import datetime as dt
from typing import List, Optional

from pydantic import Field

from app.schemas.common import ORMModel


# ─────────────────────────────────────────── Check-ins


class CheckinCreate(ORMModel):
    mood_score: int = Field(..., ge=1, le=10, description="Overall mood (1=worst, 10=best)")
    stress_level: Optional[int] = Field(None, ge=0, le=10)
    energy_level: Optional[int] = Field(None, ge=0, le=10)
    sleep_quality: Optional[int] = Field(None, ge=0, le=10)
    primary_emotion: Optional[str] = Field(None, max_length=40)
    context_tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = Field(None, max_length=2000)


class CheckinOut(ORMModel):
    id: int
    user_id: int
    mood_score: int
    stress_level: Optional[int] = None
    energy_level: Optional[int] = None
    sleep_quality: Optional[int] = None
    primary_emotion: Optional[str] = None
    context_tags: List[str] = []
    note: Optional[str] = None
    recorded_at: dt.datetime
    local_date: dt.date
    entry_kind: str = "full"
    source: str = "self_report"
    created_at: dt.datetime


# ─────────────────────────────────────────── Sleep


class SleepCreate(ORMModel):
    sleep_date: dt.date
    duration_minutes: int = Field(..., ge=0, le=1440, description="Total sleep in minutes")
    quality_rating: Optional[int] = Field(None, ge=1, le=5)


class SleepOut(ORMModel):
    id: int
    user_id: int
    sleep_date: dt.date
    bedtime: dt.datetime
    wake_time: dt.datetime
    duration_minutes: int
    quality: Optional[int] = None
    note: Optional[str] = None
    source: str = "self_report"
    created_at: dt.datetime
