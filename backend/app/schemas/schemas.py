from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# ==================== TOKEN SCHEMAS ====================
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None


# ==================== USER SCHEMAS ====================
class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== PROFILE SCHEMAS ====================
class UserProfileBase(BaseModel):
    timezone: str = "UTC"
    wellness_goals: List[str] = []
    personalization_enabled: bool = True
    location_enabled: bool = False

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    pass

class UserProfileResponse(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== MOOD SCHEMAS ====================
class MoodEntryBase(BaseModel):
    mood_score: int = Field(..., ge=1, le=10)
    stress_level: int = Field(..., ge=1, le=10)
    energy_level: int = Field(..., ge=1, le=10)
    sleep_quality: int = Field(..., ge=1, le=10)
    primary_emotion: str
    tags: List[str] = []

class MoodEntryCreate(MoodEntryBase):
    pass

class MoodEntryResponse(MoodEntryBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== SLEEP SCHEMAS ====================
class SleepRecordBase(BaseModel):
    sleep_duration_minutes: int = Field(..., ge=0)
    bedtime: datetime
    wake_time: datetime
    sleep_quality: int = Field(..., ge=1, le=10)
    recorded_date: date

class SleepRecordCreate(SleepRecordBase):
    pass

class SleepRecordResponse(SleepRecordBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True


# ==================== JOURNAL SCHEMAS ====================
class JournalEntryBase(BaseModel):
    content: str

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalAnalysisResponse(BaseModel):
    id: int
    journal_id: int
    sentiment_score: float
    dominant_emotion: str
    emotion_probabilities: Dict[str, float]
    themes: List[str]
    summary: Optional[str] = None
    model_version: str
    created_at: datetime

    class Config:
        from_attributes = True

class JournalEntryResponse(JournalEntryBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    analysis: Optional[JournalAnalysisResponse] = None

    class Config:
        from_attributes = True


# ==================== ACTIVITY SCHEMAS ====================
class ActivityBase(BaseModel):
    name: str
    category: str
    description: str
    duration_minutes: int

class ActivityResponse(ActivityBase):
    id: int

    class Config:
        from_attributes = True


class ActivityCompletionBase(BaseModel):
    activity_id: int
    duration: Optional[int] = None
    user_rating: Optional[str] = None  # 👍 Helpful, 👎 Not Helpful

class ActivityCompletionCreate(ActivityCompletionBase):
    pass

class ActivityCompletionResponse(ActivityCompletionBase):
    id: int
    user_id: int
    completed_at: datetime

    class Config:
        from_attributes = True


# ==================== ENVIRONMENT SNAPSHOT SCHEMAS ====================
class EnvironmentSnapshotBase(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    cloud_cover: Optional[float] = None
    precipitation: Optional[float] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    ozone: Optional[float] = None

class EnvironmentSnapshotResponse(EnvironmentSnapshotBase):
    id: int
    user_id: int
    recorded_at: datetime

    class Config:
        from_attributes = True


# ==================== ML PREDICTION SCHEMAS ====================
class MLPredictionResponse(BaseModel):
    id: int
    user_id: int
    prediction_type: str
    prediction_value: str
    confidence: float
    model_version: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== DETECTED PATTERN SCHEMAS ====================
class DetectedPatternResponse(BaseModel):
    id: int
    user_id: int
    pattern_type: str
    description: str
    support_count: int
    confidence_score: float
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== RECOMMENDATION SCHEMAS ====================
class RecommendationBase(BaseModel):
    activity_id: int
    reason: str
    recommendation_score: float

class RecommendationResponse(RecommendationBase):
    id: int
    user_id: int
    feedback: Optional[str] = None
    created_at: datetime
    activity: ActivityResponse

    class Config:
        from_attributes = True

class RecommendationFeedback(BaseModel):
    feedback: str  # 👍 Helpful or 👎 Not Helpful


# ==================== CONSENT SCHEMAS ====================
class ConsentRecordCreate(BaseModel):
    consent_type: str
    is_granted: bool

class ConsentRecordResponse(BaseModel):
    id: int
    user_id: int
    consent_type: str
    is_granted: bool
    granted_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True
