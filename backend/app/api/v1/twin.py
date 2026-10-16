"""Digital Twin API router: Scenario Simulation, Vector Memory Bank, Wearable Biometrics, 3D Avatar."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.twin import DigitalTwinState
from app.schemas.twin import (
    SimulationRequest,
    SimulationResponse,
    MemoryQueryRequest,
    MemoryResponse,
    BiometricsResponse,
    BiometricsSyncRequest,
    AvatarUpdateRequest,
    AvatarResponse,
)
from app.services.twin.simulator import simulate_scenario
from app.services.twin.memory import recall_memories
from app.services.twin.biometrics import get_user_biometrics, sync_user_biometrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twin", tags=["digital-twin"])


@router.post("/simulate", response_model=SimulationResponse)
def simulate_lifestyle_scenario(
    payload: SimulationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulationResponse:
    """Predict emotional, stress, and energy outcomes for hypothetical actions."""
    return simulate_scenario(db=db, user=user, scenario=payload.scenario)


@router.post("/memories/recall", response_model=MemoryResponse)
def query_semantic_memories(
    payload: MemoryQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoryResponse:
    """Recall past emotional episodes and subconscious patterns via Pinecone / TF-IDF."""
    return recall_memories(db=db, user=user, query=payload.query)


@router.get("/biometrics", response_model=BiometricsResponse)
def get_biometrics_stream(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BiometricsResponse:
    """Retrieve wearable physiological vitals (HRV, Resting HR, Recovery %, Vagal Tone)."""
    return get_user_biometrics(db=db, user_id=user.id)


@router.post("/biometrics/sync", response_model=BiometricsResponse)
def sync_wearable_feed(
    payload: BiometricsSyncRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BiometricsResponse:
    """Simulate or sync incoming wearable biometrics packet."""
    state = db.query(DigitalTwinState).filter(DigitalTwinState.user_id == user.id).first()
    if not state:
        state = DigitalTwinState(
            user_id=user.id,
            wearable_connected=True,
            wearable_provider=payload.provider or "Apple Health",
        )
        db.add(state)
    else:
        state.wearable_connected = True
        if payload.provider:
            state.wearable_provider = payload.provider
    db.commit()

    return sync_user_biometrics(db=db, user_id=user.id, payload=payload)


@router.get("/avatar", response_model=AvatarResponse)
def get_avatar_state(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AvatarResponse:
    """Retrieve 3D Ready Player Me avatar configuration and living aura persona."""
    state = db.query(DigitalTwinState).filter(DigitalTwinState.user_id == user.id).first()
    avatar_url = state.avatar_url if state else None
    aura_style = state.aura_style if state else "living_orb"
    return AvatarResponse(
        avatar_url=avatar_url,
        aura_style=aura_style,
        current_pattern="Bio-Synchronized Harmonic",
    )


@router.post("/avatar", response_model=AvatarResponse)
def update_avatar_state(
    payload: AvatarUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AvatarResponse:
    """Update Ready Player Me .glb URL or customized visual persona."""
    state = db.query(DigitalTwinState).filter(DigitalTwinState.user_id == user.id).first()
    if not state:
        state = DigitalTwinState(
            user_id=user.id,
            avatar_url=payload.avatar_url,
            aura_style="living_orb",
        )
        db.add(state)
    else:
        state.avatar_url = payload.avatar_url
    db.commit()

    return AvatarResponse(
        avatar_url=state.avatar_url,
        aura_style=state.aura_style,
        current_pattern="Bio-Synchronized Harmonic",
    )
