"""
Anomaly detection using Isolation Forest.

Flags check-ins that are statistically unusual compared to the user's
established patterns. An anomaly is not necessarily bad — a sudden jump
to mood 10 after weeks of 5 is worth surfacing too.

Minimum: 10 check-ins. Below that, uses z-score fallback.
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any, Dict, List

import numpy as np
from sklearn.ensemble import IsolationForest

log = logging.getLogger("soulsync.ml.anomaly")

MIN_ENTRIES = 10
FEATURE_COLS = ["mood_score", "stress_level", "energy_level", "sleep_quality"]


def detect_anomalies(entries: List[Any]) -> Dict[str, Any]:
    """
    Check if the latest entry is anomalous.

    Returns:
        is_anomaly:       True if the latest entry is flagged
        anomaly_score:    Isolation Forest decision score (negative = more anomalous)
        explanation:      human-readable string
        metric:           which metric is most unusual
        value:            the unusual value
        is_model_backed:  True if Isolation Forest ran
        input_row_count:  how many entries
        computed_ms:      wall-clock time
    """
    start = time.perf_counter_ns()

    if len(entries) < 3:
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "is_anomaly": False,
            "anomaly_score": None,
            "explanation": "Not enough data for anomaly detection.",
            "metric": None,
            "value": None,
            "is_model_backed": False,
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "none",
        }

    # Build feature matrix
    X = []
    for e in entries:
        X.append([
            e.mood_score,
            e.stress_level if e.stress_level is not None else 5,
            e.energy_level if e.energy_level is not None else 5,
            e.sleep_quality if e.sleep_quality is not None else 5,
        ])
    X = np.array(X, dtype=float)
    latest = X[-1]

    # Z-score fallback for small datasets
    if len(entries) < MIN_ENTRIES:
        means = X.mean(axis=0)
        stds = X.std(axis=0)
        stds[stds == 0] = 1.0

        z_scores = np.abs(latest - means) / stds
        max_z_idx = int(np.argmax(z_scores))
        max_z = float(z_scores[max_z_idx])

        is_anomaly = max_z > 2.0
        metric_name = FEATURE_COLS[max_z_idx]

        if is_anomaly:
            direction = "higher" if latest[max_z_idx] > means[max_z_idx] else "lower"
            explanation = (
                f"Your {metric_name.replace('_', ' ')} ({latest[max_z_idx]:.0f}) "
                f"is significantly {direction} than your average "
                f"({means[max_z_idx]:.1f}). Z-score: {max_z:.1f}."
            )
        else:
            explanation = "No unusual patterns detected in your latest check-in."

        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": round(max_z, 3),
            "explanation": explanation,
            "metric": metric_name if is_anomaly else None,
            "value": float(latest[max_z_idx]) if is_anomaly else None,
            "z_scores": {FEATURE_COLS[i]: round(float(z_scores[i]), 2) for i in range(len(FEATURE_COLS))},
            "is_model_backed": False,
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "z_score",
        }

    # ── Isolation Forest ──
    iso = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    iso.fit(X)

    # Score the latest entry
    decision = float(iso.decision_function(latest.reshape(1, -1))[0])
    prediction = int(iso.predict(latest.reshape(1, -1))[0])
    is_anomaly = prediction == -1

    # Find which metric is most unusual via z-scores
    means = X[:-1].mean(axis=0)
    stds = X[:-1].std(axis=0)
    stds[stds == 0] = 1.0
    z_scores = np.abs(latest - means) / stds
    max_z_idx = int(np.argmax(z_scores))
    metric_name = FEATURE_COLS[max_z_idx]

    if is_anomaly:
        direction = "higher" if latest[max_z_idx] > means[max_z_idx] else "lower"
        explanation = (
            f"Your latest check-in is unusual. Your {metric_name.replace('_', ' ')} "
            f"({latest[max_z_idx]:.0f}) is {direction} than typical "
            f"(avg: {means[max_z_idx]:.1f}). Anomaly score: {decision:.2f}."
        )
    else:
        explanation = "Your latest check-in falls within your normal patterns."

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    return {
        "is_anomaly": is_anomaly,
        "anomaly_score": round(decision, 3),
        "explanation": explanation,
        "metric": metric_name if is_anomaly else None,
        "value": float(latest[max_z_idx]) if is_anomaly else None,
        "z_scores": {FEATURE_COLS[i]: round(float(z_scores[i]), 2) for i in range(len(FEATURE_COLS))},
        "is_model_backed": True,
        "input_row_count": len(entries),
        "computed_ms": elapsed,
        "model_name": "IsolationForest",
        "contamination": 0.1,
    }
