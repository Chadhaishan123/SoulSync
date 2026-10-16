"""Pydantic schemas for journal entries, NLP analysis, AI prompts, and CBT reframing."""

from __future__ import annotations

import datetime as dt
from typing import Dict, List, Optional
from pydantic import Field

from app.schemas.common import ORMModel


class JournalCreate(ORMModel):
    content: str = Field(..., min_length=1, max_length=20_000)
    title: Optional[str] = Field(None, max_length=200)
    kind: str = Field(default="reflection", pattern="^(reflection|gratitude|reframe)$")


class AnalysisOut(ORMModel):
    id: int
    sentiment_score: float
    sentiment_label: str
    sentiment_confidence: Optional[float] = None
    emotions: Dict[str, float] = {}
    dominant_emotion: Optional[str] = None
    dominant_emotion_score: Optional[float] = None
    keywords: List[str] = []
    themes: List[str] = []
    summary: Optional[str] = None
    safety_level: str = "none"
    engine: str = "lexicon"
    model_version: Optional[str] = None
    processing_ms: Optional[int] = None
    analyzed_at: dt.datetime


class JournalOut(ORMModel):
    id: int
    user_id: int
    title: Optional[str] = None
    content: str
    kind: str
    word_count: int
    written_at: dt.datetime
    local_date: dt.date
    was_dictated: bool = False
    analysis: Optional[AnalysisOut] = None
    created_at: dt.datetime


class PromptResponse(ORMModel):
    prompt: str
    category: str


class ReframeRequest(ORMModel):
    thought: str = Field(..., min_length=3, max_length=1000)


class ReframeResponse(ORMModel):
    original_thought: str
    distortion: str
    explanation: str
    balanced_perspective: str
    actionable_affirmation: str
