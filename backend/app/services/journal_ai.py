"""AI Journal Assistant: Dynamic Prompts & CBT Cognitive Reframing.
Integrates Gemini & Groq with evidence-based psychological fallbacks.
"""

from __future__ import annotations

import json
import logging
import random
from typing import Optional
import httpx

from app.core.config import settings
from app.schemas.journal import PromptResponse, ReframeResponse

log = logging.getLogger("soulsync.journal_ai")

FALLBACK_PROMPTS = [
    {"prompt": "What was a quiet moment today where you felt most like yourself?", "category": "Mindfulness"},
    {"prompt": "What is an emotion you experienced recently that felt difficult to name or express?", "category": "Emotional Awareness"},
    {"prompt": "What is a boundary you held or wish you had held today to protect your peace?", "category": "Self-Care & Boundaries"},
    {"prompt": "What is something challenging you handled recently that showed your inner resilience?", "category": "Strength & Resilience"},
    {"prompt": "Name one small sensory detail from today that brought subtle comfort or gratitude.", "category": "Gratitude"},
    {"prompt": "If you spoke to yourself right now with the gentleness of your closest friend, what would you say?", "category": "Self-Compassion"},
    {"prompt": "What expectation did you place on yourself today that you can consciously let go of?", "category": "Letting Go"},
    {"prompt": "What is one dream or aspiration that still gives you a spark of quiet hope?", "category": "Vision & Hope"},
]


def generate_journal_prompt(category: Optional[str] = None) -> PromptResponse:
    """Generate or retrieve an inspiring reflective journaling prompt."""
    prompt_instruction = (
        "Generate 1 unique, deeply reflective, emotionally resonant journaling prompt "
        "designed for psychological self-discovery and mindfulness. "
        "Return ONLY valid JSON matching this schema: "
        '{"prompt": "<the prompt string>", "category": "<1-2 word category>"}'
    )

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            url = f"{settings.GEMINI_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt_instruction}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 200},
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    data = json.loads(text)
                    return PromptResponse(
                        prompt=data.get("prompt", "What is currently resting on your heart?"),
                        category=data.get("category", "Reflection"),
                    )
        except Exception as exc:
            log.warning("Gemini prompt generation failed: %s", exc)

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a gentle mindfulness prompt engine. Return ONLY JSON."},
                    {"role": "user", "content": prompt_instruction},
                ],
                "temperature": 0.7,
                "response_format": {"type": "json_object"},
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post(settings.GROQ_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    data = json.loads(res.json()["choices"][0]["message"]["content"].strip())
                    return PromptResponse(
                        prompt=data.get("prompt", "What did today teach you about your needs?"),
                        category=data.get("category", "Reflection"),
                    )
        except Exception as exc:
            log.warning("Groq prompt generation failed: %s", exc)

    # Fallback
    chosen = random.choice(FALLBACK_PROMPTS)
    return PromptResponse(prompt=chosen["prompt"], category=chosen["category"])


def cbt_reframe_thought(thought: str) -> ReframeResponse:
    """Analyze an automatic negative thought and produce an evidence-based CBT reframe."""
    reframe_instruction = (
        f"You are a compassionate CBT (Cognitive Behavioral Therapy) coach. "
        f"The user wrote this automatic thought:\n\"{thought}\"\n\n"
        "Identify the primary cognitive distortion (e.g. Catastrophizing, All-or-Nothing Thinking, Mind Reading, Emotional Reasoning, Overgeneralization, Fortune Telling, or Should Statements). "
        "Explain it gently and craft a realistic, balanced, self-compassionate alternative perspective. "
        "Return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "distortion": "<Name of Distortion>",\n'
        '  "explanation": "<1 brief sentence explaining why the thought falls into this pattern>",\n'
        '  "balanced_perspective": "<1-2 sentences with an empathetic, realistic, balanced reframed thought>",\n'
        '  "actionable_affirmation": "<1 short grounding affirmation to hold onto>"\n'
        "}"
    )

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            url = f"{settings.GEMINI_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": reframe_instruction}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 350},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    data = json.loads(text)
                    return ReframeResponse(
                        original_thought=thought,
                        distortion=data.get("distortion", "All-or-Nothing Thinking"),
                        explanation=data.get("explanation", "Viewing this moment as complete success or complete failure."),
                        balanced_perspective=data.get("balanced_perspective", "Growth happens in small steps. It's okay to be imperfect."),
                        actionable_affirmation=data.get("actionable_affirmation", "I am allowed to learn as I go."),
                    )
        except Exception as exc:
            log.warning("Gemini CBT reframe failed: %s", exc)

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a CBT cognitive restructuring specialist. Return ONLY JSON."},
                    {"role": "user", "content": reframe_instruction},
                ],
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(settings.GROQ_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    data = json.loads(res.json()["choices"][0]["message"]["content"].strip())
                    return ReframeResponse(
                        original_thought=thought,
                        distortion=data.get("distortion", "Overgeneralization"),
                        explanation=data.get("explanation", "Extending one difficult experience to define the entire outcome."),
                        balanced_perspective=data.get("balanced_perspective", "This specific challenge is temporary and does not dictate my worth or future."),
                        actionable_affirmation=data.get("actionable_affirmation", "One difficult moment does not equal a difficult life."),
                    )
        except Exception as exc:
            log.warning("Groq CBT reframe failed: %s", exc)

    # Heuristic Fallback
    t_lower = thought.lower()
    if any(w in t_lower for w in ["always", "never", "ruined", "disaster", "fail"]):
        return ReframeResponse(
            original_thought=thought,
            distortion="Catastrophizing & Black-and-White Thinking",
            explanation="The mind is magnifying the difficulty into an absolute or permanent state.",
            balanced_perspective="Even if this is difficult right now, it is one isolated chapter. I have navigated hard moments before.",
            actionable_affirmation="I take this one breath and one step at a time.",
        )
    elif any(w in t_lower for w in ["should", "must", "ought to"]):
        return ReframeResponse(
            original_thought=thought,
            distortion="Should Statements",
            explanation="Holding rigid self-imposed rules that generate guilt and unnecessary emotional pressure.",
            balanced_perspective="I would prefer things to go smoothly, but realistic expectations allow room for human limitations.",
            actionable_affirmation="I replace 'I should' with 'I choose what is healthy for me right now.'",
        )
    else:
        return ReframeResponse(
            original_thought=thought,
            distortion="Emotional Reasoning",
            explanation="Assuming that because an intense feeling is present, it must reflect the factual reality.",
            balanced_perspective="My feelings are valid signals of my fatigue or stress, but they are not permanent facts.",
            actionable_affirmation="Feelings are visitors; I can observe them without letting them define me.",
        )
