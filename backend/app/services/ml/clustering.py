"""
K-Means clustering for the Digital Twin.

Groups the user's check-in history into behavioural clusters and labels
each by its centroid characteristics. The current cluster tells the user
"you are in a High-Stress pattern this week" backed by real numbers.

Minimum: 7 check-ins. Below that, uses rule-based classification.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

log = logging.getLogger("soulsync.ml.clustering")

MIN_ENTRIES = 7
N_CLUSTERS = 4
FEATURE_COLS = ["mood_score", "stress_level", "energy_level", "sleep_quality"]

# Labels assigned to clusters based on centroid analysis
CLUSTER_LABELS = {
    "high_mood_low_stress": "Balanced",
    "high_stress": "High-Stress",
    "low_energy": "Low-Energy",
    "low_mood": "Recovery",
}


def _label_cluster(centroid: np.ndarray) -> str:
    """
    Label a cluster based on its centroid values.
    centroid order: [mood, stress, energy, sleep_quality]
    """
    mood, stress, energy, sleep_q = centroid

    if mood <= 4.5:
        return "Recovery"
    if stress >= 6.5:
        return "High-Stress"
    if energy <= 4.0:
        return "Low-Energy"
    return "Balanced"


def cluster_user(entries: List[Any]) -> Dict[str, Any]:
    """
    Cluster user's check-in history and identify current pattern.

    Returns:
        current_pattern:    label of the cluster the latest entry falls in
        total_days:         how many entries were clustered
        clusters:           {label: count} distribution
        centroids:          centroid values per cluster (for transparency)
        is_model_backed:    True if KMeans ran
        input_row_count:    number of entries
        computed_ms:        wall-clock time
    """
    start = time.perf_counter_ns()

    if not entries:
        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "current_pattern": "Balanced",
            "total_days": 0,
            "clusters": {"Balanced": 0, "High-Stress": 0, "Low-Energy": 0, "Recovery": 0},
            "centroids": {},
            "is_model_backed": False,
            "input_row_count": 0,
            "computed_ms": elapsed,
            "model_name": "rule_based",
        }

    # Build feature matrix
    X = []
    for e in entries:
        X.append([
            float(e.mood_score),
            float(e.stress_level if e.stress_level is not None else 5),
            float(e.energy_level if e.energy_level is not None else 5),
            float(e.sleep_quality if e.sleep_quality is not None else 5),
        ])
    X = np.array(X, dtype=float)

    # Rule-based fallback for small sample sizes (< MIN_ENTRIES)
    if len(entries) < MIN_ENTRIES:
        clusters = {"Balanced": 0, "High-Stress": 0, "Low-Energy": 0, "Recovery": 0}
        for i, row in enumerate(X):
            e = entries[i]
            # If explicit emotion is Sad or mood is low, mark as Recovery
            if getattr(e, "primary_emotion", None) == "Sad" or row[0] <= 4.5:
                label = "Recovery"
            else:
                label = _label_cluster(row)
            clusters[label] = clusters.get(label, 0) + 1

        latest_entry = entries[-1]
        if getattr(latest_entry, "primary_emotion", None) == "Sad" or X[-1][0] <= 4.5:
            latest_label = "Recovery"
        else:
            latest_label = _label_cluster(X[-1])

        elapsed = int((time.perf_counter_ns() - start) / 1_000_000)
        return {
            "current_pattern": latest_label,
            "total_days": len(entries),
            "clusters": clusters,
            "centroids": {},
            "is_model_backed": False,
            "input_row_count": len(entries),
            "computed_ms": elapsed,
            "model_name": "rule_based",
        }

    # ── K-Means ──
    # Use fewer clusters if we don't have enough data
    n_clusters = min(N_CLUSTERS, len(X))

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # Inverse transform centroids to original scale
    centroids_original = scaler.inverse_transform(kmeans.cluster_centers_)

    # Label each cluster
    cluster_names = {}
    for i, centroid in enumerate(centroids_original):
        cluster_names[i] = _label_cluster(centroid)

    # Handle duplicate labels (append suffix)
    seen = {}
    for k, v in cluster_names.items():
        if v in seen.values():
            count = list(seen.values()).count(v) + 1
            cluster_names[k] = f"{v} {count}"
        seen[k] = cluster_names[k]

    # Distribution
    distribution: Dict[str, int] = {}
    for label_idx in labels:
        name = cluster_names[label_idx]
        distribution[name] = distribution.get(name, 0) + 1

    # Current pattern (latest entry's cluster)
    current_pattern = cluster_names[labels[-1]]

    # Centroid details for transparency
    centroid_details = {}
    for i, centroid in enumerate(centroids_original):
        name = cluster_names[i]
        centroid_details[name] = {
            "mood": round(float(centroid[0]), 1),
            "stress": round(float(centroid[1]), 1),
            "energy": round(float(centroid[2]), 1),
            "sleep_quality": round(float(centroid[3]), 1),
        }

    elapsed = int((time.perf_counter_ns() - start) / 1_000_000)

    return {
        "current_pattern": current_pattern,
        "total_days": len(entries),
        "clusters": distribution,
        "centroids": centroid_details,
        "is_model_backed": True,
        "input_row_count": len(entries),
        "computed_ms": elapsed,
        "model_name": "KMeans",
        "n_clusters": n_clusters,
        "inertia": round(float(kmeans.inertia_), 2),
    }
