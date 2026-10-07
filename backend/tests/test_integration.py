"""
SoulSync integration tests.

Tests the full API lifecycle: register → login → check-in → journal →
analyze → sleep → companion → insights → recommendations. Each test uses
a real SQLite database and actual ML/NLP pipelines.

Run with:
    cd backend
    python -m pytest tests/test_integration.py -v
"""

from __future__ import annotations

import datetime as dt
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Setup test database BEFORE importing app ──
TEST_DB = "sqlite:///./test_soulsync.db"
os.environ["DATABASE_URL"] = TEST_DB
os.environ["ENVIRONMENT"] = "test"

from app.db.session import Base, get_db
from app.main import app


# Create a fresh database for each test session
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create all tables before tests, drop after."""
    # Installed here rather than at import time: a module-level override is
    # applied during collection and would redirect every other test file to
    # this database too.
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    db_path = "./test_soulsync.db"
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except PermissionError:
        pass  # Windows file lock — harmless


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def _extract_token(resp_json: dict) -> str:
    """Extract access_token from AuthResponse (tokens.access_token)."""
    if "tokens" in resp_json:
        return resp_json["tokens"]["access_token"]
    return resp_json["access_token"]


@pytest.fixture
def auth_headers(client):
    """Register a test user and return auth headers."""
    # Register
    resp = client.post("/api/v1/auth/register", json={
        "email": "test@soulsync.dev",
        "password": "TestPass123!",
        "name": "Test User",
    })
    assert resp.status_code in (201, 200, 409), f"Register failed: {resp.text}"

    # Login
    resp = client.post("/api/v1/auth/login", json={
        "email": "test@soulsync.dev",
        "password": "TestPass123!",
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = _extract_token(resp.json())
    return {"Authorization": f"Bearer {token}"}


# =====================================================================
# 1. Health & Meta
# =====================================================================

class TestMeta:
    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "SoulSync"
        assert "version" in data

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["database"]["reachable"] is True


# =====================================================================
# 2. Auth
# =====================================================================

class TestAuth:
    def test_register_returns_tokens(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "auth_test@soulsync.dev",
            "password": "SecurePass99!",
            "name": "Auth Test",
        })
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "tokens" in data
        assert "access_token" in data["tokens"]
        assert "refresh_token" in data["tokens"]

    def test_register_duplicate_email(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "dup@soulsync.dev",
            "password": "SecurePass99!",
            "name": "Dup Test",
        })
        resp = client.post("/api/v1/auth/register", json={
            "email": "dup@soulsync.dev",
            "password": "SecurePass99!",
            "name": "Dup Test 2",
        })
        assert resp.status_code == 409

    def test_login_valid(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "login_test@soulsync.dev",
            "password": "LoginPass99!",
            "name": "Login Test",
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "login_test@soulsync.dev",
            "password": "LoginPass99!",
        })
        assert resp.status_code == 200
        assert "tokens" in resp.json()

    def test_login_wrong_password(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "login_test@soulsync.dev",
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 401

    def test_protected_route_no_token(self, client):
        resp = client.get("/api/v1/users/me")
        assert resp.status_code in (401, 403)


# =====================================================================
# 3. User Profile
# =====================================================================

class TestProfile:
    def test_get_me(self, client, auth_headers):
        resp = client.get("/api/v1/users/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@soulsync.dev"


# =====================================================================
# 4. Check-ins
# =====================================================================

class TestCheckins:
    def test_create_checkin(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/checkins", headers=auth_headers, json={
            "mood_score": 7,
            "stress_level": 4,
            "energy_level": 6,
            "sleep_quality": 7,
            "primary_emotion": "Happy",
            "context_tags": ["work", "exercise"],
            "notes": "Had a productive day at work, went for a run.",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["mood_score"] == 7

    def test_create_multiple_checkins(self, client, auth_headers):
        """Create enough check-ins for ML models to work."""
        checkins = [
            {"mood_score": 6, "stress_level": 5, "energy_level": 5, "sleep_quality": 6, "primary_emotion": "Calm"},
            {"mood_score": 8, "stress_level": 3, "energy_level": 7, "sleep_quality": 8, "primary_emotion": "Happy"},
            {"mood_score": 4, "stress_level": 7, "energy_level": 3, "sleep_quality": 4, "primary_emotion": "Anxious"},
            {"mood_score": 5, "stress_level": 6, "energy_level": 4, "sleep_quality": 5, "primary_emotion": "Neutral"},
            {"mood_score": 7, "stress_level": 4, "energy_level": 6, "sleep_quality": 7, "primary_emotion": "Happy"},
            {"mood_score": 3, "stress_level": 8, "energy_level": 2, "sleep_quality": 3, "primary_emotion": "Sad"},
            {"mood_score": 8, "stress_level": 2, "energy_level": 8, "sleep_quality": 9, "primary_emotion": "Happy"},
            {"mood_score": 6, "stress_level": 5, "energy_level": 5, "sleep_quality": 6, "primary_emotion": "Calm"},
            {"mood_score": 9, "stress_level": 1, "energy_level": 9, "sleep_quality": 8, "primary_emotion": "Happy"},
            {"mood_score": 5, "stress_level": 6, "energy_level": 4, "sleep_quality": 5, "primary_emotion": "Neutral"},
            {"mood_score": 7, "stress_level": 3, "energy_level": 7, "sleep_quality": 7, "primary_emotion": "Happy"},
            {"mood_score": 4, "stress_level": 7, "energy_level": 3, "sleep_quality": 4, "primary_emotion": "Anxious"},
            {"mood_score": 6, "stress_level": 4, "energy_level": 6, "sleep_quality": 6, "primary_emotion": "Calm"},
            {"mood_score": 8, "stress_level": 2, "energy_level": 8, "sleep_quality": 8, "primary_emotion": "Happy"},
        ]
        for c in checkins:
            resp = client.post("/api/v1/users/me/checkins", headers=auth_headers, json=c)
            assert resp.status_code == 201, f"Check-in failed: {resp.text}"

    def test_list_checkins(self, client, auth_headers):
        resp = client.get("/api/v1/users/me/checkins", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 10

    def test_checkin_validation_mood_range(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/checkins", headers=auth_headers, json={
            "mood_score": 15,  # Out of range
        })
        assert resp.status_code == 422


# =====================================================================
# 5. Journal + NLP
# =====================================================================

class TestJournal:
    def test_create_journal(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/journal", headers=auth_headers, json={
            "content": "Today was a wonderful day. I went for a long walk in the park and felt really grateful for the sunshine. My stress levels have been going down this week.",
            "title": "A grateful day",
            "kind": "gratitude",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "A grateful day"
        assert data["word_count"] > 0

    def test_list_journal(self, client, auth_headers):
        resp = client.get("/api/v1/users/me/journal", headers=auth_headers)
        assert resp.status_code == 200
        entries = resp.json()
        assert len(entries) >= 1

    def test_analyze_journal(self, client, auth_headers):
        entries = client.get("/api/v1/users/me/journal", headers=auth_headers).json()
        entry_id = entries[0]["id"]

        resp = client.post(
            f"/api/v1/users/me/journal/{entry_id}/analyze",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        analysis = resp.json()
        assert "sentiment_score" in analysis
        assert "sentiment_label" in analysis
        assert analysis["engine"] in ("lexicon", "transformer")
        assert "emotions" in analysis
        assert "dominant_emotion" in analysis
        assert analysis["safety_level"] == "none"

    def test_analyze_nonexistent_entry(self, client, auth_headers):
        resp = client.post(
            "/api/v1/users/me/journal/99999/analyze",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# =====================================================================
# 6. Sleep
# =====================================================================

class TestSleep:
    def test_create_sleep(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/sleep", headers=auth_headers, json={
            "sleep_date": "2025-09-20",
            "duration_minutes": 450,
            "quality_rating": 4,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_minutes"] == 450

    def test_duplicate_sleep_date(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/sleep", headers=auth_headers, json={
            "sleep_date": "2025-09-20",
            "duration_minutes": 400,
        })
        assert resp.status_code == 409

    def test_list_sleep(self, client, auth_headers):
        resp = client.get("/api/v1/users/me/sleep", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# =====================================================================
# 7. AI Companion
# =====================================================================

class TestCompanion:
    def test_send_message(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/companion", headers=auth_headers, json={
            "message": "How is my mood trending lately?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert "session_id" in data
        assert data["engine"] in ("template", "safety")
        assert len(data["reply"]) > 20

    def test_continue_session(self, client, auth_headers):
        resp1 = client.post("/api/v1/users/me/companion", headers=auth_headers, json={
            "message": "Tell me about my sleep patterns",
        })
        session_id = resp1.json()["session_id"]

        resp2 = client.post("/api/v1/users/me/companion", headers=auth_headers, json={
            "message": "What about my stress levels?",
            "session_id": session_id,
        })
        assert resp2.status_code == 200
        assert resp2.json()["session_id"] == session_id

    def test_list_sessions(self, client, auth_headers):
        resp = client.get("/api/v1/users/me/companion/sessions", headers=auth_headers)
        assert resp.status_code == 200
        sessions = resp.json()
        assert len(sessions) >= 1

    def test_nonexistent_session(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/companion", headers=auth_headers, json={
            "message": "Hello",
            "session_id": 99999,
        })
        assert resp.status_code == 404

    def test_get_session_messages(self, client, auth_headers):
        resp = client.post("/api/v1/users/me/companion", headers=auth_headers, json={
            "message": "Hello companion, test history retrieval",
        })
        assert resp.status_code == 200
        session_id = resp.json()["session_id"]

        resp_msgs = client.get(
            f"/api/v1/users/me/companion/sessions/{session_id}/messages",
            headers=auth_headers,
        )
        assert resp_msgs.status_code == 200
        msgs = resp_msgs.json()
        assert len(msgs) >= 2
        assert msgs[0]["role"] == "user"
        assert msgs[0]["content"] == "Hello companion, test history retrieval"
        assert msgs[1]["role"] == "assistant"


# =====================================================================
# 8. Insights Dashboard (ML-powered)
# =====================================================================

class TestInsights:
    def test_dashboard(self, client, auth_headers):
        resp = client.get("/api/insights/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # Weather
        assert data["weather"] is not None
        assert "state" in data["weather"]
        assert "forecast" in data["weather"]

        # Trend (ML-backed with 15+ check-ins)
        assert data["trend_prediction"] is not None
        assert data["trend_prediction"]["direction"] in ("improving", "stable", "declining")
        assert 0 <= data["trend_prediction"]["confidence"] <= 1

        # Anomaly
        assert data["anomaly"] is not None
        assert isinstance(data["anomaly"]["is_anomaly"], bool)

        # Digital Twin
        assert data["digital_twin"] is not None
        assert "current_pattern" in data["digital_twin"]
        assert data["digital_twin"]["total_days"] >= 10


# =====================================================================
# 9. Recommendations
# =====================================================================

class TestRecommendations:
    def test_list_recommendations(self, client, auth_headers):
        resp = client.get("/api/recommendations", headers=auth_headers)
        assert resp.status_code == 200

    def test_feedback_nonexistent(self, client, auth_headers):
        resp = client.post("/api/recommendations/99999/feedback", headers=auth_headers, json={
            "feedback": "helpful",
        })
        assert resp.status_code == 404


# =====================================================================
# 10. NLP Service Unit Tests
# =====================================================================

class TestNLPService:
    def test_positive_sentiment(self):
        from app.services.nlp import analyze_text
        result = analyze_text("I feel wonderful and grateful today!")
        assert result["sentiment_label"] == "positive"
        assert result["sentiment_score"] > 0
        assert result["safety_level"] == "none"

    def test_negative_sentiment(self):
        from app.services.nlp import analyze_text
        result = analyze_text("I am feeling sad and exhausted, everything is terrible.")
        assert result["sentiment_label"] == "negative"
        assert result["sentiment_score"] < 0

    def test_safety_critical(self):
        from app.services.nlp import analyze_text
        result = analyze_text("I want to end my life")
        assert result["safety_level"] == "critical"
        assert "safety_message" in result
        assert "safety_resources" in result

    def test_safety_elevated(self):
        from app.services.nlp import analyze_text
        result = analyze_text("I feel hopeless and worthless")
        assert result["safety_level"] == "elevated"

    def test_engine_reported(self):
        from app.services.nlp import analyze_text
        result = analyze_text("Just a normal day")
        assert result["engine"] in ("lexicon", "transformer")


# =====================================================================
# 11. ML Service Unit Tests
# =====================================================================

class TestMLServices:
    @pytest.fixture()
    def mock_entries(self):
        """Create mock MoodEntry-like objects for ML testing."""
        class MockEntry:
            def __init__(self, mood, stress, energy, sleep_q, emotion, day_offset):
                self.mood_score = mood
                self.stress_level = stress
                self.energy_level = energy
                self.sleep_quality = sleep_q
                self.primary_emotion = emotion
                self.recorded_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=day_offset)
                self.local_date = (dt.date.today() - dt.timedelta(days=day_offset))

        return [
            MockEntry(7, 4, 6, 7, "Happy", 0),
            MockEntry(6, 5, 5, 6, "Calm", 1),
            MockEntry(8, 3, 7, 8, "Happy", 2),
            MockEntry(4, 7, 3, 4, "Anxious", 3),
            MockEntry(5, 6, 4, 5, "Neutral", 4),
            MockEntry(7, 4, 6, 7, "Happy", 5),
            MockEntry(3, 8, 2, 3, "Sad", 6),
            MockEntry(8, 2, 8, 9, "Happy", 7),
            MockEntry(6, 5, 5, 6, "Calm", 8),
            MockEntry(9, 1, 9, 8, "Happy", 9),
            MockEntry(5, 6, 4, 5, "Neutral", 10),
            MockEntry(7, 3, 7, 7, "Happy", 11),
            MockEntry(4, 7, 3, 4, "Anxious", 12),
            MockEntry(6, 4, 6, 6, "Calm", 13),
            MockEntry(8, 2, 8, 8, "Happy", 14),
        ]

    def test_trend_predictor(self, mock_entries):
        from app.services.ml import predict_trend
        result = predict_trend(mock_entries)
        assert result["direction"] in ("improving", "stable", "declining")
        assert 0 <= result["confidence"] <= 1
        assert result["is_model_backed"] is True
        assert result["model_name"] == "RandomForestClassifier"

    def test_trend_predictor_insufficient_data(self):
        from app.services.ml import predict_trend
        result = predict_trend([])
        assert result["is_model_backed"] is False

    def test_clustering(self, mock_entries):
        from app.services.ml import cluster_user
        result = cluster_user(mock_entries)
        assert "current_pattern" in result
        assert result["total_days"] == 15
        assert result["is_model_backed"] is True
        assert result["model_name"] == "KMeans"
        assert sum(result["clusters"].values()) == 15

    def test_anomaly_detection(self, mock_entries):
        from app.services.ml import detect_anomalies
        result = detect_anomalies(mock_entries)
        assert isinstance(result["is_anomaly"], bool)
        assert result["is_model_backed"] is True
        assert result["model_name"] == "IsolationForest"

    def test_pattern_discovery(self, mock_entries):
        from app.services.ml import discover_patterns
        result = discover_patterns(mock_entries)
        assert result["is_sufficient"] is True
        assert isinstance(result["patterns"], list)
        assert len(result["patterns"]) >= 1
        for p in result["patterns"]:
            assert "pattern_type" in p
            assert "statistic" in p
            assert "p_value" in p

    def test_mind_weather_simulation(self, client, auth_headers):
        resp = client.post(
            "/api/v1/insights/simulate",
            headers=auth_headers,
            json={
                "sleep_hours": 8.0,
                "exercise_minutes": 35,
                "meditation_minutes": 15,
                "outdoor_minutes": 20,
            },
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "simulated_mood" in data
        assert "predicted_weather" in data
        assert "anxiety_reduction_pct" in data
        assert data["anxiety_reduction_pct"] > 0
        assert len(data["recommendations"]) > 0

    def test_digital_twin_chat(self, client, auth_headers):
        resp = client.post(
            "/api/v1/insights/twin/chat",
            headers=auth_headers,
            json={"message": "How does my sleep affect my mood and stress?"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "reply" in data
        assert "dominant_pattern" in data
        assert len(data["reply"]) > 20

