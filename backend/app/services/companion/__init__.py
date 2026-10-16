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

import httpx
from app.core.config import settings
from app.core.safety import assess as safety_assess, CRISIS_MESSAGE
from app.models.companion import ENGINE_CLAUDE, ENGINE_GEMINI, ENGINE_GROQ, ENGINE_SAFETY, ENGINE_TEMPLATE

log = logging.getLogger("soulsync.companion")


def _build_companion_system_instruction(
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
) -> str:
    """Build shared compassionate persona prompt with subtle wellness grounding."""
    avg_mood = round(sum(e.mood_score for e in entries) / len(entries), 1) if entries else 7.0
    latest = entries[0] if entries else None
    latest_mood = f"{latest.mood_score}/10" if latest else "No check-ins yet"
    latest_emotion = getattr(latest, "primary_emotion", "Reflective") if latest else "None"

    emotions = [e.primary_emotion for e in entries if getattr(e, "primary_emotion", None)]
    top_emotions = ", ".join(f"{em} ({c}x)" for em, c in Counter(emotions).most_common(3)) if emotions else "None"

    stress_scores = [e.stress_level for e in entries if getattr(e, "stress_level", None) is not None]
    avg_stress = round(sum(stress_scores) / len(stress_scores), 1) if stress_scores else "N/A"

    sleep_scores = [e.sleep_quality for e in entries if getattr(e, "sleep_quality", None) is not None]
    avg_sleep = round(sum(sleep_scores) / len(sleep_scores), 1) if sleep_scores else "N/A"

    trend_dir = ml_trend.get("direction", "stable") if ml_trend else "insufficient data"
    pattern = ml_cluster.get("current_pattern", "Balanced") if ml_cluster else "Reflective"

    return (
        "You are the SoulSync AI Companion — a deeply empathetic, emotionally attuned, and warm presence. "
        "Think of yourself as an intuitive, deeply caring friend who genuinely listens, understands vulnerability, and makes the user feel truly seen, accepted, and never alone.\n\n"
        "HOW YOU SPEAK & CONNECT:\n"
        "• Be real, warm, and heartfelt. Talk like a real person who cares, not like a therapist, clinician, or corporate bot.\n"
        "• NEVER use clinical, patronizing, or robotic clichés: Ban phrases like 'I hear your frustration', 'I am holding space for you', 'Thank you for sharing that', 'As an AI language model', 'According to research', or 'attentional residue'.\n"
        "• Deep Validation First: When the user is tired, sad, hurting, or stressed, meet them where they are. Sit with them in that feeling. Do NOT jump into problem-solving, lecturing, giving unsolicited advice, or forcing toxic positivity.\n"
        "• Emotional Memory & Organic Context: You have quiet awareness of their recent emotional state from their check-ins:\n"
        f"  - General mood recent baseline: {avg_mood}/10\n"
        f"  - Latest check-in feeling: {latest_emotion} ({latest_mood})\n"
        f"  - Themes: {top_emotions}\n"
        f"  - Sleep & Stress: sleep avg ~{avg_sleep}/10, stress avg ~{avg_stress}/10\n"
        f"  - Behavioral phase: {pattern}, Trend: {trend_dir}\n"
        "  CRITICAL: Do NOT quote these raw scores or numbers like a database query. Instead, let them inform your empathy naturally (e.g. 'I know things have felt heavier over the past few days...' or 'I remember you've been running on very little sleep lately...').\n"
        "• Natural Flow: Keep answers brief to moderate (1 to 3 short paragraphs). Leave breathing room. End with a tender, gentle question that lets them share more if they want to, without any pressure."
    )


