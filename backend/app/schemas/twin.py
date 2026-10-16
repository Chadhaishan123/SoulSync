"""Schemas for SoulSync Digital Twin: Simulation, Vector Memory, Biometrics, and Avatar."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


# ── 1. "What-If" Behavioral Scenario Simulator ──
class SimulationRequest(BaseModel):
    scenario: str = Field(..., min_length=3, max_length=500, description="Hypothetical lifestyle or emotional scenario to test")


class SimulationResponse(BaseModel):
    scenario: str
    projected_mood_delta: float
    projected_stress_delta: float
    energy_trajectory: str  # "Surge" | "Steady" | "Depletion" | "Crash"
    narrative: str
    countermeasure: str
    confidence: float = 0.88


# ── 2. Vector Semantic Memory Bank (Pinecone) ──
class MemoryItem(BaseModel):
    id: str
    date: str
    topic: str
    summary: str
    emotional_resonance: str
    relevance_score: float = 0.9


class MemoryQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=300)


class MemoryResponse(BaseModel):
    engine: str  # "pinecone" | "semantic_tfidf"
    total_memories: int
    memories: List[MemoryItem]


# ── 3. Wearable Biometrics (Terra / Health Connect) ──
class BiometricsResponse(BaseModel):
    connected: bool = False
    provider: str = "Simulated Wearable Feed"
    resting_heart_rate: int = 66
    hrv_ms: int = 58
    recovery_score: int = 84
    deep_sleep_pct: int = 22
    steps_today: int = 7450
    vagal_tone_status: str = "Optimal Parasympathetic Balance"


class BiometricsSyncRequest(BaseModel):
    provider: Optional[str] = "apple_health"
    resting_heart_rate: Optional[int] = None
    hrv_ms: Optional[int] = None
    steps: Optional[int] = None


# ── 4. 3D Avatar (Ready Player Me) ──
class AvatarUpdateRequest(BaseModel):
    avatar_url: str = Field(..., max_length=500)


class AvatarResponse(BaseModel):
    avatar_url: Optional[str] = None
    aura_style: str = "living_orb"
    current_pattern: str = "Balanced"
