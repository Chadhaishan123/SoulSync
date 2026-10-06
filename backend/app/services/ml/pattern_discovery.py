"""
Statistical pattern discovery.

Finds correlations and lag effects in the user's own data using
Pearson/Spearman correlation. Each discovered pattern records its
statistical significance so the UI can be honest about strength.

Minimum: 14 check-ins (two weeks of daily data).
"""

from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats

log = logging.getLogger("soulsync.ml.patterns")

MIN_ENTRIES = 14


def _safe_correlation(
    x: np.ndarray, y: np.ndarray, method: str = "pearson"
) -> Tuple[Optional[float], Optional[float]]:
    """Compute correlation, returning None if data is insufficient or constant."""
    if len(x) < 5 or len(y) < 5:
        return None, None
    if np.std(x) == 0 or np.std(y) == 0:
        return None, None

    if method == "spearman":
        stat, p_val = stats.spearmanr(x, y)
    else:
        stat, p_val = stats.pearsonr(x, y)

    return float(stat), float(p_val)


def _strength_label(r: float) -> str:
    """Human-readable strength from correlation coefficient."""
    ar = abs(r)
    if ar >= 0.7:
        return "strong"
    if ar >= 0.4:
        return "moderate"
    if ar >= 0.2:
        return "weak"
    return "negligible"


def _correlation_description(
    var1: str, var2: str, r: float, p: float, lag: int = 0
) -> str:
    """Generate a human-readable description of a correlation."""
    strength = _strength_label(r)
    direction = "positive" if r > 0 else "negative"
    sig = "statistically significant" if p < 0.05 else "not yet statistically significant"

    v1 = var1.replace("_", " ")
    v2 = var2.replace("_", " ")

    if lag > 0:
        return (
            f"There is a {strength} {direction} correlation (r={r:.2f}, p={p:.3f}) "
            f"between your {v1} and {v2} the next day. "
            f"This relationship is {sig} based on your data."
        )
    return (
        f"There is a {strength} {direction} correlation (r={r:.2f}, p={p:.3f}) "
        f"between your {v1} and {v2}. "
        f"This relationship is {sig}."
    )


