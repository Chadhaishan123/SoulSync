"""
Profile, consent, onboarding and data-rights tests.

The emphasis is on the guarantees rather than the CRUD: that location cannot be
stored without consent, that revoking consent actually erases what was stored,
that the export is complete but excludes credentials, and that deletion
cascades.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import VALID_PASSWORD

ME = "/api/v1/users/me"


# --------------------------------------------------------------- profile reads

def test_me_returns_account_and_profile_together(client: TestClient, auth_headers: dict):
    body = client.get(ME, headers=auth_headers).json()

    assert body["email"] == "test.person@example.com"
    assert body["is_onboarded"] is False
    assert body["profile"]["timezone"] == "Asia/Kolkata"
    assert body["profile"]["has_real_location"] is False


def test_me_requires_authentication(client: TestClient):
    assert client.get(ME).status_code == 401


def test_created_at_is_serialised_with_a_utc_offset(client: TestClient, auth_headers: dict):
    """
    A naive timestamp is parsed by the browser as local time, so a UTC value
    would display hours off. Guards the UTCDateTime type decorator.
    """
    created = client.get(ME, headers=auth_headers).json()["created_at"]
    assert created.endswith("Z") or "+00:00" in created, created


# -------------------------------------------------------------- profile writes

def test_update_profile_fields(client: TestClient, auth_headers: dict):
    response = client.patch(
        ME,
        headers=auth_headers,
        json={
            "name": "Renamed Person",
            "timezone": "Europe/London",
            "wellness_goals": ["sleep better", "less stress"],
            "reminder_hour": 7,
            "sleep_goal_minutes": 450,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["name"] == "Renamed Person"
    assert body["profile"]["timezone"] == "Europe/London"
    assert body["profile"]["wellness_goals"] == ["sleep better", "less stress"]
    assert body["profile"]["reminder_hour"] == 7
    assert body["profile"]["sleep_goal_minutes"] == 450


def test_partial_update_leaves_other_fields_alone(client: TestClient, auth_headers: dict):
    client.patch(ME, headers=auth_headers, json={"reminder_hour": 9})
    body = client.patch(ME, headers=auth_headers, json={"name": "Only Name"}).json()

    assert body["name"] == "Only Name"
    assert body["profile"]["reminder_hour"] == 9
    assert body["profile"]["timezone"] == "Asia/Kolkata"


def test_unknown_timezone_is_rejected(client: TestClient, auth_headers: dict):
    """
    local_date on every entry derives from this string, so a bad value would
    silently shift the user's day boundary and corrupt their streaks.
    """
    response = client.patch(ME, headers=auth_headers, json={"timezone": "Mars/Olympus"})
    assert response.status_code == 422


def test_blank_name_is_rejected(client: TestClient, auth_headers: dict):
    assert client.patch(ME, headers=auth_headers, json={"name": "   "}).status_code == 422


def test_reminder_hour_out_of_range_is_rejected(client: TestClient, auth_headers: dict):
    assert client.patch(ME, headers=auth_headers, json={"reminder_hour": 24}).status_code == 422


# ----------------------------------------------------------------- email change

def test_email_change_requires_current_password(client: TestClient, auth_headers: dict):
    response = client.patch(
        f"{ME}/email",
        headers=auth_headers,
        json={"new_email": "attacker@example.com", "current_password": "WrongPass123"},
    )
    assert response.status_code == 400
    assert client.get(ME, headers=auth_headers).json()["email"] == "test.person@example.com"


def test_email_change_succeeds_and_allows_login(client: TestClient, auth_headers: dict):
    response = client.patch(
        f"{ME}/email",
        headers=auth_headers,
        json={"new_email": "Moved.Address@Example.com", "current_password": VALID_PASSWORD},
    )
    assert response.status_code == 200, response.text
    # Stored lowercased, or the next login looks like a wrong password.
    assert response.json()["email"] == "moved.address@example.com"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "moved.address@example.com", "password": VALID_PASSWORD},
    )
    assert login.status_code == 200


def test_email_change_rejects_address_in_use(client: TestClient, auth_headers: dict):
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Other",
            "email": "taken@example.com",
            "password": VALID_PASSWORD,
            "timezone": "UTC",
        },
    )
    response = client.patch(
        f"{ME}/email",
        headers=auth_headers,
        json={"new_email": "taken@example.com", "current_password": VALID_PASSWORD},
    )
    assert response.status_code == 409


# --------------------------------------------------------------------- location

def test_location_is_refused_without_consent(client: TestClient, auth_headers: dict):
    """The consent toggle is enforced server-side, not just in the UI."""
    response = client.put(
        f"{ME}/location",
        headers=auth_headers,
        json={"latitude": 28.6139, "longitude": 77.2090},
    )
    assert response.status_code == 403
    assert "consent" in response.json()["detail"].lower()


def test_location_is_stored_once_consent_is_granted(client: TestClient, auth_headers: dict):
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})

    response = client.put(
        f"{ME}/location",
        headers=auth_headers,
        json={"latitude": 19.076, "longitude": 72.8777, "accuracy_m": 35.0},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["last_latitude"] == 19.076
    assert body["last_longitude"] == 72.8777
    assert body["has_real_location"] is True
    assert body["location_updated_at"] is not None
    # City is resolved from coordinates by the environment service, never guessed.
    assert body["last_city"] is None


def test_out_of_range_coordinates_are_rejected(client: TestClient, auth_headers: dict):
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})
    response = client.put(
        f"{ME}/location", headers=auth_headers, json={"latitude": 95.0, "longitude": 0.0}
    )
    assert response.status_code == 422


# --------------------------------------------------------------------- consents

def test_consent_changes_are_recorded_in_history(client: TestClient, auth_headers: dict):
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})
    client.patch(f"{ME}/consents", headers=auth_headers, json={"notifications_enabled": True})

    history = client.get(f"{ME}/consents", headers=auth_headers).json()
    kinds = {(r["consent_type"], r["is_granted"]) for r in history}

    assert ("location", True) in kinds
    assert ("notifications", True) in kinds
    for record in history:
        if record["is_granted"]:
            assert record["granted_at"] is not None and record["revoked_at"] is None
        else:
            assert record["revoked_at"] is not None


def test_unchanged_consent_does_not_add_history_noise(client: TestClient, auth_headers: dict):
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})
    before = len(client.get(f"{ME}/consents", headers=auth_headers).json())

    # Same value again — a settings re-save, not a consent decision.
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})
    after = len(client.get(f"{ME}/consents", headers=auth_headers).json())

    assert after == before


def test_revoking_location_erases_stored_coordinates(client: TestClient, auth_headers: dict):
    """
    A revoke that left the last position in the database would be cosmetic —
    the user asked us to stop holding their location.
    """
    client.patch(
        f"{ME}/consents",
        headers=auth_headers,
        json={"location_enabled": True, "environment_enabled": True},
    )
    client.put(
        f"{ME}/location", headers=auth_headers, json={"latitude": 51.5, "longitude": -0.12}
    )

    body = client.patch(
        f"{ME}/consents", headers=auth_headers, json={"location_enabled": False}
    ).json()

    assert body["last_latitude"] is None
    assert body["last_longitude"] is None
    assert body["location_updated_at"] is None
    assert body["has_real_location"] is False
    # Environment readings are fetched *for* coordinates, so that consent
    # cannot outlive location consent.
    assert body["environment_enabled"] is False


def test_environment_consent_requires_location_consent(client: TestClient, auth_headers: dict):
    response = client.patch(
        f"{ME}/consents", headers=auth_headers, json={"environment_enabled": True}
    )
    assert response.status_code == 400
    assert "location" in response.json()["detail"].lower()


def test_environment_consent_allowed_alongside_location(client: TestClient, auth_headers: dict):
    response = client.patch(
        f"{ME}/consents",
        headers=auth_headers,
        json={"location_enabled": True, "environment_enabled": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["environment_enabled"] is True


# ------------------------------------------------------------------- onboarding

def test_onboarding_sets_preferences_and_marks_complete(client: TestClient, auth_headers: dict):
    response = client.post(
        f"{ME}/onboarding",
        headers=auth_headers,
        json={
            "timezone": "Asia/Kolkata",
            "wellness_goals": ["sleep", "focus"],
            "reminder_hour": 21,
            "sleep_goal_minutes": 510,
            "location_enabled": True,
            "environment_enabled": True,
            "nlp_analysis_enabled": True,
            "notifications_enabled": True,
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["is_onboarded"] is True
    assert body["profile"]["onboarded_at"] is not None
    assert body["profile"]["wellness_goals"] == ["sleep", "focus"]
    assert body["profile"]["last_latitude"] == 12.9716
    assert body["profile"]["has_real_location"] is True


def test_onboarding_ignores_coordinates_without_location_consent(
    client: TestClient, auth_headers: dict
):
    body = client.post(
        f"{ME}/onboarding",
        headers=auth_headers,
        json={
            "timezone": "UTC",
            "location_enabled": False,
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    ).json()

    assert body["profile"]["last_latitude"] is None
    assert body["profile"]["has_real_location"] is False


def test_reonboarding_keeps_the_original_completion_date(
    client: TestClient, auth_headers: dict
):
    first = client.post(
        f"{ME}/onboarding", headers=auth_headers, json={"timezone": "UTC"}
    ).json()["profile"]["onboarded_at"]

    second = client.post(
        f"{ME}/onboarding", headers=auth_headers, json={"timezone": "Europe/Paris"}
    ).json()

    assert second["profile"]["onboarded_at"] == first
    assert second["profile"]["timezone"] == "Europe/Paris"


def test_login_reports_onboarded_state(client: TestClient, auth_headers: dict, registered: dict):
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": registered["email"], "password": VALID_PASSWORD},
        ).json()["is_onboarded"]
        is False
    )

    client.post(f"{ME}/onboarding", headers=auth_headers, json={"timezone": "UTC"})

    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": registered["email"], "password": VALID_PASSWORD},
        ).json()["is_onboarded"]
        is True
    )


# ----------------------------------------------------------------- data export

def test_export_contains_every_user_data_section(client: TestClient, auth_headers: dict):
    body = client.get(f"{ME}/export", headers=auth_headers).json()

    for section in (
        "account",
        "profile",
        "consent_history",
        "mood_entries",
        "environment_snapshots",
        "sleep_records",
        "journal_entries",
        "reframe_entries",
        "time_capsules",
        "custom_activities",
        "activity_completions",
        "recommendations",
        "ml_predictions",
        "detected_patterns",
        "conversations",
        "counts",
    ):
        assert section in body, f"export is missing {section!r}"

    assert body["account"]["email"] == "test.person@example.com"
    assert body["counts"]["mood_entries"] == 0


def test_export_excludes_credentials(client: TestClient, auth_headers: dict):
    """
    A password hash in a downloaded file is an offline cracking target and
    helps nobody exercising their data rights.
    """
    raw = client.get(f"{ME}/export", headers=auth_headers).text

    assert "password_hash" not in raw
    assert "refresh_token" not in raw
    assert "token_hash" not in raw


def test_export_excludes_shared_catalogue_activities(client: TestClient, auth_headers: dict):
    """Built-in activities are reference content, not the user's own data."""
    body = client.get(f"{ME}/export", headers=auth_headers).json()
    assert body["custom_activities"] == []


