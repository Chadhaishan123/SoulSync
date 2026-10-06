"""
Database engine and session management.

Two details here matter more than they look:

  1. **SQLite foreign keys are OFF by default.** SoulSync relies on
     ON DELETE CASCADE for GDPR account deletion — without the
     `PRAGMA foreign_keys=ON` listener below, deleting a user would leave
     orphaned mood entries, journals and analyses behind. That would be a
     silent privacy failure, not a visible bug.

  2. **SQLite needs `check_same_thread=False`** under FastAPI, because a
     session may be created on one thread and used on another when sync
     endpoints run in the threadpool.
"""

from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base  # noqa: F401  (re-exported for convenience)

log = logging.getLogger("soulsync.db")

_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}

if settings.is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Modest pool sized for a single API container.
    _engine_kwargs.update(pool_size=10, max_overflow=20, pool_recycle=1800)

engine: Engine = create_engine(settings.sqlalchemy_url, **_engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    future=True,
)


if settings.is_sqlite:

    @event.listens_for(engine, "connect")
    def _enforce_sqlite_foreign_keys(dbapi_connection, _connection_record):
        """Turn on FK enforcement so ON DELETE CASCADE actually cascades."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # WAL lets reads proceed during writes — noticeably smoother when the
        # dashboard fires several parallel queries against one SQLite file.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a session that is always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Create any missing tables.

    Importing app.models registers every mapper on Base.metadata before
    create_all runs; without that import the call would silently create
    nothing.
    """
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    backend = "SQLite" if settings.is_sqlite else "PostgreSQL"
    log.info("Database ready (%s).", backend)
