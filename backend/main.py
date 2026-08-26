from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import engine, Base
from app.api import auth, moods, journals, sleep, insights, recommendations, companion

# Create database tables automatically on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
origins = [
    "http://localhost:3000",  # Frontend local development port
    "http://127.0.0.1:3000",
    "*"                       # Allow all for deployment simplicity
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(moods.router, prefix=f"{settings.API_V1_STR}/moods", tags=["Mood Tracking"])
app.include_router(sleep.router, prefix=f"{settings.API_V1_STR}/sleep", tags=["Sleep Tracking"])
app.include_router(journals.router, prefix=f"{settings.API_V1_STR}/journals", tags=["Journal Analysis"])
app.include_router(insights.router, prefix=f"{settings.API_V1_STR}/insights", tags=["Insights & Patterns"])
app.include_router(recommendations.router, prefix=f"{settings.API_V1_STR}/recommendations", tags=["Recommendations"])
app.include_router(companion.router, prefix=f"{settings.API_V1_STR}/companion", tags=["AI Wellness Companion"])

@app.get("/")
def read_root():
    return {"message": "Welcome to SoulSync Fullstack AI API Server!"}
