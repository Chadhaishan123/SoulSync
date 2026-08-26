from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Date, JSON, Text
from sqlalchemy.orm import relationship
import datetime
from app.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    mood_entries = relationship("MoodEntry", back_populates="user")
    sleep_records = relationship("SleepRecord", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")
    activity_completions = relationship("ActivityCompletion", back_populates="user")
    environment_snapshots = relationship("EnvironmentSnapshot", back_populates="user")
    ml_predictions = relationship("MLPrediction", back_populates="user")
    detected_patterns = relationship("DetectedPattern", back_populates="user")
    recommendations = relationship("Recommendation", back_populates="user")
    consent_records = relationship("ConsentRecord", back_populates="user")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    timezone = Column(String, default="UTC")
    wellness_goals = Column(JSON, default=list)  # list of strings
    personalization_enabled = Column(Boolean, default=True)
    location_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="profile")


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    mood_score = Column(Integer, nullable=False)  # 1-10
    stress_level = Column(Integer, nullable=False)  # 1-10
    energy_level = Column(Integer, nullable=False)  # 1-10
    sleep_quality = Column(Integer, nullable=False)  # 1-10
    primary_emotion = Column(String, nullable=False)  # Happy, Sad, Calm, etc.
    tags = Column(JSON, default=list)  # list of strings
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="mood_entries")


class SleepRecord(Base):
    __tablename__ = "sleep_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    sleep_duration_minutes = Column(Integer, nullable=False)
    bedtime = Column(DateTime, nullable=False)
    wake_time = Column(DateTime, nullable=False)
    sleep_quality = Column(Integer, nullable=False)  # 1-10
    recorded_date = Column(Date, default=datetime.date.today)

    user = relationship("User", back_populates="sleep_records")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="journal_entries")
    analysis = relationship("JournalAnalysis", back_populates="journal", uselist=False, cascade="all, delete-orphan")


class JournalAnalysis(Base):
    __tablename__ = "journal_analysis"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), unique=True)
    sentiment_score = Column(Float, nullable=False)  # -1.0 to 1.0
    dominant_emotion = Column(String, nullable=False)
    emotion_probabilities = Column(JSON, default=dict)
    themes = Column(JSON, default=list)
    summary = Column(Text, nullable=True)
    model_version = Column(String, default="1.0")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    journal = relationship("JournalEntry", back_populates="analysis")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Reflection, Exercise, breathing, etc.
    description = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=False)

    completions = relationship("ActivityCompletion", back_populates="activity")
    recommendations = relationship("Recommendation", back_populates="activity")


class ActivityCompletion(Base):
    __tablename__ = "activity_completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"))
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)
    duration = Column(Integer, nullable=True)  # duration in minutes, optional
    user_rating = Column(String, nullable=True)  # 👍 Helpful or 👎 Not Helpful

    user = relationship("User", back_populates="activity_completions")
    activity = relationship("Activity", back_populates="completions")


class EnvironmentSnapshot(Base):
    __tablename__ = "environment_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    cloud_cover = Column(Float, nullable=True)
    precipitation = Column(Float, nullable=True)
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    ozone = Column(Float, nullable=True)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="environment_snapshots")


class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    prediction_type = Column(String, nullable=False)  # trend
    prediction_value = Column(String, nullable=False)  # Improving, Stable, Declining
    confidence = Column(Float, nullable=False)
    model_version = Column(String, default="1.0")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="ml_predictions")


class DetectedPattern(Base):
    __tablename__ = "detected_patterns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    pattern_type = Column(String, nullable=False)  # e.g., sleep-mood correlation
    description = Column(Text, nullable=False)
    support_count = Column(Integer, default=0)
    confidence_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="detected_patterns")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"))
    reason = Column(Text, nullable=False)
    recommendation_score = Column(Float, default=0.0)
    feedback = Column(String, nullable=True)  # 👍 Helpful, 👎 Not Helpful, None
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="recommendations")
    activity = relationship("Activity", back_populates="recommendations")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    consent_type = Column(String, nullable=False)  # e.g., location, environment
    is_granted = Column(Boolean, default=False)
    granted_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="consent_records")
