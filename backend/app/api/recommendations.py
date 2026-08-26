from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database.session import get_db
from app.models.models import User, Activity, Recommendation, MoodEntry, ActivityCompletion
from app.schemas.schemas import RecommendationResponse, RecommendationFeedback
from app.api.deps import get_current_user
import datetime

router = APIRouter()

# Helper to pre-populate activities if empty
def populate_default_activities(db: Session):
    count = db.query(Activity).count()
    if count == 0:
        defaults = [
            Activity(name="2-Minute Breathing Exercise", category="Breathing", description="Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat.", duration_minutes=2),
            Activity(name="5-Minute Mindful Reflection", category="Reflection", description="Sit in a quiet space and focus on your breath. Observe thoughts without judgment.", duration_minutes=5),
            Activity(name="10-Minute Outdoor Walk", category="Exercise", description="Take a quick walk outside to reset your visual field and get fresh air.", duration_minutes=10),
            Activity(name="Stretching Routine", category="Movement", description="Perform light neck, shoulder, and back stretches to release muscle tension.", duration_minutes=5),
            Activity(name="Gratitude Journaling", category="Reflection", description="Write down three things you are genuinely grateful for today.", duration_minutes=5),
            Activity(name="Focus Reset", category="Focus", description="Turn off notifications, close extra tabs, and take 3 deep breaths before returning to work.", duration_minutes=3),
            Activity(name="Sleep Preparation Routine", category="Sleep", description="Dim lights, shut down screens, and drink a glass of water or chamomile tea.", duration_minutes=15)
        ]
        db.add_all(defaults)
        db.commit()


@router.get("", response_model=List[RecommendationResponse])
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    populate_default_activities(db)
    
    # 1. Fetch latest check-in
    latest_checkin = db.query(MoodEntry).filter(
        MoodEntry.user_id == current_user.id
    ).order_by(desc(MoodEntry.created_at)).first()
    
    # 2. Base recommendations on user metrics
    rec_activities = []
    reason_map = {}
    
    stress = latest_checkin.stress_level if latest_checkin else 5
    energy = latest_checkin.energy_level if latest_checkin else 5
    sleep = latest_checkin.sleep_quality if latest_checkin else 5
    
    # Rule engine matching blueprint
    if stress >= 7 and energy <= 4:
        act = db.query(Activity).filter(Activity.name.like("%Breathing%")).first()
        if act:
            rec_activities.append(act)
            reason_map[act.id] = "Your recorded stress is high today, while your energy is lower than your recent average. A short, low-effort breathing exercise may be a suitable option."
            
    if stress >= 7 and act is None:
        act = db.query(Activity).filter(Activity.category == "Reflection").first()
        if act:
            rec_activities.append(act)
            reason_map[act.id] = "High stress levels detected. Reflective meditation can help calm your nervous system."
            
    if energy <= 4:
        act = db.query(Activity).filter(Activity.name.like("%Walk%")).first()
        if act:
            rec_activities.append(act)
            reason_map[act.id] = "Your energy levels are low. A quick walk can naturally boost endorphins and alertness."
            
    if sleep <= 4:
        act = db.query(Activity).filter(Activity.category == "Sleep").first()
        if act:
            rec_activities.append(act)
            reason_map[act.id] = "Your logged sleep quality was poor. Try this bedtime preparation routine to reset your sleep cycle."

    # If no specific rules trigger, select 2 random/default ones
    if not rec_activities:
        acts = db.query(Activity).limit(2).all()
        for act in acts:
            rec_activities.append(act)
            reason_map[act.id] = "A general wellness recommendation to keep your daily consistency going."

    # Save recommendations to database
    response_recs = []
    for act in rec_activities:
        # Check if we already created this recommendation today
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        existing = db.query(Recommendation).filter(
            Recommendation.user_id == current_user.id,
            Recommendation.activity_id == act.id,
            Recommendation.created_at >= today_start
        ).first()
        
        if not existing:
            rec = Recommendation(
                user_id=current_user.id,
                activity_id=act.id,
                reason=reason_map[act.id],
                recommendation_score=0.9 if "recorded stress is high" in reason_map[act.id] else 0.7
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
        else:
            rec = existing
            
        response_recs.append(rec)
        
    return response_recs


@router.post("/{rec_id}/feedback", response_model=RecommendationResponse)
def give_recommendation_feedback(
    rec_id: int,
    feedback_in: RecommendationFeedback,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(Recommendation).filter(
        Recommendation.id == rec_id,
        Recommendation.user_id == current_user.id
    ).first()
    
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.feedback = feedback_in.feedback
    
    # Also log activity completion if they thumbs up
    if feedback_in.feedback == "👍 Helpful":
        completion = ActivityCompletion(
            user_id=current_user.id,
            activity_id=rec.activity_id,
            user_rating="👍 Helpful"
        )
        db.add(completion)
        
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/outcomes")
def get_activity_outcomes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tracks activity outcomes matching the 'What Helped Me?' feature."""
    completions = db.query(ActivityCompletion).filter(
        ActivityCompletion.user_id == current_user.id
    ).all()
    
    # Group by activity
    outcomes = {}
    for comp in completions:
        act = comp.activity
        if act.name not in outcomes:
            outcomes[act.name] = {
                "name": act.name,
                "completions": 0,
                "helpful_count": 0
            }
        outcomes[act.name]["completions"] += 1
        if comp.user_rating == "👍 Helpful":
            outcomes[act.name]["helpful_count"] += 1
            
    outcomes_list = []
    for name, data in outcomes.items():
        rate = (data["helpful_count"] / data["completions"]) * 100.0 if data["completions"] > 0 else 0.0
        outcomes_list.append({
            "activity_name": name,
            "completed_times": data["completions"],
            "helpfulness_rate": round(rate, 1)
        })
        
    return outcomes_list
