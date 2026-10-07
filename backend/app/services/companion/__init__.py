"""
AI Companion response generator.

Produces data-grounded, empathetic, and dynamic conversational responses
using the user's ML insights (trend, cluster, anomalies, patterns). Crisis
detection always takes priority.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Dict, List, Optional
import random

from app.core.safety import assess as safety_assess, CRISIS_MESSAGE
from app.models.companion import ENGINE_SAFETY, ENGINE_TEMPLATE

log = logging.getLogger("soulsync.companion")


def generate_response(
    user_message: str,
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
    ml_anomaly: Optional[Dict[str, Any]] = None,
    country_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a companion response grounded in user data and ML insights.

    Returns:
        reply:   response text
        engine:  which engine produced it
        safety:  safety assessment result
    """
    # ── Safety check FIRST ──
    safety = safety_assess(user_message, country_code)

    if safety["interrupt"]:
        resources_text = "\n".join(
            f"• {r['name']}: {r['contact']} — {r['detail']}"
            for r in safety["resources"][:4]
        )
        return {
            "reply": f"{CRISIS_MESSAGE}\n\n{resources_text}",
            "engine": ENGINE_SAFETY,
            "safety": safety,
        }

    msg_lower = user_message.lower().strip()
    clean_msg = msg_lower.rstrip("!.?")

    if not entries:
        return {
            "reply": (
                "I'm here with you! Because you haven't logged any check-ins yet, I don't have "
                "your personal baseline. Once you record your first daily check-in or journal entry, "
                "I'll be able to correlate your mood, sleep, and stress in real-time.\n\n"
                "In the meantime, how are you feeling right now?"
            ),
            "engine": ENGINE_TEMPLATE,
            "safety": safety,
        }

    # ── Compute basic stats ──
    avg_mood = round(sum(e.mood_score for e in entries) / len(entries), 1)
    latest = entries[0]  # Most recent
    latest_mood = latest.mood_score
    latest_emotion = getattr(latest, "primary_emotion", "Neutral")

    # ── Route by dynamic conversational intents ──

    # 1. Greetings
    if clean_msg in [
        "hi", "hello", "hey", "hola", "sup", "good morning", "good afternoon",
        "good evening", "greetings", "howdy"
    ] or any(msg_lower.startswith(w) for w in ["hi ", "hello ", "hey "]):
        greetings = [
            f"Hello! It's so nice to hear from you. Your latest check-in showed a mood of {latest_mood}/10 ({latest_emotion}). How has today been treating your mind and body?",
            f"Hey there! I'm glad you stopped by to check in. I'm holding space for you today. What's on your mind right now?",
            f"Good to see you! Based on your recent entries, you've been averaging a {avg_mood}/10 mood. How are you feeling in this exact moment?"
        ]
        reply = random.choice(greetings)

    # 2. Breathing / Guided Meditation
    elif any(w in msg_lower for w in ["breathe", "breathing", "meditat", "grounding", "relax me", "calm down", "guide me"]):
        reply = (
            "Let's pause and reset together right now with a 4-7-8 calming breath:\n\n"
            "1. **Inhale** gently through your nose for **4 seconds**...\n"
            "2. **Hold** that gentle breath softly for **7 seconds**...\n"
            "3. **Exhale** slowly through your mouth for **8 seconds**...\n\n"
            "Drop your shoulders, unclench your jaw, and take two more slow cycles. "
            "How does your chest and head feel after doing that?"
        )

    # 3. Sadness / Grief / Crying / Heartbreak
    elif any(w in msg_lower for w in ["sad", "depress", "crying", "cry", "heartbreak", "hurting", "lost", "grief", "hopeless", "down", "terrible", "bad day"]):
        reply = (
            f"I hear how heavy things feel right now, and I want to validate that it is completely okay to feel sad. "
            f"You don't have to force yourself to be cheerful. In your check-in history, you noted feeling {latest_emotion.lower()} recently.\n\n"
            "Give yourself permission to take it slow today. Drink a sip of water, wrap yourself in warmth, and let yourself rest. "
            "Would you like to write down what's weighing on you, or would you prefer a quiet somatic exercise?"
        )

    # 4. Conflict / Relationships / Arguments
    elif any(w in msg_lower for w in ["fight", "argued", "argument", "friend", "partner", "boyfriend", "girlfriend", "breakup", "relationship", "family", "parents"]):
        reply = (
            "Interpersonal conflict can cause an intense physical and emotional spike in our nervous system. "
            "When we have a confrontation with someone close to us, our brain often perceives it as a threat to our safety.\n\n"
            "Before reacting or over-analyzing what happened, try to take a step back. "
            "Remember: what the other person did reflects their emotional state, not your entire worth. "
            "Would you like to draft a calm response together, or unpack how the interaction made you feel?"
        )

    # 5. Overthinking / Anxiety / Worry / Panic
    elif any(w in msg_lower for w in ["overthink", "anxious", "anxiety", "panic", "worry", "scared", "nervous", "spiral"]):
        reply = (
            "When overthinking starts spiraling, our thoughts try to solve problems that haven't even happened yet. "
            "Let's anchor into the 5-4-3-2-1 grounding technique right now:\n\n"
            "• Name **5 things** you can see in your room.\n"
            "• Feel **4 textures** (your clothes, desk, phone).\n"
            "• Notice **3 sounds** in the background.\n"
            "• Identify **2 scents** around you.\n"
            "• Acknowledge **1 thing** you are safe from right now.\n\n"
            "Your mind is trying to protect you, but you are here in the present. What is the single biggest worry on your mind?"
        )

    # 6. Burnout / Work / Study / Exams / Exhaustion
    elif any(w in msg_lower for w in ["work", "job", "boss", "exam", "college", "school", "study", "deadline", "burnout", "tired", "exhausted", "drained"]):
        reply = (
            f"It sounds like your energy reserves are running near empty. Your recent energy scores averaged around "
            f"{round(sum(e.energy_level for e in entries if e.energy_level is not None) / max(1, len(entries)), 1)}/10.\n\n"
            "Remember that rest is not a reward you earn after working yourself to exhaustion — rest is an essential biological requirement. "
            "Can you step away from screens for just 10 minutes to close your eyes, or take a short walk to reset your attention?"
        )

    # 7. Sleep / Insomnia
    elif any(w in msg_lower for w in ["sleep", "rest", "insomnia", "can't sleep", "cant sleep", "awake", "nightmare"]):
        reply = _sleep_response(entries)

    # 8. Affirmative prompts
    elif clean_msg in ["yes", "sure", "ok", "okay", "yeah", "yep", "please", "yes please", "tell me", "explore", "go ahead"]:
        reply = (
            f"Here are personalized recommendations based on your check-in trends (average mood: {avg_mood}/10):\n\n"
            + _recommendation_response(entries, avg_mood, ml_trend)
            + "\n\nWould you like to look at your sleep correlations or dive into your Digital Twin profile?"
        )

    # 9. Negative / dismissal
    elif clean_msg in ["no", "nope", "not now", "nah", "later"]:
        reply = "Understood! I'm always here whenever you'd like to check in or talk. Take gentle care of yourself today."

    # 10. Gratitude / thanks
    elif any(w in msg_lower for w in ["thank", "thx", "appreciate"]):
        reply = "You're very welcome! Taking time for intentional self-reflection is meaningful progress. I'm right here whenever you need me."

    # 11. Mood / feelings inquiry
    elif any(w in msg_lower for w in ["mood", "feeling", "how am i", "how do i"]):
        reply = _mood_response(entries, avg_mood, latest, ml_trend)

    # 12. Patterns / trends / insights
    elif any(w in msg_lower for w in ["pattern", "trend", "insight", "notice", "correlation"]):
        reply = _pattern_response(entries, ml_trend, ml_cluster)

    # 13. Digital twin / cluster
    elif any(w in msg_lower for w in ["twin", "cluster", "profile", "type", "archetype"]):
        reply = _twin_response(entries, ml_cluster)

    # 14. Anomaly / unusual
    elif any(w in msg_lower for w in ["anomal", "unusual", "different", "weird", "strange"]):
        reply = _anomaly_response(entries, ml_anomaly)

    # 15. Recommendations / suggestions
    elif any(w in msg_lower for w in ["recommend", "suggest", "advice", "help", "what should"]):
        reply = _recommendation_response(entries, avg_mood, ml_trend)

    # 16. Gratitude practice
    elif any(w in msg_lower for w in ["grateful", "thankful", "positive"]):
        reply = _gratitude_response(entries, avg_mood)

    # 17. Default dynamic empathetic response
    else:
        openers = [
            f"Thank you for sharing that with me. Looking at your recent reflections, your mood has been around {latest_mood}/10 with {latest_emotion.lower()} feelings.",
            f"I hear you. Every thought and reflection you share helps build a clearer picture of your inner world.",
            f"I appreciate your openness. It takes intentionality to put feelings into words."
        ]
        chosen_opener = random.choice(openers)
        trend_note = f" Your current trajectory is {ml_trend.get('direction', 'stable')}." if ml_trend else ""
        pattern_note = f" (Profile: {ml_cluster.get('current_pattern', 'Balanced')})" if ml_cluster else ""

        reply = (
            f"{chosen_opener}{trend_note}{pattern_note}\n\n"
            "Tell me more about what triggered that feeling, or if you'd like, we can explore your trends, try a guided grounding breath, or look at today's wellness recommendations."
        )

    # Add elevated safety resources if needed
    if safety["level"] == "elevated":
        reply += (
            "\n\nI also want you to know that compassionate support is always available. "
            "You can reach out to a professional helpline anytime — they're free, confidential, and available 24/7."
        )

    return {
        "reply": reply,
        "engine": ENGINE_TEMPLATE,
        "safety": safety,
    }


