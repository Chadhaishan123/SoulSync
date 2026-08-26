from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database.session import get_db
from app.models.models import User, SleepRecord
from app.schemas.schemas import SleepRecordCreate, SleepRecordResponse
from app.api.deps import get_current_user
import datetime

router = APIRouter()

@router.post("", response_model=SleepRecordResponse)
def create_sleep_record(
    sleep_in: SleepRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_record = SleepRecord(
        user_id=current_user.id,
        sleep_duration_minutes=sleep_in.sleep_duration_minutes,
        bedtime=sleep_in.bedtime,
        wake_time=sleep_in.wake_time,
        sleep_quality=sleep_in.sleep_quality,
        recorded_date=sleep_in.recorded_date
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


@router.get("", response_model=List[SleepRecordResponse])
def read_sleep_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(SleepRecord).filter(
        SleepRecord.user_id == current_user.id
    ).order_by(desc(SleepRecord.recorded_date)).all()


@router.get("/summary")
def get_sleep_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(SleepRecord).filter(
        SleepRecord.user_id == current_user.id
    ).order_by(desc(SleepRecord.recorded_date)).all()
    
    if not records:
        return {
            "avg_sleep_3d_hours": 0.0,
            "avg_sleep_7d_hours": 0.0,
            "sleep_consistency": "No Data",
            "sleep_quality_trend": []
        }
        
    durations = [r.sleep_duration_minutes for r in records]
    
    # 3-day average
    avg_3d = sum(durations[:3]) / min(3, len(durations)) / 60.0
    
    # 7-day average
    avg_7d = sum(durations[:7]) / min(7, len(durations)) / 60.0
    
    # Sleep consistency metric: standard deviation of sleep duration
    consistency = "Stable"
    if len(durations) >= 3:
        import numpy as np
        std_dev = np.std([d / 60.0 for d in durations[:7]])
        if std_dev < 1.0:
            consistency = "High Consistency"
        elif std_dev < 2.0:
            consistency = "Moderate Consistency"
        else:
            consistency = "Needs Improvement"
            
    trend = []
    for r in reversed(records[:14]):  # last 2 weeks
        trend.append({
            "date": r.recorded_date.strftime("%Y-%m-%d"),
            "hours": round(r.sleep_duration_minutes / 60.0, 1),
            "quality": r.sleep_quality
        })
        
    return {
        "avg_sleep_3d_hours": round(avg_3d, 1),
        "avg_sleep_7d_hours": round(avg_7d, 1),
        "sleep_consistency": consistency,
        "sleep_quality_trend": trend
    }
