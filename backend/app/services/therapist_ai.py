"""Digital Therapist AI Service: Clinical CBT Dialogue & Session Summaries.
Uses Gemini & Groq with evidence-based Cognitive Behavioral Therapy principles.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional
import httpx

from app.core.config import settings
from app.schemas.therapist import (
    ChatMessageItem,
    TherapistChatResponse,
    TherapistSummaryResponse,
)

log = logging.getLogger("soulsync.therapist_ai")

CRISIS_KEYWORDS = [
    "suicide",
    "kill myself",
    "end my life",
    "want to die",
    "hurt myself",
    "better off dead",
    "hang myself",
]


def check_crisis(text: str) -> Optional[TherapistChatResponse]:
    """Flag immediate acute crisis and return escalation resources."""
    t_lower = text.lower()
    for kw in CRISIS_KEYWORDS:
        if kw in t_lower:
            return TherapistChatResponse(
                reply=(
                    "I hear how much deep pain and heaviness you are holding right now, but please know you do not have to carry this alone. Your life has immense value.\n\n"
                    "Because I am an AI, I cannot provide emergency crisis care. Please connect immediately with compassionate human clinicians who are available 24/7:\n"
                    "• **Tele-MANAS (India)**: Call **14416** or **1800-891-4416** (Free & Confidential)\n"
                    "• **National Crisis Line**: Call or text **988**\n"
                    "• **Vandrevala Foundation**: Call **+91 9999 666 555**\n\n"
                    "Please reach out to one of these lifelines or a loved one right now."
                ),
                distortion_detected="Acute Emotional Distress",
                distortion_advice="Safety is the first priority. Please speak with a licensed clinician immediately.",
                is_crisis=True,
            )
    return None


def generate_therapist_reply(
    message: str,
    history: List[ChatMessageItem],
) -> TherapistChatResponse:
    """Generate an empathic, evidence-based CBT therapist response."""
    # 1. Check for immediate crisis
    crisis_res = check_crisis(message)
    if crisis_res:
        return crisis_res

    # Build conversation context
    history_snippets = []
    for m in history[-6:]:
        history_snippets.append(f"{m.role.capitalize()}: {m.content}")
    history_snippets.append(f"User: {message}")
    convo_context = "\n".join(history_snippets)

    system_prompt = (
        "You are Dr. Elena, a clinical Cognitive Behavioral Therapy (CBT) specialist and somatic psychologist for SoulSync. "
        "Your clinical objectives:\n"
        "1. Validate the user's emotional experience warmly and without patronizing.\n"
        "2. Use gentle Socratic questioning to challenge cognitive distortions (e.g. Catastrophizing, All-or-Nothing, Mind Reading, Emotional Reasoning, Should Statements).\n"
        "3. If somatic stress or anxiety is high, suggest somatic grounding (Box Breathing or 5-4-3-2-1).\n"
        "4. Keep replies concise, conversational (2-4 sentences), and deeply compassionate.\n\n"
        "Respond ONLY in valid JSON matching this schema:\n"
        "{\n"
        '  "reply": "<Your therapist response string>",\n'
        '  "distortion_detected": "<Distortion name or null>",\n'
        '  "distortion_advice": "<1 sentence advice on this distortion or null>",\n'
        '  "tool_suggestion": <"box_breathing" | "5_4_3_2_1" | "thought_record" | null>\n'
        "}"
    )

    full_prompt = f"{system_prompt}\n\nRecent Conversation:\n{convo_context}\n\nJSON Output:"

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            url = f"{settings.GEMINI_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": full_prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 450},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    data = json.loads(text)
                    return TherapistChatResponse(
                        reply=data.get("reply", "I hear you. Can you tell me what emotion feels strongest right now?"),
                        distortion_detected=data.get("distortion_detected"),
                        distortion_advice=data.get("distortion_advice"),
                        tool_suggestion=data.get("tool_suggestion"),
                    )
        except Exception as exc:
            log.warning("Gemini therapist reply failed: %s", exc)

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": convo_context},
                ],
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(settings.GROQ_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    data = json.loads(res.json()["choices"][0]["message"]["content"].strip())
                    return TherapistChatResponse(
                        reply=data.get("reply", "I hear you. Let's look closely at what thoughts are driving this feeling."),
                        distortion_detected=data.get("distortion_detected"),
                        distortion_advice=data.get("distortion_advice"),
                        tool_suggestion=data.get("tool_suggestion"),
                    )
        except Exception as exc:
            log.warning("Groq therapist reply failed: %s", exc)

    # Heuristic Fallback
    m_low = message.lower()
    if any(w in m_low for w in ["always", "never", "ruined", "failed", "impossible"]):
        return TherapistChatResponse(
            reply="It sounds like you're carrying a lot of weight right now. Notice how the words 'always' or 'never' make situations feel absolute. What is one small piece of evidence where this didn't happen?",
            distortion_detected="All-or-Nothing Thinking",
            distortion_advice="Absolute words can turn a temporary setback into a permanent identity.",
            tool_suggestion="thought_record",
        )
    elif any(w in m_low for w in ["panic", "anxious", "heart racing", "overwhelmed", "can't breathe"]):
        return TherapistChatResponse(
            reply="Your nervous system is sounding an alarm right now. Before we analyze any thoughts, let's bring your body back to safety. Can you take a long breath in for 4 seconds, hold, and let it out for 6?",
            distortion_detected="Somatic Hyperarousal",
            distortion_advice="When the amygdala is active, physical regulation must precede cognitive restructuring.",
            tool_suggestion="box_breathing",
        )
    else:
        return TherapistChatResponse(
            reply="Thank you for sharing that candidly with me. When you hold this situation in mind, what is the core story your mind is telling you about yourself?",
            distortion_detected=None,
            distortion_advice=None,
            tool_suggestion=None,
        )


def generate_clinical_summary(history: List[ChatMessageItem]) -> TherapistSummaryResponse:
    """Summarize the clinical session into trigger, distortion, balanced belief, and homework."""
    convo_text = "\n".join([f"{m.role}: {m.content}" for m in history])

    prompt = (
        "You are a clinical CBT supervisor reviewing a therapy session transcript. "
        "Summarize this dialogue into structured clinical takeaways. "
        "Return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "trigger": "<1 concise sentence summarizing the core trigger or situation>",\n'
        '  "primary_distortion": "<Primary cognitive distortion identified, e.g. Catastrophizing>",\n'
        '  "balanced_perspective": "<1-2 sentences with the balanced, realistic reframed perspective achieved>",\n'
        '  "homework_exercise": "<1 actionable somatic or behavioral micro-exercise to practice today>"\n'
        "}\n\n"
        f"Transcript:\n{convo_text}"
    )

    # 1. Try Gemini
    if settings.GEMINI_API_KEY:
        try:
            url = f"{settings.GEMINI_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 300},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    data = json.loads(text)
                    return TherapistSummaryResponse(
                        trigger=data.get("trigger", "Daily stress and high cognitive demand."),
                        primary_distortion=data.get("primary_distortion", "Catastrophizing"),
                        balanced_perspective=data.get("balanced_perspective", "One difficult moment does not dictate the outcome."),
                        homework_exercise=data.get("homework_exercise", "Take three 4-7-8 breaths whenever you feel tension rising."),
                    )
        except Exception as exc:
            log.warning("Gemini session summary failed: %s", exc)

    # 2. Try Groq
    if settings.GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a clinical supervisor. Return ONLY JSON."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            }
            with httpx.Client(timeout=12.0) as client:
                res = client.post(settings.GROQ_URL, json=payload, headers=headers)
                if res.status_code == 200:
                    data = json.loads(res.json()["choices"][0]["message"]["content"].strip())
                    return TherapistSummaryResponse(
                        trigger=data.get("trigger", "Demanding responsibilities and fear of falling short."),
                        primary_distortion=data.get("primary_distortion", "Should Statements"),
                        balanced_perspective=data.get("balanced_perspective", "I am allowed to move at a sustainable pace."),
                        homework_exercise=data.get("homework_exercise", "Practice five minutes of mindful sensory awareness before bed."),
                    )
        except Exception as exc:
            log.warning("Groq session summary failed: %s", exc)

    # Heuristic Fallback
    return TherapistSummaryResponse(
        trigger="Navigating high expectations and cognitive overload.",
        primary_distortion="Emotional Reasoning & Catastrophizing",
        balanced_perspective="Discomfort is a physical signal of stress, not a prophecy of failure. Small consistent steps create resilience.",
        homework_exercise="Pause for a 2-minute physiological sigh before responding to stressful messages today.",
    )