def _mood_response(entries, avg_mood, latest, ml_trend):
    trend_text = ""
    if ml_trend:
        direction = ml_trend.get("direction", "stable")
        confidence = ml_trend.get("confidence", 0)
        backed = ml_trend.get("is_model_backed", False)
        model = "ML model" if backed else "basic analysis"
        trend_text = f" Our {model} sees your mood as {direction} (confidence: {confidence:.0%})."

    emotions = [e.primary_emotion for e in entries[:7] if e.primary_emotion]
    emotion_text = ""
    if emotions:
        top = Counter(emotions).most_common(1)[0]
        emotion_text = f" Your most frequent recent emotion is {top[0]}."

    return (
        f"Based on your last {len(entries)} check-ins, your average mood is "
        f"{avg_mood}/10. Your most recent entry was {latest.mood_score}/10."
        f"{emotion_text}{trend_text}"
    )


def _sleep_response(entries):
    sleep_scores = [e.sleep_quality for e in entries if e.sleep_quality is not None]
    if not sleep_scores:
        return "I don't have enough sleep data yet. Try rating your sleep quality in your next check-in or use the Live Sleep Stopwatch."

    avg = round(sum(sleep_scores) / len(sleep_scores), 1)
    latest_sleep = sleep_scores[0]

    tip = (
        "Your sleep quality looks good — keep up your wind-down habits!"
        if avg >= 7
        else "Consider keeping a consistent bedtime routine. Dimming blue screens 45 minutes prior to sleep can help melatonin production."
    )

    return (
        f"Your average sleep quality is {avg}/10 across {len(sleep_scores)} entries. "
        f"Your most recent was {latest_sleep}/10. {tip}"
    )


