"""Digital Twin ORM models."""

from __future__ import annotations

from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class DigitalTwinState(Base, TimestampMixin):
    """Stores user's Digital Twin 3D avatar URL, wearable linkage, and persona preferences."""

    __tablename__ = "digital_twin_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    aura_style: Mapped[str] = mapped_column(String(50), default="living_orb")
    wearable_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    wearable_provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
