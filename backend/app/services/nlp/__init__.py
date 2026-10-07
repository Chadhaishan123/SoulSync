"""
NLP analysis service.

Two engines:
  1. **Transformer** (DistilBERT) — used when `transformers` is installed.
     Produces proper emotion classification and sentiment scoring.
  2. **Lexicon** — keyword-counting fallback. Always available, no downloads.

Both record their engine name honestly so the UI never claims a transformer
result when a lexicon ran. Crisis safety runs **before** either engine.
"""

from __future__ import annotations

import logging
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.safety import assess as safety_assess

log = logging.getLogger("soulsync.nlp")

# ─────────────────────────────── SoulSync emotion vocabulary
# Every engine reports these six labels so the UI, DB and companion all
# speak the same language regardless of which model produced the result.

SOULSYNC_EMOTIONS: List[str] = ["Happy", "Sad", "Anxious", "Angry", "Calm", "Neutral"]

# Maps labels from any supported model onto the SoulSync vocabulary.
# - Our fine-tuned model already emits the six SoulSync labels.
# - bhadresh-savani/distilbert-base-uncased-emotion emits
#   joy / sadness / anger / fear / love / surprise.
_LABEL_ALIASES: Dict[str, str] = {
    "happy": "Happy", "joy": "Happy", "love": "Happy",
    "sad": "Sad", "sadness": "Sad",
    "anxious": "Anxious", "fear": "Anxious",
    "angry": "Angry", "anger": "Angry",
    "calm": "Calm",
    "neutral": "Neutral", "surprise": "Neutral",
}


def _to_soulsync_emotions(raw: Dict[str, float]) -> Dict[str, float]:
    """Collapse a model's label distribution onto the six SoulSync labels."""
    out = {label: 0.0 for label in SOULSYNC_EMOTIONS}
    for label, score in raw.items():
        out[_LABEL_ALIASES.get(label.lower(), "Neutral")] += float(score)
    total = sum(out.values())
    if total > 0:
        out = {k: v / total for k, v in out.items()}
    return {k: round(v, 3) for k, v in out.items()}


# ─────────────────────────────── Try loading transformers

_transformer_available = False
_emotion_pipeline = None
_sentiment_pipeline = None
_emotion_model_name: Optional[str] = None

try:
    from transformers import pipeline as hf_pipeline

    _transformer_available = True
    log.info("Transformers library available — will load models on first use.")
except ImportError:
    log.info("Transformers not installed — using lexicon-based analysis.")

# Real DistilBERT weights are ~268 MB; anything tiny is a placeholder or a
# file truncated/quarantined by antivirus.
_MIN_WEIGHTS_BYTES = 1_000_000


def _resolve_emotion_model(configured: str, fallback: str) -> str:
    """
    Return the model id/path to load.

    `configured` may be a Hub id ("org/name") or a local directory, with
    env vars like %USERPROFILE% or ~ expanded. A local directory is only
    used if it holds a config and real weights; otherwise we fall back.
    """
    expanded = os.path.expanduser(os.path.expandvars(configured))
    is_local = (
        os.path.isabs(expanded)
        or expanded.startswith(".")
        or "\\" in expanded
        or expanded != configured
    )
    if not is_local:
        return configured

    path = Path(expanded)
    weights = [path / "model.safetensors", path / "pytorch_model.bin"]
    has_weights = any(w.is_file() and w.stat().st_size > _MIN_WEIGHTS_BYTES for w in weights)
    if path.is_dir() and (path / "config.json").is_file() and has_weights:
        return str(path)

    log.warning(
        "Local emotion model at %s is missing or incomplete — using fallback %s",
        path, fallback,
    )
    return fallback


def _build_emotion_pipeline(model: str):
    return hf_pipeline(
        "text-classification",
        model=model,
        top_k=None,
        truncation=True,
        max_length=512,
    )


def _load_transformer_models() -> bool:
    """Lazy-load transformer models on first analysis call."""
    global _emotion_pipeline, _sentiment_pipeline, _emotion_model_name

    if _emotion_pipeline is not None:
        return True

    try:
        from app.core.config import settings

        fallback = settings.EMOTION_MODEL_FALLBACK
        model = _resolve_emotion_model(settings.EMOTION_MODEL, fallback)
        log.info("Loading emotion model: %s", model)
        try:
            _emotion_pipeline = _build_emotion_pipeline(model)
        except Exception:
            if model == fallback:
                raise
            log.exception("Failed to load %s — trying fallback %s", model, fallback)
            model = fallback
            _emotion_pipeline = _build_emotion_pipeline(model)
        _emotion_model_name = (
            "soulsync-emotion-classifier" if model != fallback and os.path.isdir(model) else model
        )

        log.info("Loading sentiment model: %s", settings.SENTIMENT_MODEL)
        _sentiment_pipeline = hf_pipeline(
            "sentiment-analysis",
            model=settings.SENTIMENT_MODEL,
            truncation=True,
            max_length=512,
        )

        log.info("Transformer models loaded successfully.")
        return True
    except Exception:
        log.exception("Failed to load transformer models — falling back to lexicon.")
        return False