def test_export_requires_authentication(client: TestClient):
    assert client.get(f"{ME}/export").status_code == 401


# --------------------------------------------------------------- account delete

def test_delete_requires_correct_password(client: TestClient, auth_headers: dict):
    response = client.request(
        "DELETE",
        ME,
        headers=auth_headers,
        json={"password": "WrongPass123", "confirm": "DELETE"},
    )
    assert response.status_code == 400
    assert client.get(ME, headers=auth_headers).status_code == 200


def test_delete_requires_typed_confirmation(client: TestClient, auth_headers: dict):
    response = client.request(
        "DELETE", ME, headers=auth_headers, json={"password": VALID_PASSWORD, "confirm": "yes"}
    )
    assert response.status_code == 422
    assert client.get(ME, headers=auth_headers).status_code == 200


def test_delete_removes_account_and_cascades(
    client: TestClient, auth_headers: dict, registered: dict, db: Session
):
    from app.models import RefreshToken, UserProfile

    user_id = registered["user"]["id"]
    client.patch(f"{ME}/consents", headers=auth_headers, json={"location_enabled": True})

    response = client.request(
        "DELETE", ME, headers=auth_headers, json={"password": VALID_PASSWORD, "confirm": "DELETE"}
    )
    assert response.status_code == 200, response.text

    # Outstanding tokens stop working immediately rather than at expiry.
    assert client.get(ME, headers=auth_headers).status_code == 401

    from app.models import ConsentRecord

    assert db.query(UserProfile).filter_by(user_id=user_id).count() == 0
    assert db.query(RefreshToken).filter_by(user_id=user_id).count() == 0
    assert db.query(ConsentRecord).filter_by(user_id=user_id).count() == 0


def test_deleted_account_email_can_register_again(client: TestClient, auth_headers: dict):
    client.request(
        "DELETE", ME, headers=auth_headers, json={"password": VALID_PASSWORD, "confirm": "DELETE"}
    )
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
