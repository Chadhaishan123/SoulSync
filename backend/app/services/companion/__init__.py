"""
AI Companion response generator.

Produces data-grounded responses using the user's ML insights (trend,
cluster, anomalies, patterns) rather than just raw averages. Crisis
detection always takes priority.

This is template-based — no LLM dependency. The templates are rich enough
to feel conversational while remaining fully grounded in computed stats.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Dict, List, Optional

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

    msg_lower = user_message.lower()

    if not entries:
        return {
            "reply": (
                "I don't have any check-in data from you yet. Once you start "
                "logging daily check-ins, I'll be able to give you personalized "
                "insights about your mood trends, patterns, and wellness. "
                "Try logging your first check-in to get started!"
            ),
            "engine": ENGINE_TEMPLATE,
            "safety": safety,
        }

    # ── Compute basic stats ──
    avg_mood = round(sum(e.mood_score for e in entries) / len(entries), 1)
    latest = entries[0]  # Most recent
    latest_mood = latest.mood_score

    # ── Route by intent ──

    clean_msg = msg_lower.strip().rstrip("!.?")

    # Greeting
    if clean_msg in ["hi", "hello", "hey", "hola", "sup", "good morning", "good afternoon", "good evening", "greetings"] or any(msg_lower.startswith(w) for w in ["hi ", "hello ", "hey "]):
        reply = (
            f"Hello! It's great to connect. Based on your recent check-in, your mood is currently at {latest.mood_score}/10. "
            "How has your day been treating you? You can ask me to explore your patterns, check sleep insights, or suggest wellness habits."
        )

    # Affirmative / follow-up prompts
    elif clean_msg in ["yes", "sure", "ok", "okay", "yeah", "yep", "please", "yes please", "tell me", "explore", "go ahead"]:
        reply = (
            f"Here are personalized recommendations based on your check-in trends (average mood: {avg_mood}/10):\n\n"
            + _recommendation_response(entries, avg_mood, ml_trend)
            + "\n\nWould you like to look at your sleep correlations or dive into your Digital Twin profile?"
        )

    # Negative / dismissal
    elif clean_msg in ["no", "nope", "not now", "nah", "later"]:
        reply = "Understood! I'm always here whenever you'd like to check in or talk. Take gentle care of yourself today."

    # Gratitude / thanks
    elif any(w in msg_lower for w in ["thank", "thx", "appreciate"]):
        reply = "You're very welcome! Taking time for self-reflection is meaningful progress. I'm right here whenever you need me."

    # Mood / feelings
    elif any(w in msg_lower for w in ["mood", "feeling", "how am i", "how do i"]):
        reply = _mood_response(entries, avg_mood, latest, ml_trend)

    # Sleep
    elif any(w in msg_lower for w in ["sleep", "rest", "tired", "insomnia"]):
        reply = _sleep_response(entries)

    # Stress / anxiety
    elif any(w in msg_lower for w in ["stress", "anxious", "overwhelm", "anxiety", "pressure"]):
        reply = _stress_response(entries)

    # Patterns / trends / insights
    elif any(w in msg_lower for w in ["pattern", "trend", "insight", "notice", "correlation"]):
        reply = _pattern_response(entries, ml_trend, ml_cluster)

    # Digital twin / cluster
    elif any(w in msg_lower for w in ["twin", "cluster", "profile", "type", "archetype"]):
        reply = _twin_response(entries, ml_cluster)

    # Anomaly / unusual
    elif any(w in msg_lower for w in ["anomal", "unusual", "different", "weird", "strange"]):
        reply = _anomaly_response(entries, ml_anomaly)

    # Recommendations / suggestions
    elif any(w in msg_lower for w in ["recommend", "suggest", "advice", "help", "what should"]):
        reply = _recommendation_response(entries, avg_mood, ml_trend)

    # Gratitude / positive
    elif any(w in msg_lower for w in ["grateful", "thankful", "positive", "happy"]):
        reply = _gratitude_response(entries, avg_mood)

    # Default: summary + prompt
    else:
        reply = _default_response(entries, avg_mood, latest, ml_trend, ml_cluster)

    # Add elevated safety resources if needed
    if safety["level"] == "elevated":
        reply += (
            "\n\nI also want you to know that support is available if you need it. "
            "You can reach out to a helpline anytime — they're free and confidential."
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
        return "I don't have enough sleep data yet. Try rating your sleep quality in your next check-in."

    avg = round(sum(sleep_scores) / len(sleep_scores), 1)
    latest_sleep = sleep_scores[0]

    tip = (
        "Your sleep quality looks good — keep up what's working!"
        if avg >= 7
        else "Consider a consistent bedtime routine. Even small changes like reducing screen time before bed can help."
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
        "Short walks also help reset your nervous system."
        if avg >= 6
        else "You seem to be managing stress well. Keep doing what works for you!"
    )

    return f"Your average stress level is {avg}/10 across {len(stress_scores)} entries. {tip}"


def _pattern_response(entries, ml_trend, ml_cluster):
    parts = []

    if ml_trend:
        direction = ml_trend.get("direction", "stable")
        backed = "ML-backed" if ml_trend.get("is_model_backed") else "rule-based"
        parts.append(f"**Trend:** Your mood is {direction} ({backed}).")

    if ml_cluster:
        pattern = ml_cluster.get("current_pattern", "Balanced")
        parts.append(f"**Pattern:** You're currently in a '{pattern}' phase.")

    emotions = [e.primary_emotion for e in entries if e.primary_emotion]
    if emotions:
        top_3 = Counter(emotions).most_common(3)
        em_list = ", ".join(f"{em} ({c}x)" for em, c in top_3)
        parts.append(f"**Top emotions:** {em_list}")

    if not parts:
        return "Keep logging check-ins — I need at least 14 entries to find meaningful patterns in your data."

    return "Here's what I see in your data:\n\n" + "\n".join(parts)


def _twin_response(entries, ml_cluster):
    if not ml_cluster:
        return "I need more check-in data to build your digital twin profile. Keep logging!"

    pattern = ml_cluster.get("current_pattern", "Balanced")
    clusters = ml_cluster.get("clusters", {})
    total = ml_cluster.get("total_days", 0)
    backed = "K-Means clustering" if ml_cluster.get("is_model_backed") else "rule-based analysis"

    dist = ", ".join(f"{k}: {v} days" for k, v in clusters.items() if v > 0)

    return (
        f"Your digital twin analysis (via {backed}) shows you're currently in a "
        f"'{pattern}' state. Across {total} days analyzed, your distribution is: {dist}."
    )


def _anomaly_response(entries, ml_anomaly):
    if not ml_anomaly:
        return "I need more data to detect unusual patterns. Keep logging check-ins!"

    if ml_anomaly.get("is_anomaly"):
        return ml_anomaly.get("explanation", "Something unusual was detected in your latest check-in.")

    return "Your latest check-in falls within your normal patterns — no anomalies detected."


def _recommendation_response(entries, avg_mood, ml_trend):
    parts = ["Based on your data, here are some suggestions:\n"]

    if avg_mood < 5:
        parts.append("• Your mood has been low — gentle movement like a walk or stretching can help lift it.")
    if any(e.stress_level and e.stress_level >= 7 for e in entries[:3]):
        parts.append("• Your stress has been high recently — try a breathing exercise or meditation session.")
    if any(e.sleep_quality and e.sleep_quality <= 4 for e in entries[:3]):
        parts.append("• Your sleep quality has been low — consider limiting caffeine after noon and setting a wind-down alarm.")

    if ml_trend and ml_trend.get("direction") == "declining":
        parts.append("• Your mood trend is declining — this might be a good time to connect with someone you trust.")

    if len(parts) == 1:
        parts.append("• You're doing well overall! Keep up your current routines.")
        parts.append("• Consider journaling about what's working — it reinforces positive habits.")

    return "\n".join(parts)


def _gratitude_response(entries, avg_mood):
    return (
        f"It's wonderful that you're focusing on gratitude! Research shows it can improve mood by 10-25% "
        f"over time. Your current average mood is {avg_mood}/10. Try the journal's gratitude mode "
        f"to build a daily gratitude practice."
    )


def _default_response(entries, avg_mood, latest, ml_trend, ml_cluster):
    trend_bit = ""
    if ml_trend:
        trend_bit = f" Your mood trend is {ml_trend.get('direction', 'stable')}."

    cluster_bit = ""
    if ml_cluster:
        cluster_bit = f" You're in a '{ml_cluster.get('current_pattern', 'Balanced')}' pattern."

    return (
        f"Thanks for sharing. Your mood has averaged {avg_mood}/10 over your last "
        f"{len(entries)} check-ins, with your latest at {latest.mood_score}/10."
        f"{trend_bit}{cluster_bit} "
        f"Would you like to explore your patterns, get recommendations, or talk about something specific?"
    )
