"""Schemas for Digital Therapist (CBT Clinical Assistant)."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessageItem(BaseModel):
    role: str  # "user" | "therapist" | "assistant"
    content: str


class TherapistChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatMessageItem] = Field(default_factory=list)


class TherapistChatResponse(BaseModel):
    reply: str
    distortion_detected: Optional[str] = None
    distortion_advice: Optional[str] = None
    tool_suggestion: Optional[str] = None  # e.g. "box_breathing", "5_4_3_2_1", "thought_record"
    is_crisis: bool = False


class TherapistSummaryRequest(BaseModel):
    history: List[ChatMessageItem] = Field(..., min_length=2)


class TherapistSummaryResponse(BaseModel):
    trigger: str
    primary_distortion: str
    balanced_perspective: str
    homework_exercise: str