# ─────────────────────────────── Transformer analyzer

def _analyze_transformer(text: str) -> Dict[str, Any]:
    """Full transformer-based analysis."""
    start = time.perf_counter_ns()

    if not _load_transformer_models():
        return _analyze_lexicon(text)

    # Emotion classification
    emotion_results = _emotion_pipeline(text[:512])
    # top_k=None may return [[...]] or [...] depending on transformers version
    if emotion_results and isinstance(emotion_results[0], list):
        emotion_results = emotion_results[0]
    emotions = _to_soulsync_emotions({r["label"]: r["score"] for r in emotion_results})
    dominant = max(emotions, key=emotions.get)  # type: ignore
    dominant_score = emotions[dominant]

    # Sentiment
    sentiment_result = _sentiment_pipeline(text[:512])[0]
    sent_label = sentiment_result["label"].lower()
    sent_confidence = round(sentiment_result["score"], 3)

    # Map POSITIVE/NEGATIVE to -1..+1 score
    if sent_label == "positive":
        sentiment_score = round(sent_confidence, 3)
    elif sent_label == "negative":
        sentiment_score = round(-sent_confidence, 3)
    else:
        sentiment_score = 0.0

    # Keywords via simple frequency (TF-IDF would be ideal but adds deps)
    keywords = _extract_keywords(text)

    # Themes
    themes = _extract_themes(text)

    # Summary
    summary = _extract_summary(text)

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    from app.core.config import settings

    return {
        "sentiment_score": sentiment_score,
        "sentiment_label": sent_label,
        "sentiment_confidence": sent_confidence,
        "emotions": emotions,
        "dominant_emotion": dominant,
        "dominant_emotion_score": dominant_score,
        "keywords": keywords,
        "themes": themes,
        "summary": summary,
        "engine": "transformer",
        "model_version": f"{_emotion_model_name} + {settings.SENTIMENT_MODEL}",
        "processing_ms": elapsed,
    }


# ─────────────────────────────── Lexicon analyzer (fallback)

POSITIVE_WORDS = {
    "happy", "joy", "great", "good", "wonderful", "amazing", "love", "excited",
    "grateful", "blessed", "peaceful", "calm", "relaxed", "content", "cheerful",
    "optimistic", "hopeful", "proud", "inspired", "motivated", "energetic",
    "confident", "satisfied", "thankful", "delighted", "fantastic", "excellent",
    "beautiful", "fun", "smile", "laugh", "comfortable", "safe", "strong",
}

NEGATIVE_WORDS = {
    "sad", "angry", "anxious", "stressed", "worried", "depressed", "frustrated",
    "lonely", "tired", "exhausted", "overwhelmed", "scared", "afraid", "nervous",
    "hurt", "pain", "terrible", "awful", "horrible", "miserable", "upset",
    "annoyed", "irritated", "helpless", "hopeless", "guilty", "ashamed",
    "disappointed", "lost", "confused", "numb", "empty", "broken", "cry",
}

EMOTION_KEYWORDS: Dict[str, List[str]] = {
    "Happy": ["happy", "joy", "great", "good", "wonderful", "excited", "delighted", "cheerful", "fun",
              "love", "grateful", "thankful", "blessed", "proud", "amazing", "smiling"],
    "Sad": ["sad", "depressed", "depressing", "depression", "lonely", "miserable", "cry", "crying",
            "empty", "heartbroken", "hopeless", "down", "unhappy", "gloomy", "grief", "sorrow", "hurt", "awful"],
    "Anxious": ["anxious", "worried", "nervous", "stressed", "overwhelmed", "panic", "fear", "scared", "tense", "dread"],
    "Angry": ["angry", "frustrated", "annoyed", "irritated", "furious", "rage", "mad", "hate"],
    "Calm": ["calm", "peaceful", "relaxed", "content", "serene", "rested", "balanced", "chill", "zen"],
}

EMOTION_PREFIXES: Dict[str, tuple[str, ...]] = {
    "Sad": ("depress", "sad", "lone", "grief", "sorrow", "miser", "unhapp", "crying", "heartbreak", "hopeless", "gloom"),
    "Anxious": ("anxi", "nervous", "stress", "worr", "panic", "fear", "scare", "fright", "overwhelm", "tense"),
    "Angry": ("angr", "furious", "mad", "frustrat", "annoy", "irritat", "rage", "hate"),
    "Happy": ("happ", "joy", "delight", "excit", "cheer", "great", "wonder", "amaz", "love", "bless", "grate", "thank"),
    "Calm": ("calm", "relax", "peace", "seren", "rested", "chill", "zen", "tranquil"),
}