def discover_patterns(
    entries: List[Any],
    sleep_records: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Discover statistical patterns in user's check-in history.

    Returns:
        patterns:        list of discovered correlations
        is_sufficient:   whether we had enough data
        input_row_count: entries analyzed
        computed_ms:     wall-clock time
    """
    start = time.perf_counter_ns()

    if len(entries) < MIN_ENTRIES:
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "patterns": [],
            "is_sufficient": False,
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "message": f"Need {MIN_ENTRIES} check-ins for pattern discovery. You have {len(entries)}.",
        }

    # Sort by recorded_at ascending
    sorted_entries = sorted(entries, key=lambda e: e.recorded_at)

    mood = np.array([e.mood_score for e in sorted_entries], dtype=float)
    stress = np.array([
        e.stress_level if e.stress_level is not None else np.nan
        for e in sorted_entries
    ], dtype=float)
    energy = np.array([
        e.energy_level if e.energy_level is not None else np.nan
        for e in sorted_entries
    ], dtype=float)
    sleep_q = np.array([
        e.sleep_quality if e.sleep_quality is not None else np.nan
        for e in sorted_entries
    ], dtype=float)

    patterns = []

    # ── Same-day correlations ──
    correlations_to_check = [
        ("stress_level", "mood_score", stress, mood, "stress_mood"),
        ("energy_level", "mood_score", energy, mood, "energy_mood"),
        ("sleep_quality", "mood_score", sleep_q, mood, "sleep_quality_mood"),
    ]

    for var1_name, var2_name, arr1, arr2, pattern_type in correlations_to_check:
        # Remove NaN pairs
        mask = ~(np.isnan(arr1) | np.isnan(arr2))
        if mask.sum() < 5:
            continue

        r, p = _safe_correlation(arr1[mask], arr2[mask], method="pearson")
        if r is None:
            continue

        patterns.append({
            "pattern_type": pattern_type,
            "title": f"{var1_name.replace('_', ' ').title()} → {var2_name.replace('_', ' ').title()}",
            "description": _correlation_description(var1_name, var2_name, r, p),
            "variables": [var1_name, var2_name],
            "method": "pearson",
            "statistic": round(r, 3),
            "p_value": round(p, 4),
            "effect_size": round(r ** 2, 3),
            "lag_days": 0,
            "sample_size": int(mask.sum()),
            "strength": _strength_label(r),
            "is_significant": p < 0.05,
        })

    # ── Lag-1 correlations (today → tomorrow's mood) ──
    if len(mood) >= 7:
        # Sleep quality today → mood tomorrow
        mask_sleep = ~np.isnan(sleep_q[:-1])
        if mask_sleep.sum() >= 5:
            r, p = _safe_correlation(sleep_q[:-1][mask_sleep], mood[1:][mask_sleep])
            if r is not None:
                patterns.append({
                    "pattern_type": "sleep_mood_lag",
                    "title": "Sleep Quality → Next Day Mood",
                    "description": _correlation_description(
                        "sleep_quality", "mood_score", r, p, lag=1
                    ),
                    "variables": ["sleep_quality", "mood_score_next_day"],
                    "method": "pearson",
                    "statistic": round(r, 3),
                    "p_value": round(p, 4),
                    "effect_size": round(r ** 2, 3),
                    "lag_days": 1,
                    "sample_size": int(mask_sleep.sum()),
                    "strength": _strength_label(r),
                    "is_significant": p < 0.05,
                })

        # Stress today → mood tomorrow
        mask_stress = ~np.isnan(stress[:-1])
        if mask_stress.sum() >= 5:
            r, p = _safe_correlation(stress[:-1][mask_stress], mood[1:][mask_stress])
            if r is not None:
                patterns.append({
                    "pattern_type": "stress_mood_lag",
                    "title": "Stress Level → Next Day Mood",
                    "description": _correlation_description(
                        "stress_level", "mood_score", r, p, lag=1
                    ),
                    "variables": ["stress_level", "mood_score_next_day"],
                    "method": "pearson",
                    "statistic": round(r, 3),
                    "p_value": round(p, 4),
                    "effect_size": round(r ** 2, 3),
                    "lag_days": 1,
                    "sample_size": int(mask_stress.sum()),
                    "strength": _strength_label(r),
                    "is_significant": p < 0.05,
                })

    # ── Day-of-week effect ──
    if len(sorted_entries) >= 14:
        days = np.array([e.local_date.weekday() for e in sorted_entries], dtype=float)
        weekday_mood = mood[days < 5]
        weekend_mood = mood[days >= 5]

        if len(weekday_mood) >= 3 and len(weekend_mood) >= 3:
            t_stat, p_val = stats.ttest_ind(weekday_mood, weekend_mood)
            diff = float(weekend_mood.mean() - weekday_mood.mean())

            patterns.append({
                "pattern_type": "weekday_mood",
                "title": "Weekday vs Weekend Mood",
                "description": (
                    f"Your weekend mood averages {weekend_mood.mean():.1f} vs "
                    f"weekday {weekday_mood.mean():.1f} (diff: {diff:+.1f}). "
                    f"{'Statistically significant' if p_val < 0.05 else 'Not yet statistically significant'} "
                    f"(p={p_val:.3f})."
                ),
                "variables": ["day_of_week", "mood_score"],
                "method": "group_comparison",
                "statistic": round(float(t_stat), 3),
                "p_value": round(float(p_val), 4),
                "effect_size": round(abs(diff) / max(mood.std(), 0.01), 3),
                "lag_days": 0,
                "sample_size": len(sorted_entries),
                "strength": _strength_label(abs(diff) / max(mood.std(), 0.01)),
                "is_significant": p_val < 0.05,
                "details": {
                    "weekday_avg": round(float(weekday_mood.mean()), 1),
                    "weekend_avg": round(float(weekend_mood.mean()), 1),
                    "weekday_n": int(len(weekday_mood)),
                    "weekend_n": int(len(weekend_mood)),
                },
            })

    # Sort by absolute effect size descending
    patterns.sort(key=lambda p: abs(p.get("statistic", 0)), reverse=True)

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    return {
        "patterns": patterns,
        "is_sufficient": True,
        "input_row_count": len(entries),
        "computed_ms": elapsed,
    }
