"""
ML service facade.

Single import point for all ML capabilities. Handles errors gracefully —
a failing model never takes down the API; it degrades to a documented
fallback and logs the failure.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger("soulsync.ml")


def predict_trend(entries: List[Any]) -> Dict[str, Any]:
    """Predict mood trend from check-in history."""
    try:
        from app.services.ml.trend_predictor import predict_trend as _predict
        return _predict(entries)
    except Exception:
        log.exception("Trend prediction failed — returning default")
        return {
            "direction": "stable",
            "confidence": 0.0,
            "explanation": "Trend prediction is temporarily unavailable.",
            "is_model_backed": False,
            "features": {},
            "avg_recent": None,
            "avg_prior": None,
            "input_row_count": len(entries),
            "computed_ms": 0,
            "model_name": "error_fallback",
        }


def cluster_user(entries: List[Any]) -> Dict[str, Any]:
    """Cluster user's check-in history into behavioral patterns."""
    try:
        from app.services.ml.clustering import cluster_user as _cluster
        return _cluster(entries)
    except Exception:
        log.exception("Clustering failed — returning default")
        return {
            "current_pattern": "Balanced",
            "total_days": len(entries),
            "clusters": {"Balanced": len(entries)},
            "centroids": {},
            "is_model_backed": False,
            "input_row_count": len(entries),
            "computed_ms": 0,
            "model_name": "error_fallback",
        }


def detect_anomalies(entries: List[Any]) -> Dict[str, Any]:
    """Check if the latest entry is anomalous."""
    try:
        from app.services.ml.anomaly_detector import detect_anomalies as _detect
        return _detect(entries)
    except Exception:
        log.exception("Anomaly detection failed — returning default")
        return {
            "is_anomaly": False,
            "anomaly_score": None,
            "explanation": "Anomaly detection is temporarily unavailable.",
            "metric": None,
            "value": None,
            "is_model_backed": False,
            "input_row_count": len(entries),
            "computed_ms": 0,
            "model_name": "error_fallback",
        }


def discover_patterns(
    entries: List[Any],
    sleep_records: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """Discover statistical patterns in user's data."""
    try:
        from app.services.ml.pattern_discovery import discover_patterns as _discover
        return _discover(entries, sleep_records)
    except Exception:
        log.exception("Pattern discovery failed — returning default")
        return {
            "patterns": [],
            "is_sufficient": False,
            "input_row_count": len(entries),
            "computed_ms": 0,
            "message": "Pattern discovery is temporarily unavailable.",
        }