def _call_gemini(
    user_message: str,
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
    ml_anomaly: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Any]] = None,
) -> Optional[str]:
    """Call Google Gemini API with conversational history and empathetic grounding."""
    if not settings.GEMINI_API_KEY:
        return None

    system_instruction = _build_companion_system_instruction(
        entries=entries,
        ml_trend=ml_trend,
        ml_cluster=ml_cluster,
    )

    contents: List[Dict[str, Any]] = []
    history_items = conversation_history or []
    for m in history_items[-8:]:
        role = getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")
        content = getattr(m, "content", "") if not isinstance(m, dict) else m.get("content", "")
        if not content:
            continue
        g_role = "model" if role in ["assistant", "therapist", "model"] else "user"

        if contents and contents[-1]["role"] == g_role:
            contents[-1]["parts"][0]["text"] += f"\n{content}"
        else:
            contents.append({"role": g_role, "parts": [{"text": content}]})

    if contents and contents[0]["role"] == "model":
        contents.pop(0)

    if contents and contents[-1]["role"] == "user":
        contents[-1]["parts"][0]["text"] += f"\n{user_message}"
    else:
        contents.append({"role": "user", "parts": [{"text": user_message}]})

    payload = {
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.85,
            "maxOutputTokens": 600,
        },
    }

    models_to_attempt = [settings.GEMINI_MODEL]
    if settings.GEMINI_MODEL != "gemini-flash-lite-latest":
        models_to_attempt.append("gemini-flash-lite-latest")

    for model_name in models_to_attempt:
        url = f"{settings.GEMINI_URL}/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
        try:
            with httpx.Client(timeout=25.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates") or []
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and parts[0].get("text"):
                            return parts[0]["text"].strip()
                else:
                    log.warning("Gemini API error (%s) HTTP %d: %s", model_name, res.status_code, res.text[:200])
        except Exception as exc:
            log.warning("Failed to call Gemini API (%s): %s", model_name, exc)

    return None


def _call_claude(
    user_message: str,
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
    ml_anomaly: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Any]] = None,
) -> Optional[str]:
    """Call Anthropic Claude API (Sonnet/Haiku) with highest emotional nuance."""
    if not settings.ANTHROPIC_API_KEY:
        return None

    system_instruction = _build_companion_system_instruction(
        entries=entries,
        ml_trend=ml_trend,
        ml_cluster=ml_cluster,
    )

    messages: List[Dict[str, Any]] = []
    history_items = conversation_history or []
    for m in history_items[-8:]:
        role = getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")
        content = getattr(m, "content", "") if not isinstance(m, dict) else m.get("content", "")
        if not content:
            continue
        c_role = "assistant" if role in ["assistant", "therapist", "model"] else "user"
        if messages and messages[-1]["role"] == c_role:
            messages[-1]["content"] += f"\n{content}"
        else:
            messages.append({"role": c_role, "content": content})

    if messages and messages[0]["role"] == "assistant":
        messages.pop(0)

    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += f"\n{user_message}"
    else:
        messages.append({"role": "user", "content": user_message})

    payload = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": 600,
        "temperature": 0.85,
        "system": system_instruction,
        "messages": messages,
    }

    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=25.0) as client:
            res = client.post(settings.ANTHROPIC_URL, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                content_blocks = data.get("content") or []
                text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
                if text_parts:
                    return "".join(text_parts).strip()
            else:
                log.warning("Claude API error HTTP %d: %s", res.status_code, res.text[:200])
    except Exception as exc:
        log.warning("Failed to call Claude API: %s", exc)

    return None


def _call_groq(
    user_message: str,
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
    ml_anomaly: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Any]] = None,
) -> Optional[str]:
    """Call Groq API (Llama 3.3 70B) for ultra-fast, empathetic response."""
    if not settings.GROQ_API_KEY:
        return None

    system_instruction = _build_companion_system_instruction(
        entries=entries,
        ml_trend=ml_trend,
        ml_cluster=ml_cluster,
    )

    messages: List[Dict[str, Any]] = [{"role": "system", "content": system_instruction}]
    history_items = conversation_history or []
    for m in history_items[-8:]:
        role = getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")
        content = getattr(m, "content", "") if not isinstance(m, dict) else m.get("content", "")
        if not content:
            continue
        c_role = "assistant" if role in ["assistant", "therapist", "model"] else "user"
        if len(messages) > 1 and messages[-1]["role"] == c_role:
            messages[-1]["content"] += f"\n{content}"
        else:
            messages.append({"role": c_role, "content": content})

    if len(messages) > 1 and messages[-1]["role"] == "user":
        messages[-1]["content"] += f"\n{user_message}"
    else:
        messages.append({"role": "user", "content": user_message})

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": 0.85,
        "max_tokens": 600,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(settings.GROQ_URL, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                choices = data.get("choices") or []
                if choices and choices[0].get("message", {}).get("content"):
                    return choices[0]["message"]["content"].strip()
            else:
                log.warning("Groq API error HTTP %d: %s", res.status_code, res.text[:200])
    except Exception as exc:
        log.warning("Failed to call Groq API: %s", exc)

    return None


def generate_response(
    user_message: str,
    entries: List[Any],
    ml_trend: Optional[Dict[str, Any]] = None,
    ml_cluster: Optional[Dict[str, Any]] = None,
    ml_anomaly: Optional[Dict[str, Any]] = None,
    country_code: Optional[str] = None,
    conversation_history: Optional[List[Any]] = None,
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

    # Helper function to try an engine and return response if successful
    def _try_engine(engine_name: str) -> Optional[Dict[str, Any]]:
        if engine_name == "groq" and settings.GROQ_API_KEY:
            rep = _call_groq(user_message, entries, ml_trend, ml_cluster, ml_anomaly, conversation_history)
            if rep:
                return {"reply": rep, "engine": ENGINE_GROQ, "safety": safety}
        elif engine_name == "gemini" and settings.GEMINI_API_KEY:
            rep = _call_gemini(user_message, entries, ml_trend, ml_cluster, ml_anomaly, conversation_history)
            if rep:
                return {"reply": rep, "engine": ENGINE_GEMINI, "safety": safety}
        elif engine_name == "claude" and settings.ANTHROPIC_API_KEY:
            rep = _call_claude(user_message, entries, ml_trend, ml_cluster, ml_anomaly, conversation_history)
            if rep:
                return {"reply": rep, "engine": ENGINE_CLAUDE, "safety": safety}
        return None

    # Priority order based on configured COMPANION_ENGINE
    preferred = settings.COMPANION_ENGINE
    engine_order = [preferred] + [e for e in ["gemini", "groq", "claude"] if e != preferred]

    for eng in engine_order:
        result = _try_engine(eng)
        if result:
            return result

    msg_lower = user_message.lower().strip()
    clean_msg = msg_lower.rstrip("!.?")

    # ── Extract conversation history context ──
    history_items = conversation_history or []
    history_texts = []
    last_assistant_msg = ""
    for m in history_items:
        c = getattr(m, "content", "") if not isinstance(m, dict) else m.get("content", "")
        role = getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")
        if c:
            history_texts.append(c.lower())
        if role in ["assistant", "therapist"] and c:
            last_assistant_msg = c.lower()

    full_context_str = " ".join(history_texts)
    turn_count = len([m for m in history_items if (getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")) == "user"])

    # Determine ongoing topic
    if any(k in msg_lower or k in full_context_str for k in ["sleep", "insomnia", "bed", "circadian", "awake", "nightmare"]):
        active_topic = "sleep"
    elif any(k in msg_lower or k in full_context_str for k in ["work", "job", "boss", "exam", "study", "deadline", "burnout"]):
        active_topic = "work"
    elif any(k in msg_lower or k in full_context_str for k in ["relationship", "partner", "friend", "fight", "argued", "breakup", "lonely"]):
        active_topic = "relationship"
    elif any(k in msg_lower or k in full_context_str for k in ["anxious", "anxiety", "panic", "worry", "spiral", "nervous"]):
        active_topic = "anxiety"
    elif any(k in msg_lower or k in full_context_str for k in ["sad", "depress", "crying", "grief", "hopeless", "hurting"]):
        active_topic = "sadness"
    else:
        active_topic = "general"

    # ── Compute basic stats safely ──
    avg_mood = round(sum(e.mood_score for e in entries) / len(entries), 1) if entries else 7.0
    latest = entries[0] if entries else None
    latest_mood = latest.mood_score if latest else None
    latest_emotion = getattr(latest, "primary_emotion", "Reflective") if latest else "Reflective"

    # ── Route by dynamic conversational intents ──

    # 1. Greetings
    if clean_msg in [
        "hi", "hello", "hey", "hola", "sup", "good morning", "good afternoon",
        "good evening", "greetings", "howdy"
    ] or any(msg_lower.startswith(w) for w in ["hi ", "hello ", "hey "]):
        if latest_mood is not None:
            greetings = [
                f"Hello! It's so nice to hear from you. Your latest check-in showed a mood of {latest_mood}/10 ({latest_emotion}). How has today been treating your mind and body?",
                f"Hey there! I'm glad you stopped by to check in. I'm holding space for you today. What's on your mind right now?",
                f"Good to see you! Based on your recent entries, you've been averaging a {avg_mood}/10 mood. How are you feeling in this exact moment?"
            ]
        else:
            greetings = [
                "Hello! It's great to connect with you. I'm your SoulSync AI Companion. How is your day going so far?",
                "Hey there! I'm here to listen, support, and help you reflect. What's on your mind right now?",
                "Welcome! Whether you want to talk through a challenge, try a calming exercise, or simply chat, I'm right here with you. How are you feeling today?"
            ]
    past_replies = [
        (getattr(m, "content", "") if not isinstance(m, dict) else m.get("content", "")).lower()
        for m in history_items
        if (getattr(m, "role", "") if not isinstance(m, dict) else m.get("role", "")) in ["assistant", "therapist"]
    ]

    def is_already_sent(snippet: str) -> bool:
        norm = snippet.strip().lower()[:45]
        return any(norm in p for p in past_replies)

    # 1. Greetings
    if clean_msg in [
        "hi", "hello", "hey", "hola", "sup", "good morning", "good afternoon",
        "good evening", "greetings", "howdy"
    ] or any(msg_lower.startswith(w) for w in ["hi ", "hello ", "hey "]):
        greetings = [
            "Hey, I'm really glad you reached out today. How are you really doing right now?",
            "Hi there! Whatever kind of day you're having, you can let your guard down here. What's on your heart today?",
            "Good to see you. I'm right here with you. How has today felt on your end?"
        ]
        reply = random.choice([g for g in greetings if not is_already_sent(g)] or greetings)

    # 2. Breathing / Guided Meditation
    elif any(w in msg_lower for w in ["breathe", "breathing", "meditat", "grounding", "relax me", "calm down", "guide me"]):
        if is_already_sent("Let's slow everything down together"):
            reply = (
                "Let's gently reset together with a soft rhythm:\n\n"
                "• **Inhale** slowly for **4 counts**...\n"
                "• **Hold** that calm breath for **4 counts**...\n"
                "• **Exhale** smoothly and let everything go for **4 counts**...\n"
                "• **Rest empty** for **4 counts**.\n\n"
                "Notice your shoulders naturally falling away from your ears. How does your chest feel right now?"
            )
        else:
            reply = (
                "Let's slow everything down together right now. You don't have to rush:\n\n"
                "1. Breathe in softly through your nose for **4 seconds**...\n"
                "2. Hold it gently for **7 seconds**...\n"
                "3. Let it all sigh out through your mouth for **8 seconds**...\n\n"
                "Unclench your jaw and let your body soften. I'm right here. How does that feel?"
            )

    # 3. Sadness / Grief / Crying / Heartbreak
    elif any(w in msg_lower for w in ["sad", "depress", "crying", "cry", "heartbreak", "hurting", "lost", "grief", "hopeless", "down", "terrible", "bad day"]):
        if is_already_sent("I'm so sorry things are hurting"):
            reply = (
                "I am right here with you. You don't need to explain yourself, justify your tears, or force a smile. "
                "Sometimes the bravest, kindest thing you can do is just let yourself feel what you feel without judgment. "
                "Can you wrap yourself in something warm or take a quiet moment just for you?"
            )
        else:
            reply = (
                "I'm so sorry things are hurting and feeling this heavy right now. "
                "Please know you don't have to carry this all alone or pretend everything is okay here.\n\n"
                "Give yourself permission to just be. Do you want to talk through what's hurting, or would you rather we just sit quietly together for a little while?"
            )

    # 4. Conflict / Relationships / Arguments
    elif any(w in msg_lower for w in ["fight", "argued", "argument", "friend", "partner", "boyfriend", "girlfriend", "breakup", "relationship", "family", "parents"]):
        if is_already_sent("Conflict with people we care about"):
            reply = (
                "When someone acts harshly or defensively toward us, it usually reflects their own unhealed pain or limits, "
                "not your worth as a person. Take a deep breath. What kind of space or boundary would protect your peace right now?"
            )
        else:
            reply = (
                "Conflict with people we care about can leave such an exhausting, heavy ache in your chest. "
                "It's so easy to keep replaying every single word in your head.\n\n"
                "Take a slow breath first. You don't have to fix everything or figure out all the answers this second. "
                "How is your heart holding up after what happened?"
            )

    # 5. Overthinking / Anxiety / Worry / Panic
    elif any(w in msg_lower for w in ["overthink", "anxious", "anxiety", "panic", "worry", "scared", "nervous", "spiral"]):
        if is_already_sent("When worries start spinning"):
            reply = (
                "Let's gently anchor your senses right now: look around and notice 3 colors you love, "
                "feel the weight of your feet resting on the ground, and let out one long, deep sigh. "
                "You are safe in this physical moment. What thought is circling the loudest right now?"
            )
        else:
            reply = (
                "Hey, let's take all the pressure off for a moment. When worries start spinning, your mind tries to solve every imaginary scenario all at once.\n\n"
                "Drop your shoulders, unclamp your jaw, and take one slow breath with me. "
                "You don't have to carry tomorrow right now. What's the main worry that's weighing on you the most?"
            )

    # 6. Burnout / Work / Study / Exams / Exhaustion
    elif any(w in msg_lower for w in ["work", "job", "boss", "exam", "college", "school", "study", "deadline", "burnout", "tired", "exhausted", "drained"]):
        if is_already_sent("You sound so deeply tired"):
            reply = (
                "When a pile of work feels like an impossible mountain, shrinking it down is the kindest way forward. "
                "What is one tiny, 2-minute step you can take — or even better, what is one non-urgent thing you can give yourself permission to ignore today?"
            )
        else:
            reply = (
                "You sound so deeply tired, and it makes complete sense why. You've been carrying so much on your shoulders for so long.\n\n"
                "Please remember: rest isn't a reward you have to earn by working yourself to the bone. You need it simply because you are human. "
                "Can you step away for even 5 or 10 quiet minutes and let your mind rest?"
            )

    # 7. Sleep / Insomnia
    elif any(w in msg_lower for w in ["sleep", "rest", "insomnia", "can't sleep", "cant sleep", "awake", "nightmare", "wake"]):
        if any(w in msg_lower for w in ["wake", "3am", "4am", "middle"]):
            reply = (
                "Waking up in the middle of the night can feel so lonely and frustrating. "
                "Try not to check the clock or your phone — watching the minutes tick by only tells your brain to stay awake. "
                "Keep your eyes closed, breathe slowly, and gently remind yourself: simply lying still and resting quietly is still giving your body deep restoration."
            )
        elif is_already_sent("Sleep can be so elusive"):
            reply = (
                "Before bed tonight, try getting a physical notebook and writing out every swirling thought so your head doesn't have to keep holding it all night. "
                "What's been keeping your mind so busy when your head hits the pillow?"
            )
        else:
            reply = (
                "Sleep can be so elusive when your thoughts are running in circles. "
                "You're not alone in struggling with this. What has been weighing on your mind tonight?"
            )

    # 8. Affirmative prompts & follow-ups with contextual memory
    elif clean_msg in ["yes", "sure", "ok", "okay", "yeah", "yep", "please", "yes please", "tell me", "explore", "go ahead", "right", "i agree", "will do"]:
        if active_topic == "sleep":
            reply = (
                "Let's focus on a concrete bedtime ritual tonight: dim your lights 30 minutes before sleep, "
                "keep your phone outside arms-reach, and try listening to deep delta frequencies or 4-7-8 breathing. "
                "How does that routine sound for tonight?"
            )
        elif active_topic == "work":
            reply = (
                "Taking intentional pauses is essential for sustainable focus. Let's aim for a 25-minute deep work sprint, "
                "followed by 5 minutes completely away from your monitor. What specific task would you like to focus on first?"
            )
        elif active_topic == "anxiety":
            reply = (
                "Wonderful. Notice how your body responded to that pause. Even three conscious, deep belly breaths "
                "signal safety to your vagus nerve. Would you like to do another grounding exercise, or talk through what sparked the tension?"
            )
        elif active_topic == "relationship":
            reply = (
                "Grounding your boundaries while staying compassionate is powerful. Before speaking or messaging, "
                "take a slow breath and ask yourself: 'What is my core need right now?' Would you like to draft what you want to communicate?"
            )
        else:
            reply = (
                f"Here are personalized recommendations based on your check-in trends (average mood: {avg_mood}/10):\n\n"
                + _recommendation_response(entries, avg_mood, ml_trend)
                + "\n\nWould you like to look at your sleep correlations or dive into your Digital Twin profile?"
            )

    # 9. Frustration / Resistance / Feeling stuck
    elif any(w in msg_lower for w in ["tried that", "doesn't work", "doesnt work", "hate this", "pointless", "annoyed", "useless", "stuck", "frustrated"]):
        reply = (
            "I completely hear your frustration. When you're already carrying so much stress, standard advice can feel hollow or exhausting. "
            "You don't have to force yourself to do anything right now. Let's take off all the pressure. "
            "If you could set aside expectations for the next hour, what would bring you even a tiny moment of comfort or relief?"
        )

    # 10. Curiosity / Inquiring / "Why"
    elif msg_lower in ["why", "why?", "how so?", "how does that work?", "what do you mean?"] or msg_lower.startswith("why ") or msg_lower.startswith("how come"):
        if active_topic == "sleep":
            reply = (
                "When we don't get enough sleep, everything in life feels magnified. "
                "Small frustrations suddenly feel like huge mountains, and our emotional bandwidth drops. "
                "It's not a personal flaw — your inner battery is simply depleted. How has your sleep been feeling lately?"
            )
        elif active_topic == "work":
            reply = (
                "Juggling so many tasks leaves our minds constantly buzzing in the background. "
                "It drains our mental energy before we even realize it. Taking small, quiet breathers throughout the day isn't being lazy — it's how you protect yourself from burning out."
            )
        else:
            reply = (
                "Our minds and bodies are in constant conversation. When we feel overwhelmed or tense, "
                "our muscles tighten and our thoughts start anticipating danger, which makes us feel even more anxious. "
                "Just pausing and giving your feelings space without fighting them helps interrupt that tension."
            )

    # 11. Negative / dismissal
    elif clean_msg in ["no", "nope", "not now", "nah", "later"]:
        reply = "I understand completely. There's no pressure at all. I'm right here whenever you need me. Take gentle care of yourself."

    # 12. Gratitude / thanks
    elif any(w in msg_lower for w in ["thank", "thx", "appreciate"]):
        reply = "You're so welcome. I'm really glad to be here with you. Thank you for trusting me with your thoughts today."

    # 13. Mood / feelings inquiry
    elif any(w in msg_lower for w in ["mood", "feeling", "how am i", "how do i"]):
        reply = _mood_response(entries, avg_mood, latest, ml_trend)

    # 14. Patterns / trends / insights
    elif any(w in msg_lower for w in ["pattern", "trend", "insight", "notice", "correlation"]):
        reply = _pattern_response(entries, ml_trend, ml_cluster)

    # 15. Digital twin / cluster
    elif any(w in msg_lower for w in ["twin", "cluster", "profile", "type", "archetype"]):
        reply = _twin_response(entries, ml_cluster)

    # 16. Anomaly / unusual
    elif any(w in msg_lower for w in ["anomal", "unusual", "different", "weird", "strange"]):
        reply = _anomaly_response(entries, ml_anomaly)

    # 17. Recommendations / suggestions
    elif any(w in msg_lower for w in ["recommend", "suggest", "advice", "help", "what should"]):
        reply = _recommendation_response(entries, avg_mood, ml_trend)

    # 18. Gratitude practice
    elif any(w in msg_lower for w in ["grateful", "thankful", "positive"]):
        reply = _gratitude_response(entries, avg_mood)

    # 19. Context-aware synthesis
    else:
        if active_topic != "general" and turn_count >= 1:
            reply = (
                f"I really hear what you're saying about this. "
                f"It sounds like it's taking a real emotional toll on you right now. "
                f"How are you feeling in your body as you talk about it?"
            )
        else:
            reply = (
                "I hear you, and it makes complete sense that you'd feel that way. "
                "Tell me more about what's going through your mind — I'm right here listening."
            )

    # Strict Anti-Loop Deduplication Guarantee
    if is_already_sent(reply) or not reply.strip():
        reply = "I'm right here with you. What feels like the most supportive thing for your mind right now?"

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
    if not entries or latest is None:
        return "You haven't logged any check-ins yet. As soon as you record your first daily check-in or journal entry, I'll calculate your emotional trajectory and mood averages."

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
