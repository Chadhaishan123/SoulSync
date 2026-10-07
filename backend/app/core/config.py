"""
SoulSync application configuration.

All settings are read from environment variables (or backend/.env) via
pydantic-settings. Two rules are enforced here rather than left to
convention:

  1. In production the app REFUSES to start with the development
     SECRET_KEY. A leaked JWT signing key compromises every session,
     so this fails loudly at import time instead of silently.

  2. CORS origins are an explicit allowlist. The wildcard "*" combined
     with allow_credentials=True is rejected by browsers, so it is
     never used.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import List, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

DEV_SECRET_KEY = "dev-only-insecure-key-change-before-any-deployment"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ---------------------------------------------------------------- meta
    PROJECT_NAME: str = "SoulSync"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "production", "test"] = "development"

    # ------------------------------------------------------------ security
    SECRET_KEY: str = DEV_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # -------------------------------------------------------- email / reset
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@soulsync.app"
    FRONTEND_URL: str = "http://localhost:3000"

    # ------------------------------------------------------------ database
    # Blank => zero-setup SQLite at backend/soulsync.db
    DATABASE_URL: str = ""

    # -------------------------------------------------------- rate limiting
    REDIS_URL: str = ""
    RATE_LIMIT_LOGIN: str = "10/minute"
    RATE_LIMIT_REGISTER: str = "5/minute"
    # Tighter than login: this endpoint is also an email-enumeration probe and
    # (in production) a way to make the server send mail on demand.
    RATE_LIMIT_PASSWORD_RESET: str = "5/hour"
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_NLP: str = "60/minute"
    # These endpoints spend someone else's free-tier quota, so the cap protects
    # the upstream as much as this server. The TTL cache absorbs most repeats.
    RATE_LIMIT_ENVIRONMENT: str = "60/minute"

    # ---------------------------------------------------------------- cors
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ------------------------------------------------- real-time (keyless)
    OPEN_METEO_WEATHER_URL: str = "https://api.open-meteo.com/v1/forecast"
    OPEN_METEO_AIR_QUALITY_URL: str = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
    )
    NAGER_DATE_URL: str = "https://date.nager.at/api/v3"
    # Keyless reverse geocoding, so a real city name works with zero signup.
    # Superseded by OpenCage when a key is configured.
    BIGDATACLOUD_URL: str = (
        "https://api.bigdatacloud.net/data/reverse-geocode-client"
    )
    UPSTREAM_TIMEOUT_SECONDS: float = 6.0

    # How long a fetched reading may be reused for the same coordinates.
    # Not a way to serve stale data as fresh: every environment response
    # reports `fetched_at` and `cache_age_seconds` so the client can see
    # exactly how old a number is. Weather and AQI move on the scale of tens
    # of minutes, and Open-Meteo's free tier is a shared resource that a
    # dashboard polling on every page mount would otherwise exhaust.
    ENV_CACHE_TTL_SECONDS: int = 600
    # Holidays for a country-year are fixed; refetching them is pure waste.
    HOLIDAY_CACHE_TTL_SECONDS: int = 86_400

    # ----------------------------------------------- real-time (free keys)
    # Server-side only. These are never sent to the browser: a key embedded in
    # frontend JavaScript is a published key.
    #
    # Both are genuinely optional and both are actually used when present:
    # OpenCage replaces the keyless geocoder, and Tomorrow.io supplies pollen
    # outside Europe, where the free CAMS model publishes none.
    OPENCAGE_API_KEY: str = ""
    OPENCAGE_URL: str = "https://api.opencagedata.com/geocode/v1/json"
    TOMORROW_IO_API_KEY: str = ""
    TOMORROW_IO_URL: str = "https://api.tomorrow.io/v4/weather/realtime"

    # ----------------------------------------------------------- nlp / ai
    ENABLE_TRANSFORMER_NLP: bool = True
    EMOTION_MODEL: str = "bhadresh-savani/distilbert-base-uncased-emotion"
    # Used when EMOTION_MODEL points at a local fine-tuned model that is
    # missing, incomplete (e.g. quarantined by antivirus) or fails to load.
    EMOTION_MODEL_FALLBACK: str = "bhadresh-savani/distilbert-base-uncased-emotion"
    SENTIMENT_MODEL: str = "distilbert-base-uncased-finetuned-sst-2-english"

    COMPANION_ENGINE: Literal["local", "template", "ollama", "claude"] = "local"
    COMPANION_MODEL: str = "google/flan-t5-base"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    ANTHROPIC_API_KEY: str = ""
    HF_HOME: str = ""

    # ------------------------------------------------------- geo (no default)
    # There is deliberately no DEFAULT_LAT / DEFAULT_CITY here.
    #
    # The previous build carried a New Delhi fallback and used it even when
    # location consent had been granted, so every "live" weather reading was
    # confidently wrong for anyone outside Delhi. A fabricated location is
    # worse than no location: the user cannot tell the difference, and every
    # weather-mood correlation computed from it is nonsense.
    #
    # Environment endpoints therefore require real coordinates and return an
    # explicit "location needed" response when they are absent.

    # ------------------------------------------------------------ limits
    MAX_JOURNAL_CHARS: int = 20_000
    MAX_CHAT_CHARS: int = 2_000
    MIN_PASSWORD_LENGTH: int = 8
    # bcrypt silently truncates past 72 bytes; reject instead of truncating.
    MAX_PASSWORD_LENGTH: int = 72

    # =============================================================== derived
    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_dev_key_in_production(cls, v: str, info) -> str:
        env = (info.data or {}).get("ENVIRONMENT")
        if env == "production" and (not v or v == DEV_SECRET_KEY):
            raise ValueError(
                "SECRET_KEY must be set to a unique random value when "
                "ENVIRONMENT=production. Generate one with:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        # An empty key in dev would sign tokens with "" — generate a
        # per-process key so tokens are at least not forgeable.
        return v or secrets.token_urlsafe(64)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def sqlalchemy_url(self) -> str:
        """Resolved DB URL. Blank DATABASE_URL => SQLite in backend/."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"sqlite:///{(BACKEND_DIR / 'soulsync.db').as_posix()}"

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def cors_origins(self) -> List[str]:
        """Explicit allowlist. Never a wildcard — credentials are enabled."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def uses_dev_secret(self) -> bool:
        return self.SECRET_KEY == DEV_SECRET_KEY


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
