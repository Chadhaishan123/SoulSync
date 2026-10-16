"""
Digital Twin Behavioral & Mental State Scenario Simulator.
Uses Gemini / Groq with grounded behavioral cluster context to forecast
how hypothetical lifestyle decisions impact mood, stress, and somatic energy.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
import httpx

from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.tracking import MoodEntry, SleepRecord
from app.schemas.twin import SimulationResponse

log = logging.getLogger("soulsync.twin.simulator")


def simulate_scenario(
    scenario: str,
    current_pattern: str = "Balanced",
    recent_mood: float = 7.0,
    recent_stress: float = 4.0,
    recent_sleep: float = 7.5,
    db: Optional[Session] = None,
    user: Optional[Any] = None,
) -> SimulationResponse:
    """Run an LLM-driven behavioral forecast of a hypothetical scenario."""
    if db is not None and user is not None:
        recent_m = db.query(MoodEntry).filter(MoodEntry.user_id == user.id).order_by(MoodEntry.recorded_at.desc()).first()
        recent_s = db.query(SleepRecord).filter(SleepRecord.user_id == user.id).order_by(SleepRecord.recorded_at.desc()).first()
        if recent_m:
            recent_mood = float(recent_m.mood_score or 7.0)
            recent_stress = float(recent_m.stress_level or 4.0)
        if recent_s:
            recent_sleep = float(recent_s.duration_hours or 7.5)
    # Build prompt
    prompt = (
        f"You are the SoulSync Digital Twin Simulation Engine. "
        f"The user has an active behavioral profile of '{current_pattern}', with recent baseline mood of {recent_mood}/10, "
        f"stress of {recent_stress}/10, and sleep quality of {recent_sleep}/10.\n\n"
        f"Hypothetical Scenario to test: \"{scenario}\"\n\n"
        f"Provide a realistic psychological and somatic forecast. Respond ONLY in valid JSON matching this schema:\n"
        "{\n"
        '  "projected_mood_delta": <float between -3.0 and +3.0>,\n'
        '  "projected_stress_delta": <float between -3.0 and +3.0>,\n'
        '  "energy_trajectory": <"Surge" | "Steady" | "Depletion" | "Crash">,\n'
        '  "narrative": <1-2 sentences on how their nervous system and psychological archetype react>,\n'
        '  "countermeasure": <1 actionable recommendation or buffer to mitigate the downside or maximize the benefit>\n'
        "}"
    )

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            url = f"{settings.GEMINI_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    # Clean markdown codeblocks if returned
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    parsed = json.loads(text)
                    return SimulationResponse(
                        scenario=scenario,
                        projected_mood_delta=float(parsed.get("projected_mood_delta", 0.0)),
                        projected_stress_delta=float(parsed.get("projected_stress_delta", 0.0)),
                        energy_trajectory=parsed.get("energy_trajectory", "Steady"),
                        narrative=parsed.get("narrative", "Simulated lifestyle outcome based on your behavioral profile."),
                        countermeasure=parsed.get("countermeasure", "Maintain consistent hydration and sleep cadence."),
                        confidence=0.91,
                    )
        except Exception as exc:
            log.warning("Gemini scenario simulation failed, trying Groq: %s", exc)

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a behavioral simulation engine. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 400,
                "response_format": {"type": "json_object"},
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(settings.GROQ_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    text = res.json()["choices"][0]["message"]["content"].strip()
                    parsed = json.loads(text)
                    return SimulationResponse(
                        scenario=scenario,
                        projected_mood_delta=float(parsed.get("projected_mood_delta", 0.0)),
                        projected_stress_delta=float(parsed.get("projected_stress_delta", 0.0)),
                        energy_trajectory=parsed.get("energy_trajectory", "Steady"),
                        narrative=parsed.get("narrative", "Simulated lifestyle outcome based on your behavioral profile."),
                        countermeasure=parsed.get("countermeasure", "Maintain consistent hydration and sleep cadence."),
                        confidence=0.89,
                    )
        except Exception as exc:
            log.warning("Groq scenario simulation failed: %s", exc)

    # 3. Heuristic Rule-Based Fallback
    sc_low = scenario.lower()
    if any(k in sc_low for k in ["sleep less", "stay up", "all-nighter", "overtime", "skip sleep"]):
        return SimulationResponse(
            scenario=scenario,
            projected_mood_delta=-1.4,
            projected_stress_delta=+2.1,
            energy_trajectory="Crash",
            narrative=f"Under your '{current_pattern}' profile, restricting sleep spikes morning cortisol and reduces emotional frustration tolerance by ~35%.",
            countermeasure="Keep a 20-minute restorative nap buffer between 1 PM and 3 PM, and delay caffeine until 90 minutes after waking.",
            confidence=0.85,
        )
    elif any(k in sc_low for k in ["walk", "exercise", "run", "nature", "workout", "gym"]):
        return SimulationResponse(
            scenario=scenario,
            projected_mood_delta=+1.5,
            projected_stress_delta=-1.8,
            energy_trajectory="Surge",
            narrative="Physical movement in nature resets sympathetic tone, triggering sustained dopamine and endorphin synthesis for 4+ hours.",
            countermeasure="Pair your walk with sunlight exposure to entrain your circadian melatonin rhythm for better sleep tonight.",
            confidence=0.88,
        )
    elif any(k in sc_low for k in ["alone", "cancel plans", "recharge", "quiet", "say no"]):
        return SimulationResponse(
            scenario=scenario,
            projected_mood_delta=+0.8,
            projected_stress_delta=-1.2,
            energy_trajectory="Steady",
            narrative="Boundary-setting protects your nervous system from sensory overstimulation, especially during high-demand weeks.",
            countermeasure="Avoid replacing social time with doomscrolling; opt for analog rest like reading or a warm bath.",
            confidence=0.84,
        )
    else:
        return SimulationResponse(
            scenario=scenario,
            projected_mood_delta=+0.3,
            projected_stress_delta=-0.5,
            energy_trajectory="Steady",
            narrative=f"This scenario creates moderate baseline modulation for your '{current_pattern}' state without destabilizing your equilibrium.",
            countermeasure="Check in with your body 2 hours after starting this activity to gauge somatic fatigue.",
            confidence=0.80,
        )
