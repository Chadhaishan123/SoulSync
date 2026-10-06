"""
ORM model registry.

`init_db()` imports this package so every mapper is registered on
Base.metadata before create_all runs. Import models from here rather than from
the individual modules — it keeps call sites stable if a model moves.
"""

from app.models.activity import Activity, ActivityCompletion, Recommendation
from app.models.companion import ConversationMessage, ConversationSession
from app.models.journal import (
    GratitudeItem,
    JournalAnalysis,
    JournalEntry,
    ReframeEntry,
    TimeCapsule,
)
from app.models.ml import DetectedPattern, MLPrediction
from app.models.tracking import EnvironmentSnapshot, MoodEntry, SleepRecord
from app.models.user import (
    ConsentRecord,
    PasswordResetToken,
    RefreshToken,
    User,
    UserProfile,
)

__all__ = [
    "Activity",
    "ActivityCompletion",
    "ConsentRecord",
    "ConversationMessage",
    "ConversationSession",
    "DetectedPattern",
    "EnvironmentSnapshot",
    "GratitudeItem",
    "JournalAnalysis",
    "JournalEntry",
    "MLPrediction",
    "MoodEntry",
    "PasswordResetToken",
    "Recommendation",
    "ReframeEntry",
    "RefreshToken",
    "SleepRecord",
    "TimeCapsule",
    "User",
    "UserProfile",
]