THEME_KEYWORDS: Dict[str, List[str]] = {
    "work": ["work", "job", "office", "meeting", "deadline", "project", "boss", "colleague"],
    "relationships": ["friend", "family", "partner", "love", "relationship", "social"],
    "health": ["health", "exercise", "gym", "sick", "doctor", "sleep", "diet", "body"],
    "self-care": ["meditation", "yoga", "journal", "therapy", "rest", "break", "relax"],
    "growth": ["learn", "goal", "progress", "improve", "achieve", "challenge", "growth"],
}

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their", "this", "that",
    "and", "but", "or", "not", "no", "so", "if", "of", "in", "on",
    "at", "to", "for", "with", "by", "from", "up", "about", "into",
    "just", "really", "very", "much", "more", "than", "then", "also",
    "like", "get", "got", "go", "going", "went", "feel", "feeling",
    "felt", "think", "thought", "know", "knew", "day", "today", "time",
    "thing", "things", "lot", "make", "made",
}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z']+", text.lower())


def _extract_keywords(text: str, top_n: int = 5) -> List[str]:
    words = _tokenize(text)
    filtered = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return [w for w, _ in Counter(filtered).most_common(top_n)]


def _extract_themes(text: str) -> List[str]:
    words = set(_tokenize(text))
    return [theme for theme, kws in THEME_KEYWORDS.items() if words & set(kws)]


def _extract_summary(text: str) -> Optional[str]:
    words = _tokenize(text)
    if len(words) <= 30:
        return None
    sentences = re.split(r"[.!?]+", text.strip())
    if len(sentences) > 1:
        summary = sentences[0].strip()
        return summary[:197] + "..." if len(summary) > 200 else summary
    return None


def _analyze_lexicon(text: str) -> Dict[str, Any]:
    """Keyword-counting analysis — always available."""
    start = time.perf_counter_ns()

    words = _tokenize(text)
    word_count = len(words)

    if word_count == 0:
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "sentiment_score": 0.0, "sentiment_label": "neutral",
            "sentiment_confidence": 1.0,
            "emotions": _to_soulsync_emotions({"Neutral": 1.0}),
            "dominant_emotion": "Neutral", "dominant_emotion_score": 1.0,
            "keywords": [], "themes": [], "summary": None,
            "engine": "lexicon", "model_version": "lexicon-v1",
            "processing_ms": elapsed,
        }

    neg_prefixes = ("depress", "sad", "lone", "miser", "angr", "anxi", "stress", "worr", "panic", "fear", "hurt", "terribl", "awful", "horribl")
    pos_prefixes = ("happ", "joy", "delight", "excit", "wonder", "amaz", "grate", "thank", "bless", "peace", "relax", "calm", "good")

    pos_count = sum(1 for w in words if w in POSITIVE_WORDS or any(w.startswith(p) for p in pos_prefixes))
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS or any(w.startswith(p) for p in neg_prefixes))
    total_signal = pos_count + neg_count

    sentiment_score = round((pos_count - neg_count) / total_signal, 3) if total_signal > 0 else 0.0
    sentiment_confidence = round(min(total_signal / max(word_count * 0.1, 1), 1.0), 3)
    sentiment_label = "positive" if sentiment_score > 0.2 else ("negative" if sentiment_score < -0.2 else "neutral")

    # Emotions
    emotion_scores: Dict[str, float] = {}
    for emotion, kws in EMOTION_KEYWORDS.items():
        prefixes = EMOTION_PREFIXES.get(emotion, ())
        hits = sum(1 for w in words if w in kws or any(w.startswith(p) for p in prefixes))
        if hits > 0:
            emotion_scores[emotion] = round(hits / max(word_count * 0.05, 1), 3)
    if not emotion_scores:
        emotion_scores = {"Neutral": 1.0}

    emotion_scores = _to_soulsync_emotions(emotion_scores)

    dominant = max(emotion_scores, key=emotion_scores.get)  # type: ignore
    dominant_score = emotion_scores[dominant]

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    return {
        "sentiment_score": sentiment_score,
        "sentiment_label": sentiment_label,
        "sentiment_confidence": sentiment_confidence,
        "emotions": emotion_scores,
        "dominant_emotion": dominant,
        "dominant_emotion_score": dominant_score,
        "keywords": _extract_keywords(text),
        "themes": _extract_themes(text),
        "summary": _extract_summary(text),
        "engine": "lexicon",
        "model_version": "lexicon-v1",
        "processing_ms": elapsed,
    }


# ─────────────────────────────── Public API

def analyze_text(text: str, country_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze text for sentiment, emotion, themes, and safety.

    Safety check runs FIRST. If crisis-level content is detected, the
    analysis still completes but `safety_level` is set accordingly.
    """
    # Safety check BEFORE analysis
    safety = safety_assess(text, country_code)
    safety_level = safety["level"]

    # Choose engine
    if _transformer_available:
        from app.core.config import settings
        if settings.ENABLE_TRANSFORMER_NLP:
            result = _analyze_transformer(text)
        else:
            result = _analyze_lexicon(text)
    else:
        result = _analyze_lexicon(text)

    result["safety_level"] = safety_level

    if safety["interrupt"]:
        result["safety_message"] = safety["message"]
        result["safety_resources"] = safety["resources"]

    return result
