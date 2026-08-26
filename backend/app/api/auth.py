from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.models import User, UserProfile, ConsentRecord
from app.schemas.schemas import UserCreate, UserResponse, Token, UserProfileUpdate, UserProfileResponse, ConsentRecordCreate, ConsentRecordResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_user
import datetime

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )
    
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create default user profile
    new_profile = UserProfile(
        user_id=new_user.id,
        timezone="UTC",
        wellness_goals=[]
    )
    db.add(new_profile)
    db.commit()
    
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    
    # Generate JWT token
    access_token = create_access_token(subject=user.email)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/profile", response_model=UserProfileResponse)
def read_profile_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/me/profile", response_model=UserProfileResponse)
def update_profile_me(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile.timezone = profile_in.timezone
    profile.wellness_goals = profile_in.wellness_goals
    profile.personalization_enabled = profile_in.personalization_enabled
    profile.location_enabled = profile_in.location_enabled
    
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/consent", response_model=ConsentRecordResponse)
def record_consent(
    consent_in: ConsentRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    consent = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == current_user.id,
        ConsentRecord.consent_type == consent_in.consent_type
    ).first()
    
    if consent:
        consent.is_granted = consent_in.is_granted
        if consent_in.is_granted:
            consent.granted_at = datetime.datetime.utcnow()
            consent.revoked_at = None
        else:
            consent.revoked_at = datetime.datetime.utcnow()
    else:
        consent = ConsentRecord(
            user_id=current_user.id,
            consent_type=consent_in.consent_type,
            is_granted=consent_in.is_granted
        )
        db.add(consent)
        
    db.commit()
    db.refresh(consent)
    return consent
