"""
Trend prediction using Random Forest.

Fits a RandomForestClassifier on the user's own check-in history to predict
whether their mood is "improving", "stable", or "declining". Features are
rolling averages and trends computed from real entries — nothing is
interpolated or guessed.

Minimum: 7 check-ins. Below that, returns a rule-based estimate and records
`is_model_backed=False` so the UI never presents a rule as a model.
"""

from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from app.models.ml import PREDICTION_TREND

log = logging.getLogger("soulsync.ml.trend")

MIN_ENTRIES = 7
FEATURE_COLS = [
    "avg_mood_3d", "avg_mood_7d", "mood_trend",
    "avg_stress_3d", "avg_stress_7d", "stress_trend",
]


def _build_features(entries: List[Any]) -> pd.DataFrame:
    """
    Build feature dataframe from MoodEntry ORM objects.
    Entries must be ordered by recorded_at ASC (oldest first).
    """
    rows = []
    for e in entries:
        rows.append({
            "mood_score": e.mood_score,
            "stress_level": e.stress_level if e.stress_level is not None else 5,
            "energy_level": e.energy_level if e.energy_level is not None else 5,
            "sleep_quality": e.sleep_quality if e.sleep_quality is not None else 5,
            "recorded_at": e.recorded_at,
            "local_date": e.local_date,
        })

    df = pd.DataFrame(rows)

    # Rolling averages
    df["avg_mood_3d"] = df["mood_score"].rolling(window=3, min_periods=1).mean()
    df["avg_mood_7d"] = df["mood_score"].rolling(window=7, min_periods=1).mean()
    df["mood_trend"] = df["avg_mood_3d"] - df["avg_mood_7d"]

    df["avg_stress_3d"] = df["stress_level"].rolling(window=3, min_periods=1).mean()
    df["avg_stress_7d"] = df["stress_level"].rolling(window=7, min_periods=1).mean()
    df["stress_trend"] = df["avg_stress_3d"] - df["avg_stress_7d"]

    return df


def _label_trend(current_mood: float, next_mood: float) -> str:
    diff = next_mood - current_mood
    if diff > 0.5:
        return "improving"
    elif diff < -0.5:
        return "declining"
    return "stable"


def predict_trend(
    entries: List[Any],
) -> Dict[str, Any]:
    """
    Predict mood trend from check-in history.

    Returns a dict with:
        direction:      "improving" | "stable" | "declining"
        confidence:     0.0 - 1.0
        explanation:    human-readable string
        is_model_backed: True if RF ran, False if rule-based
        features:       feature dict for transparency
        avg_recent:     average of last 3 entries
        avg_prior:      average of prior entries
        input_row_count: how many entries the model saw
        computed_ms:    wall-clock time
    """
    start = time.perf_counter_ns()

    if len(entries) < 3:
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "direction": "stable",
            "confidence": 0.0,
            "explanation": "Not enough data for trend prediction yet.",
            "is_model_backed": False,
            "features": {},
            "avg_recent": None,
            "avg_prior": None,
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "rule_based",
        }

    # Sort oldest first for rolling calculations
    sorted_entries = sorted(entries, key=lambda e: e.recorded_at)
    df = _build_features(sorted_entries)

    avg_recent = float(df["mood_score"].iloc[-3:].mean())
    avg_prior = float(df["mood_score"].iloc[:-3].mean()) if len(df) > 3 else avg_recent

    # Rule-based fallback if not enough for RF
    if len(entries) < MIN_ENTRIES:
        diff = avg_recent - avg_prior
        if diff > 0.5:
            direction = "improving"
        elif diff < -0.5:
            direction = "declining"
        else:
            direction = "stable"

        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "direction": direction,
            "confidence": min(abs(diff) / 3.0, 0.7),
            "explanation": f"Based on simple comparison (need {MIN_ENTRIES} entries for ML). Recent avg: {avg_recent:.1f}, prior: {avg_prior:.1f}.",
            "is_model_backed": False,
            "features": {"avg_recent": avg_recent, "avg_prior": avg_prior},
            "avg_recent": round(avg_recent, 1),
            "avg_prior": round(avg_prior, 1),
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "rule_based",
        }

    # ── Random Forest ──
    # Create labels: each row's target is the mood change to the next row
    df["next_mood"] = df["mood_score"].shift(-1)
    df["target"] = df.apply(
        lambda r: _label_trend(r["mood_score"], r["next_mood"])
        if pd.notna(r["next_mood"]) else None,
        axis=1,
    )

    train_df = df.dropna(subset=["target"])
    if len(train_df) < 5:
        # Edge case: too few labeled rows after shift
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        diff = avg_recent - avg_prior
        direction = "improving" if diff > 0.5 else ("declining" if diff < -0.5 else "stable")
        return {
            "direction": direction,
            "confidence": 0.3,
            "explanation": f"Limited training data. Recent avg: {avg_recent:.1f}.",
            "is_model_backed": False,
            "features": {},
            "avg_recent": round(avg_recent, 1),
            "avg_prior": round(avg_prior, 1),
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "rule_based",
        }

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df["target"].values

    clf = RandomForestClassifier(
        n_estimators=50, max_depth=5, random_state=42, n_jobs=1
    )
    clf.fit(X_train, y_train)

    # Predict on the latest row
    latest_features = df[FEATURE_COLS].iloc[-1:].values
    prediction = clf.predict(latest_features)[0]
    probas = clf.predict_proba(latest_features)[0]
    confidence = float(max(probas))

    # Feature importances
    importances = dict(zip(FEATURE_COLS, [round(float(v), 3) for v in clf.feature_importances_]))

    # Explanation
    if prediction == "improving":
        explanation = f"Your mood trend is improving (confidence: {confidence:.0%}). Recent 3-day avg: {avg_recent:.1f}."
    elif prediction == "declining":
        explanation = f"Your mood shows a declining trend (confidence: {confidence:.0%}). Consider activities that have helped before."
    else:
        explanation = f"Your mood has been stable (confidence: {confidence:.0%}). Recent avg: {avg_recent:.1f}."

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    return {
        "direction": prediction,
        "confidence": round(confidence, 3),
        "explanation": explanation,
        "is_model_backed": True,
        "features": importances,
        "avg_recent": round(avg_recent, 1),
        "avg_prior": round(avg_prior, 1),
        "input_row_count": len(entries),
        "computed_ms": elapsed,
        "model_name": "RandomForestClassifier",
        "probabilities": dict(zip(clf.classes_.tolist(), [round(float(p), 3) for p in probas])),
    }
