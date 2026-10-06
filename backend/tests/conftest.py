"""
Shared pytest fixtures.

The test suite runs against a **separate SQLite file** created per session and
deleted afterwards. It must never touch backend/soulsync.db: that is the
working database, and it accumulates real check-ins and journal entries as the
app is used. A test run that wiped it would destroy exactly the data this
project promises to treat carefully, so the guard below refuses to run at all
if the engine is pointed anywhere else.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest

# Set before app.core.config is imported anywhere, so Settings picks it up.
TEST_DB_PATH = Path(__file__).resolve().parent / "soulsync_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-only-key-not-used-outside-pytest"
# Rate limits would make repeated login attempts in tests fail spuriously.
os.environ["RATE_LIMIT_LOGIN"] = "1000/minute"
os.environ["RATE_LIMIT_REGISTER"] = "1000/minute"
os.environ["RATE_LIMIT_PASSWORD_RESET"] = "1000/minute"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


def _remove_test_db() -> None:
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(TEST_DB_PATH) + suffix)
        if candidate.exists():
            candidate.unlink()


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> Generator[None, None, None]:
    assert "soulsync_test.db" in str(engine.url), (
        f"Tests are pointed at {engine.url!r}, not the test database. "
        "Refusing to run so real data cannot be destroyed."
    )
    _remove_test_db()
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()
    _remove_test_db()


@pytest.fixture(autouse=True)
def _clean_tables() -> Generator[None, None, None]:
    """
    Truncate between tests so each one starts from an empty database.

    Deleting in reverse dependency order avoids relying on cascade behaviour
    here — the cascade itself is what test_cascade_delete verifies, and a
    fixture should not depend on the thing under test.
    """
    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


VALID_PASSWORD = "Soulsync2026"


@pytest.fixture
def registered(client: TestClient) -> dict:
    """A registered user plus their token pair."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Person",
            "email": "test.person@example.com",
            "password": VALID_PASSWORD,
            "timezone": "Asia/Kolkata",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "user": body["user"],
        "access_token": body["tokens"]["access_token"],
        "refresh_token": body["tokens"]["refresh_token"],
        "email": "test.person@example.com",
        "password": VALID_PASSWORD,
    }


@pytest.fixture
def auth_headers(registered: dict) -> dict:
    return {"Authorization": f"Bearer {registered['access_token']}"}
