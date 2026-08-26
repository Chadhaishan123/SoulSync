import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import MoodEntry, SleepRecord, MLPrediction, DetectedPattern
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest

class MLService:
    def __init__(self):
        self.models_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "saved_models")
        os.makedirs(self.models_dir, exist_ok=True)
        self.trend_model = self._load_model("trend_predictor.joblib")
        self.kmeans_model = self._load_model("kmeans_clustering.joblib")
        self.anomaly_model = self._load_model("isolation_forest.joblib")

    def _load_model(self, filename: str) -> Any:
        path = os.path.join(self.models_dir, filename)
        if os.path.exists(path):
            try:
                return joblib.load(path)
            except Exception as e:
                print(f"Failed to load model {filename}: {e}")
        return None

    def predict_trend(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Predicts the self-reported wellness trend: Improving, Stable, Declining."""
        entries = db.query(MoodEntry).filter(MoodEntry.user_id == user_id).order_by(MoodEntry.created_at.desc()).limit(10).all()
        if len(entries) < 3:
            return {"trend": "Stable", "confidence": 0.5, "explanation": "Not enough check-ins logged (minimum 3 required)."}

        # Calculate features
        mood_scores = [e.mood_score for e in entries]
        stress_levels = [e.stress_level for e in entries]
        
        avg_mood_3d = sum(mood_scores[:3]) / 3.0
        avg_mood_7d = sum(mood_scores[:7]) / min(7, len(mood_scores))
        
        avg_stress_3d = sum(stress_levels[:3]) / 3.0
        avg_stress_7d = sum(stress_levels[:7]) / min(7, len(stress_levels))
        
        # Simple trend computation (fallback if no trained model)
        if self.trend_model is None:
            mood_diff = avg_mood_3d - avg_mood_7d
            stress_diff = avg_stress_3d - avg_stress_7d
            
            if mood_diff > 0.5 and stress_diff < -0.5:
                trend = "Improving"
                confidence = min(0.9, 0.5 + abs(mood_diff) * 0.2)
            elif mood_diff < -0.5 and stress_diff > 0.5:
                trend = "Declining"
                confidence = min(0.9, 0.5 + abs(mood_diff) * 0.2)
            else:
                trend = "Stable"
                confidence = 0.7
        else:
            try:
                # Feature vector matching training script
                # [avg_mood_3d, avg_mood_7d, mood_trend, avg_stress_3d, avg_stress_7d, stress_trend]
                mood_trend = avg_mood_3d - avg_mood_7d
                stress_trend = avg_stress_3d - avg_stress_7d
                features = np.array([[avg_mood_3d, avg_mood_7d, mood_trend, avg_stress_3d, avg_stress_7d, stress_trend]])
                
                pred = self.trend_model.predict(features)[0]
                proba = self.trend_model.predict_proba(features)[0]
                
                trend = pred
                confidence = float(np.max(proba))
            except Exception as e:
                print(f"ML Model prediction failed: {e}")
                # Fallback
                trend = "Stable"
                confidence = 0.5

        # Check sleep records for extra context
        sleep_records = db.query(SleepRecord).filter(SleepRecord.user_id == user_id).order_by(SleepRecord.recorded_date.desc()).limit(7).all()
        sleep_context = ""
        if len(sleep_records) >= 3:
            sleep_avg = sum(r.sleep_duration_minutes for r in sleep_records) / (len(sleep_records) * 60.0)
            if sleep_avg < 6.0:
                sleep_context = " alongside consistently shorter sleep (average < 6h)."
        
        return {
            "trend": trend,
            "confidence": round(confidence, 2),
            "explanation": f"Based on your recent 3-day averages compared to your 7-day average. Mood is {round(avg_mood_3d, 1)} vs {round(avg_mood_7d, 1)}, and stress is {round(avg_stress_3d, 1)} vs {round(avg_stress_7d, 1)}{sleep_context}."
        }

    def cluster_user_days(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Clusters check-ins to map the SoulSync Digital Twin behavioral profile."""
        entries = db.query(MoodEntry).filter(MoodEntry.user_id == user_id).order_by(MoodEntry.created_at.desc()).all()
        if len(entries) < 5:
            # Cold start: place all in Balanced
            return {
                "clusters": {
                    "Balanced Pattern": len(entries),
                    "High-Stress Pattern": 0,
                    "Low-Energy Pattern": 0,
                    "Recovery Pattern": 0
                },
                "current_pattern": "Balanced Pattern",
                "total_days": len(entries)
            }
            
        data = [[e.mood_score, e.stress_level, e.energy_level, e.sleep_quality] for e in entries]
        X = np.array(data)
        
        # Fit a K-Means model for this specific user's history (personalization)
        n_clusters = min(4, len(entries))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)
        centroids = kmeans.cluster_centers_
        
        # Map centroids to human labels:
        # High stress: high centroid[1]
        # Low energy: low centroid[2]
        # Recovery: moderate/high energy, low stress, following a bad period
        # Balanced: high mood, low stress, high energy
        cluster_names = {}
        for i, center in enumerate(centroids):
            mood, stress, energy, sleep = center
            if stress >= 6.5 and energy <= 5.0:
                cluster_names[i] = "High-Stress Pattern"
            elif energy <= 4.5 and mood <= 5.0:
                cluster_names[i] = "Low-Energy Pattern"
            elif mood >= 6.5 and stress <= 4.0:
                cluster_names[i] = "Balanced Pattern"
            else:
                cluster_names[i] = "Recovery Pattern"
                
        # Count frequency of each
        counts = {
            "Balanced Pattern": 0,
            "High-Stress Pattern": 0,
            "Low-Energy Pattern": 0,
            "Recovery Pattern": 0
        }
        for label in labels:
            name = cluster_names.get(label, "Recovery Pattern")
            counts[name] += 1
            
        current_label = labels[0] # most recent entry
        current_pattern = cluster_names.get(current_label, "Recovery Pattern")
        
        return {
            "clusters": counts,
            "current_pattern": current_pattern,
            "total_days": len(entries)
        }

    def detect_anomaly(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Detects whether the latest check-in is an anomaly compared to the user's historical data."""
        entries = db.query(MoodEntry).filter(MoodEntry.user_id == user_id).order_by(MoodEntry.created_at.desc()).all()
        if len(entries) < 7:
            return {"is_anomaly": False, "score": 0.0, "message": "Not enough history to establish normal range."}
            
        # Feature matrix: [mood, stress, energy, sleep]
        data = [[e.mood_score, e.stress_level, e.energy_level, e.sleep_quality] for e in entries]
        X = np.array(data)
        
        latest_day = X[0]
        
        # Fit Isolation Forest
        clf = IsolationForest(contamination=0.1, random_state=42)
        clf.fit(X)
        
        # Prediction: -1 is anomaly, 1 is normal
        pred = clf.predict([latest_day])[0]
        score = -float(clf.decision_function([latest_day])[0]) # higher score means more anomalous
        
        is_anomaly = bool(pred == -1)
        
        # Build explanation message
        message = "Your check-in aligns with your typical patterns."
        if is_anomaly:
            # Identify which variable is the biggest outlier
            past_df = pd.DataFrame(data[1:], columns=["mood", "stress", "energy", "sleep"])
            outliers = []
            for col in past_df.columns:
                mean = past_df[col].mean()
                std = past_df[col].std()
                val = latest_day[past_df.columns.get_loc(col)]
                if std > 0 and abs(val - mean) > 1.5 * std:
                    outliers.append(col)
            if outliers:
                message = f"Your latest {', '.join(outliers)} ratings are noticeably outside your usual recorded range."
            else:
                message = "Your recent stress and wellness ratings deviate from your typical historical patterns."
                
        return {
            "is_anomaly": is_anomaly,
            "score": round(score, 3),
            "message": message
        }

    def extract_patterns(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Identifies correlations, e.g. 'mood decreases after short sleep'."""
        entries = db.query(MoodEntry).filter(MoodEntry.user_id == user_id).order_by(MoodEntry.created_at.desc()).all()
        if len(entries) < 10:
            return []
            
        patterns = []
        df = pd.DataFrame([{
            "mood": e.mood_score,
            "stress": e.stress_level,
            "energy": e.energy_level,
            "sleep_quality": e.sleep_quality
        } for e in entries])
        
        # Compute correlations
        corr = df.corr()
        
        # Check Mood vs Stress
        if corr.loc["mood", "stress"] < -0.5:
            patterns.append({
                "pattern_type": "mood-stress-correlation",
                "description": "Your self-reported mood tends to decrease as your stress levels rise.",
                "confidence_score": round(abs(corr.loc["mood", "stress"]), 2)
            })
            
        # Check Energy vs Sleep Quality
        if corr.loc["energy", "sleep_quality"] > 0.5:
            patterns.append({
                "pattern_type": "energy-sleep-correlation",
                "description": "Your energy levels are strongly correlated with your self-reported sleep quality.",
                "confidence_score": round(corr.loc["energy", "sleep_quality"], 2)
            })
            
        # Default pattern if correlations are low
        if not patterns:
            patterns.append({
                "pattern_type": "consistency",
                "description": "Your wellness ratings show stable, balanced interactions across mood and sleep metrics.",
                "confidence_score": 0.6
            })
            
        return patterns

ml_service = MLService()
