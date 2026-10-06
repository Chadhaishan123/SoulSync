"""
SoulSync API application factory.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import auth, checkins, companion, environment, insights, journal, recommendations, sleep, users
from app.core.config import settings
from app.core.limiter import SLOWAPI_AVAILABLE, limiter
from app.db.session import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("soulsync")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("Starting %s API (%s)", settings.PROJECT_NAME, settings.ENVIRONMENT)
    init_db()

    # The activity catalogue is reference content, not user data — see the note
    # in app/db/seed.py. Nothing about a user's mood, sleep or journals is ever
    # seeded; those only ever come from the person using the app.
    from app.db.seed import seed_activities
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        seed_activities(db)
    except Exception:  # pragma: no cover
        # A catalogue problem must not stop the API from serving auth and
        # check-ins; the recommendation surface degrades instead.
        log.exception("Activity catalogue seed failed — continuing without it.")
    finally:
        db.close()

    if settings.uses_dev_secret and not settings.is_production:
        log.warning(
            "Using the development SECRET_KEY. Set a real one before deploying "
            "(ENVIRONMENT=production refuses to start without it)."
        )
    log.info("CORS allowlist: %s", ", ".join(settings.cors_origins))
    yield

    # The environment service holds a keep-alive pool to Open-Meteo and friends;
    # closing it here keeps --reload from leaving sockets behind on every edit.
    from app.services.environment import close_client

    await close_client()
    log.info("Shutting down %s API", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        description=(
            "Backend for SoulSync. Every insight is computed from the signed-in "
            "user's own logged entries plus live third-party data — no synthetic "
            "or generated records exist in this database."
        ),
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Explicit allowlist. A wildcard origin is silently ignored by browsers
    # when allow_credentials=True, which is how the previous build ended up
    # with CORS that looked permissive but rejected every real request.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        # Lets the frontend surface "you're sending requests too quickly"
        # with the real retry window instead of a generic error.
        expose_headers=[
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "Retry-After",
        ],
    )

    if SLOWAPI_AVAILABLE:
        from slowapi.errors import RateLimitExceeded

        app.state.limiter = limiter

        @app.exception_handler(RateLimitExceeded)
        async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
            retry_after = getattr(exc, "retry_after", None)
            headers = {"Retry-After": str(retry_after)} if retry_after else {}
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": (
                        "Too many requests. Please wait a moment and try again."
                    ),
                    "limit": str(exc.detail),
                },
                headers=headers,
            )

    app.include_router(auth.router, prefix=settings.API_V1_STR)
    app.include_router(users.router, prefix=settings.API_V1_STR)
    app.include_router(environment.router, prefix=settings.API_V1_STR)
    app.include_router(checkins.router, prefix=settings.API_V1_STR)
    app.include_router(journal.router, prefix=settings.API_V1_STR)
    app.include_router(sleep.router, prefix=settings.API_V1_STR)
    app.include_router(companion.router, prefix=settings.API_V1_STR)
    # insights and recommendations support both /api and /api/v1 prefixes
    app.include_router(insights.router, prefix="/api")
    app.include_router(insights.router, prefix=settings.API_V1_STR)
    app.include_router(recommendations.router, prefix="/api")
    app.include_router(recommendations.router, prefix=settings.API_V1_STR)

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "name": settings.PROJECT_NAME,
            "version": app.version,
            "docs": "/docs",
            "api": settings.API_V1_STR,
        }

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        """
        Liveness plus a real database round-trip.

        A health check that only confirms the process is up would have reported
        green while the previous build was failing on every request because its
        database was unreachable.
        """
        from sqlalchemy import text

        from app.db.session import engine

        db_ok = True
        db_error = None
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as exc:  # pragma: no cover
            db_ok = False
            db_error = str(exc)

        payload = {
            "status": "ok" if db_ok else "degraded",
            "environment": settings.ENVIRONMENT,
            "database": {
                "backend": "sqlite" if settings.is_sqlite else "postgresql",
                "reachable": db_ok,
            },
            "rate_limiting": SLOWAPI_AVAILABLE,
        }
        if db_error:
            payload["database"]["error"] = db_error
        return payload

    return app


app = create_app()
