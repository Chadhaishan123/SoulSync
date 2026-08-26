from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any
from app.database.session import get_db
from app.models.models import User, MoodEntry, SleepRecord, JournalEntry, JournalAnalysis, MLPrediction, DetectedPattern
from app.schemas.schemas import MLPredictionResponse, DetectedPatternResponse
from app.api.deps import get_current_user
from app.services.ml_service import ml_service
from app.services.ai_service import ai_service
import datetime

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch latest entries
    latest_checkin = db.query(MoodEntry).filter(
        MoodEntry.user_id == current_user.id
    ).order_by(desc(MoodEntry.created_at)).first()
    
    # 2. Compute current trend
    trend_res = ml_service.predict_trend(current_user.id, db)
    
    # 3. Compute Digital Twin cluster allocation
    twin_res = ml_service.cluster_user_days(current_user.id, db)
    
    # 4. Check for anomalies
    anomaly_res = ml_service.detect_anomaly(current_user.id, db)
    
    # 5. Get recent journal analysis
    latest_journal = db.query(JournalEntry).filter(
        JournalEntry.user_id == current_user.id
    ).order_by(desc(JournalEntry.created_at)).first()
    
    emotion_summary = "Neutral"
    if latest_journal and latest_journal.analysis:
        emotion_summary = latest_journal.analysis.dominant_emotion

    # 6. Emotional Weather Forecast logic:
    # Based on mood, stress, energy from latest checkin, and trend prediction
    weather_state = "☀️ Stable"
    forecast_desc = "Your patterns are looking balanced and steady today."
    
    if latest_checkin:
        mood = latest_checkin.mood_score
        stress = latest_checkin.stress_level
        energy = latest_checkin.energy_level
        trend = trend_res["trend"]
        
        if stress >= 7:
            weather_state = "⛈️ Significant Deviation" if anomaly_res["is_anomaly"] else "☁️ High Stress"
            forecast_desc = "Some turbulence detected in your recent stress ratings."
        elif mood <= 4:
            weather_state = "🌧️ Difficult Period"
            forecast_desc = "Your self-reported mood shows a lower score trend recently."
        elif energy <= 4:
            weather_state = "☁️ Low Energy"
            forecast_desc = "Energy is lower than your usual baseline."
        elif trend == "Improving":
            weather_state = "🌤️ Improving"
            forecast_desc = "Clear skies ahead! Your metrics show an upward trend."
        else:
            weather_state = "☀️ Stable"
            forecast_desc = "Your emotional weather is balanced and calm."
            
    return {
        "weather": {
            "state": weather_state,
            "forecast": forecast_desc,
            "latest_metrics": {
                "mood": latest_checkin.mood_score if latest_checkin else 0,
                "stress": latest_checkin.stress_level if latest_checkin else 0,
                "energy": latest_checkin.energy_level if latest_checkin else 0,
                "sleep_quality": latest_checkin.sleep_quality if latest_checkin else 0,
                "primary_emotion": latest_checkin.primary_emotion if latest_checkin else "None"
            } if latest_checkin else None
        },
        "digital_twin": {
            "current_pattern": twin_res["current_pattern"],
            "clusters": twin_res["clusters"],
            "total_days": twin_res["total_days"]
        },
        "trend_prediction": {
            "value": trend_res["trend"],
            "confidence": trend_res["confidence"],
            "explanation": trend_res["explanation"]
        },
        "anomaly": {
            "is_anomaly": anomaly_res["is_anomaly"],
            "score": anomaly_res["score"],
            "message": anomaly_res["message"]
        },
        "latest_journal_emotion": emotion_summary
    }


@router.get("/trends")
def get_trends_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return ml_service.predict_trend(current_user.id, db)


@router.get("/patterns")
def get_patterns_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Get raw correlation patterns
    patterns = ml_service.extract_patterns(current_user.id, db)
    
    # 2. Get Sleep vs Mood graph data
    sleep_records = db.query(SleepRecord).filter(SleepRecord.user_id == current_user.id).all()
    mood_entries = db.query(MoodEntry).filter(MoodEntry.user_id == current_user.id).all()
    
    # Create maps for grouping sleep durations and calculating average mood
    # <5 hours, 5-6 hours, 6-7 hours, 7-8 hours, >8 hours
    groups = {
        "< 5 hours": {"mood_sum": 0.0, "count": 0},
        "5-6 hours": {"mood_sum": 0.0, "count": 0},
        "6-7 hours": {"mood_sum": 0.0, "count": 0},
        "7-8 hours": {"mood_sum": 0.0, "count": 0},
        "> 8 hours": {"mood_sum": 0.0, "count": 0}
    }
    
    # Match sleep records to mood entries on same date
    mood_by_date = {m.created_at.date(): m.mood_score for m in mood_entries}
    for r in sleep_records:
        rec_date = r.recorded_date
        mood_score = mood_by_date.get(rec_date)
        if mood_score is not None:
            hours = r.sleep_duration_minutes / 60.0
            if hours < 5.0:
                grp = "< 5 hours"
            elif hours < 6.0:
                grp = "5-6 hours"
            elif hours < 7.0:
                grp = "6-7 hours"
            elif hours < 8.0:
                grp = "7-8 hours"
            else:
                grp = "> 8 hours"
                
            groups[grp]["mood_sum"] += mood_score
            groups[grp]["count"] += 1
            
    explorer_data = []
    for g, val in groups.items():
        avg_mood = round(val["mood_sum"] / val["count"], 1) if val["count"] > 0 else 0.0
        explorer_data.append({
            "sleep_range": g,
            "avg_mood": avg_mood,
            "supporting_days": val["count"]
        })
        
    return {
        "patterns": patterns,
        "sleep_vs_mood": explorer_data
    }


@router.get("/anomalies")
def get_anomalies_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return ml_service.detect_anomaly(current_user.id, db)
