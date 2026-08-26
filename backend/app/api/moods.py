from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Dict, Any
from app.database.session import get_db
from app.models.models import User, MoodEntry, EnvironmentSnapshot, ConsentRecord
from app.schemas.schemas import MoodEntryCreate, MoodEntryResponse
from app.api.deps import get_current_user
import httpx
import datetime

router = APIRouter()

# Helper function to fetch environmental snapshot
async def fetch_weather_and_aqi(lat: float = 40.7128, lon: float = -74.0060) -> Dict[str, Any]:
    env_data = {}
    try:
        async with httpx.AsyncClient() as client:
            # Fetch Weather
            weather_params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,cloud_cover,precipitation"
            }
            weather_res = await client.get("https://api.open-meteo.com/v1/forecast", params=weather_params, timeout=3.0)
            if weather_res.status_code == 200:
                curr_w = weather_res.json().get("current", {})
                env_data["temperature"] = curr_w.get("temperature_2m")
                env_data["humidity"] = curr_w.get("relative_humidity_2m")
                env_data["cloud_cover"] = curr_w.get("cloud_cover")
                env_data["precipitation"] = curr_w.get("precipitation")
            
            # Fetch AQI
            aqi_params = {
                "latitude": lat,
                "longitude": lon,
                "current": "pm2_5,pm10,ozone"
            }
            aqi_res = await client.get("https://air-quality-api.open-meteo.com/v1/air-quality", params=aqi_params, timeout=3.0)
            if aqi_res.status_code == 200:
                curr_aq = aqi_res.json().get("current", {})
                env_data["pm25"] = curr_aq.get("pm2_5")
                env_data["pm10"] = curr_aq.get("pm10")
                env_data["ozone"] = curr_aq.get("ozone")
    except Exception as e:
        # Silently fail environment fetching so checkout completes
        print(f"Failed to fetch environmental data: {e}")
    return env_data


@router.post("", response_model=MoodEntryResponse)
async def create_mood_entry(
    mood_in: MoodEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_entry = MoodEntry(
        user_id=current_user.id,
        mood_score=mood_in.mood_score,
        stress_level=mood_in.stress_level,
        energy_level=mood_in.energy_level,
        sleep_quality=mood_in.sleep_quality,
        primary_emotion=mood_in.primary_emotion,
        tags=mood_in.tags
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    
    # Check for environment consent and location enabled
    consent = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == current_user.id,
        ConsentRecord.consent_type == "environment",
        ConsentRecord.is_granted == True
    ).first()
    
    # If consent exists, capture weather data
    if consent and current_user.profile and current_user.profile.location_enabled:
        env_data = await fetch_weather_and_aqi()
        if env_data:
            snapshot = EnvironmentSnapshot(
                user_id=current_user.id,
                temperature=env_data.get("temperature"),
                humidity=env_data.get("humidity"),
                cloud_cover=env_data.get("cloud_cover"),
                precipitation=env_data.get("precipitation"),
                pm25=env_data.get("pm25"),
                pm10=env_data.get("pm10"),
                ozone=env_data.get("ozone")
            )
            db.add(snapshot)
            db.commit()
            
    return new_entry


@router.get("", response_model=List[MoodEntryResponse])
def read_mood_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(MoodEntry).filter(
        MoodEntry.user_id == current_user.id
    ).order_by(desc(MoodEntry.created_at)).all()


@router.get("/history")
def get_mood_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Returns history data for charting
    entries = db.query(MoodEntry).filter(
        MoodEntry.user_id == current_user.id
    ).order_by(MoodEntry.created_at).all()
    
    return [
        {
            "id": entry.id,
            "date": entry.created_at.strftime("%Y-%m-%d"),
            "mood": entry.mood_score,
            "stress": entry.stress_level,
            "energy": entry.energy_level,
            "sleep_quality": entry.sleep_quality,
            "emotion": entry.primary_emotion,
            "tags": entry.tags
        }
        for entry in entries
    ]


@router.get("/summary")
def get_mood_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    entries = db.query(MoodEntry).filter(MoodEntry.user_id == current_user.id).all()
    if not entries:
        return {
            "avg_mood": 0.0,
            "avg_stress": 0.0,
            "avg_energy": 0.0,
            "primary_emotions": {},
            "total_count": 0
        }
    
    avg_mood = sum(e.mood_score for e in entries) / len(entries)
    avg_stress = sum(e.stress_level for e in entries) / len(entries)
    avg_energy = sum(e.energy_level for e in entries) / len(entries)
    
    emotions = {}
    for e in entries:
        emotions[e.primary_emotion] = emotions.get(e.primary_emotion, 0) + 1
        
    return {
        "avg_mood": round(avg_mood, 2),
        "avg_stress": round(avg_stress, 2),
        "avg_energy": round(avg_energy, 2),
        "primary_emotions": emotions,
        "total_count": len(entries)
    }
