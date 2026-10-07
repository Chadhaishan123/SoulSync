"""Pydantic schemas for the insights dashboard and recommendations."""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.common import ORMModel


# ─────────────────────────────────────────── Dashboard


class LatestMetrics(BaseModel):
    mood: int
    stress: Optional[int] = None
    energy: Optional[int] = None
    sleep_quality: Optional[int] = None
    primary_emotion: Optional[str] = None
    recorded_at: Optional[dt.datetime] = None


class WeatherState(BaseModel):
    state: str  # emoji + label, e.g. "☀️ Sunny Outlook"
    forecast: str  # short encouraging sentence
    latest_metrics: Optional[LatestMetrics] = None


class TrendPrediction(BaseModel):
    direction: str  # "improving" | "declining" | "stable"
    confidence: float = 0.0
    explanation: Optional[str] = None
    avg_recent: Optional[float] = None
    avg_prior: Optional[float] = None


class AnomalyInfo(BaseModel):
    is_anomaly: bool = False
    score: Optional[float] = None
    explanation: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[float] = None


class DigitalTwinInfo(BaseModel):
    current_pattern: str = "Balanced"
    total_days: int = 0
    clusters: Dict[str, int] = {}


class DashboardOut(BaseModel):
    weather: Optional[WeatherState] = None
    trend_prediction: Optional[TrendPrediction] = None
    anomaly: Optional[AnomalyInfo] = None
    digital_twin: Optional[DigitalTwinInfo] = None


# ─────────────────────────────────────────── Recommendations


class ActivityInfo(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str
    duration_minutes: Optional[int] = None


class RecommendationOut(ORMModel):
    id: int
    title: str
    reason: Optional[str] = None
    category: Optional[str] = None
    score: float = 0.0
    feedback: Optional[int] = None
    activity: Optional[ActivityInfo] = None
    created_at: dt.datetime


class FeedbackRequest(BaseModel):
    feedback: str


# ─────────────────────────────────────────── Mind Weather Simulator & Twin Chat


class SimulationRequest(BaseModel):
    sleep_hours: float = 7.5
    exercise_minutes: int = 30
    meditation_minutes: int = 15
    outdoor_minutes: int = 20


class SimulationResponse(BaseModel):
    baseline_mood: float
    simulated_mood: float
    mood_delta: float
    predicted_weather: str
    forecast_narrative: str
    anxiety_reduction_pct: float
    recommendations: List[str]


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class TwinChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryItem]] = None


class TwinChatResponse(BaseModel):
    reply: str
    insights_found: List[str] = []
    dominant_pattern: str = "Balanced"
    confidence: float = 0.85
    detected_emotion: Optional[str] = None

