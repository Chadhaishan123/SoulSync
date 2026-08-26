from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict
from app.database.session import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.services.ai_service import ai_service
from app.services.ml_service import ml_service

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []  # List of {"role": "user"/"assistant", "content": "..."}

@router.post("/chat")
def chat_with_companion(
    chat_in: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch trend summary for context
    trend_res = ml_service.predict_trend(current_user.id, db)
    trends_summary = trend_res["explanation"]
    
    # Generate response
    reply = ai_service.generate_chat_response(
        chat_in.message,
        chat_in.history,
        trends_summary
    )
    
    return {"reply": reply}