def _stress_response(entries):
    stress_scores = [e.stress_level for e in entries if e.stress_level is not None]
    if not stress_scores:
        return "I don't have stress data yet. Try logging your stress level in your next check-in."

    avg = round(sum(stress_scores) / len(stress_scores), 1)

    tip = (
        "That's elevated. Try a 5-minute breathing exercise: inhale for 4 counts, hold for 4, exhale for 6. "
        "Short outdoor walks also help down-regulate an active sympathetic nervous system."
        if avg >= 6
        else "You seem to be managing stress well. Keep doing what works for you!"
    )

    return f"Your average stress level is {avg}/10 across {len(stress_scores)} entries. {tip}"


def _pattern_response(entries, ml_trend, ml_cluster):
    parts = []

    if ml_trend:
        direction = ml_trend.get("direction", "stable")
        backed = "ML-backed" if ml_trend.get("is_model_backed") else "rule-based"
        parts.append(f"• **Trend:** Your mood is {direction} ({backed}).")

    if ml_cluster:
        pattern = ml_cluster.get("current_pattern", "Balanced")
        parts.append(f"• **Pattern:** You're currently in a '{pattern}' phase.")

    emotions = [e.primary_emotion for e in entries if e.primary_emotion]
    if emotions:
        top_3 = Counter(emotions).most_common(3)
        em_list = ", ".join(f"{em} ({c}x)" for em, c in top_3)
        parts.append(f"• **Top emotions:** {em_list}")

    if not parts:
        return "Keep logging check-ins — I need a few more entries to identify deeper patterns."

    return "Here's what your data reveals:\n\n" + "\n".join(parts)


