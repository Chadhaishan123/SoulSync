"""
ML audit trail: model outputs and detected patterns.

These two tables are the backbone of the Model Transparency page and were the
biggest honesty gap in the previous build — they existed but nothing ever
wrote to them, so there was no way to answer "where did this number come
from?". Every model run now persists a row here recording the model, its
version, how many of the user's real rows it was fitted on, and the features it
saw. `input_row_count` in particular is what lets the UI say "fitted on your
23 check-ins" instead of presenting a number with unearned authority.
"""

from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, utcnow

if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User

# Prediction kinds
PREDICTION_TREND = "trend"
PREDICTION_CLUSTER = "cluster"
PREDICTION_ANOMALY = "anomaly"
PREDICTION_WELLNESS_SCORE = "wellness_score"
PREDICTION_MOOD_FORECAST = "mood_forecast"
PREDICTION_SIMILAR_DAY = "similar_day"

# Pattern detection methods
METHOD_PEARSON = "pearson"
METHOD_SPEARMAN = "spearman"
METHOD_LAG_CORRELATION = "lag_correlation"
METHOD_LINEAR_REGRESSION = "linear_regression"
METHOD_ASSOCIATION_LIFT = "association_lift"
METHOD_GROUP_COMPARISON = "group_comparison"


class MLPrediction(Base):
    """One model run, recorded for transparency and later evaluation."""

    __tablename__ = "ml_predictions"
    __table_args__ = (
        Index("ix_mlpred_user_kind_created", "user_id", "prediction_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    prediction_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    # Categorical result, e.g. "improving" / "cluster_2" / "anomaly".
    label: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # Numeric result, e.g. the wellness score or a predicted mood.
    numeric_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Plain-language explanation shown to the user.
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Full structured output (per-class probabilities, component breakdowns…).
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    # The feature vector / feature names the model actually saw.
    features: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    # How many of the user's own rows the model was fitted on. A prediction
    # from 6 rows and one from 300 are not the same claim.
    input_row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # False when there was too little data and a documented rule-based path ran
    # instead. The UI must not present these as model output.
    is_model_backed: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    computed_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Window of user data this run covered.
    window_start: Mapped[Optional[dt.date]] = mapped_column(Date, nullable=True)
    window_end: Mapped[Optional[dt.date]] = mapped_column(Date, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False, index=True
    )

    user: Mapped["User"] = relationship(back_populates="ml_predictions")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<MLPrediction {self.prediction_type} label={self.label!r} "
            f"rows={self.input_row_count}>"
        )


class DetectedPattern(Base):
    """
    A statistical relationship found in the user's own data.

    `statistic` and `p_value` are stored so the UI can be honest about
    strength and significance rather than presenting every correlation as a
    finding. A relationship over 8 days with p=0.4 is shown as "not enough
    evidence yet", not as an insight.
    """

    __tablename__ = "detected_patterns"
    __table_args__ = (
        Index("ix_pattern_user_type", "user_id", "pattern_type"),
        Index("ix_pattern_user_active", "user_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # "sleep_mood_lag" | "aqi_mood" | "weekday_mood" | "trigger_tag" |
    # "holiday_mood" | "weather_mood" | "peak_energy"
    pattern_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # The variables involved, e.g. ["sleep_duration", "mood_next_day"].
    variables: Mapped[List[str]] = mapped_column(JSON, default=list)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    statistic: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    p_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    effect_size: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Lag in days: 0 = same day, 1 = sleep(t) -> mood(t+1).
    lag_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    sample_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    strength: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_significant: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_detected_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )
    last_computed_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="detected_patterns")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<DetectedPattern {self.pattern_type} r={self.statistic} "
            f"p={self.p_value} n={self.sample_size}>"
        )