def _twin_response(entries, ml_cluster):
    if not ml_cluster:
        return "I need more check-in data to build your digital twin profile. Keep logging!"

    pattern = ml_cluster.get("current_pattern", "Balanced")
    clusters = ml_cluster.get("clusters", {})
    total = ml_cluster.get("total_days", 0)
    backed = "K-Means clustering" if ml_cluster.get("is_model_backed") else "rule-based analysis"

    dist = ", ".join(f"{k}: {v} days" for k, v in clusters.items() if v > 0)

    return (
        f"Your digital twin profile (via {backed}) identifies you currently in a "
        f"'{pattern}' state. Across {total} recorded days, your pattern distribution is: {dist}."
    )


def _anomaly_response(entries, ml_anomaly):
    if not ml_anomaly:
        return "I need more data to detect unusual patterns. Keep logging check-ins!"

    if ml_anomaly.get("is_anomaly"):
        return ml_anomaly.get("explanation", "Something unusual was detected in your latest check-in.")

    return "Your latest check-in falls within your normal patterns — no anomalies detected."


def _recommendation_response(entries, avg_mood, ml_trend):
    parts = ["Based on your data, here are customized suggestions:\n"]

    if avg_mood < 5:
        parts.append("• Your mood has been low — gentle movement like a walk or stretching can help release endorphins.")
    if any(e.stress_level and e.stress_level >= 7 for e in entries[:3]):
        parts.append("• Your stress has been high recently — try a 4-7-8 breathing exercise or somatic reset.")
    if any(e.sleep_quality and e.sleep_quality <= 4 for e in entries[:3]):
        parts.append("• Your sleep quality has been low — try the Live Sleep stopwatch and avoid late caffeine.")

    if ml_trend and ml_trend.get("direction") == "declining":
        parts.append("• Your mood trend is declining — consider reaching out to someone you trust or a counselor.")

    if len(parts) == 1:
        parts.append("• You're doing well overall! Keep up your steady mindfulness routines.")
        parts.append("• Consider journaling about what brought you peace today to reinforce positive habits.")

    return "\n".join(parts)


def _gratitude_response(entries, avg_mood):
    return (
        f"It's wonderful that you're leaning into gratitude! Research shows intentional gratitude "
        f"lowers cortisol and improves emotional resilience. Your current average mood is {avg_mood}/10. "
        f"What is one small thing that made you smile today?"
    )
