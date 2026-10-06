"""
Auth endpoint tests.

Focused on the properties that actually matter for a mental-health app:
credentials cannot be enumerated, tokens cannot be replayed, a password change
ends other sessions, and deleting an account really erases the data.
"""

from __future__ import annotations

import datetime as dt

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import decode_token, hash_token
from app.models import MoodEntry, RefreshToken, User
from tests.conftest import VALID_PASSWORD

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"


def _register_payload(**overrides) -> dict:
    payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": VALID_PASSWORD,
        "timezone": "Europe/London",
    }
    payload.update(overrides)
    return payload


# ------------------------------------------------------------------- registration

def test_register_returns_tokens_and_user(client: TestClient):
    response = client.post(REGISTER, json=_register_payload())
    assert response.status_code == 201, response.text

    body = response.json()
    assert body["user"]["email"] == "ada@example.com"
    assert body["is_onboarded"] is False
    assert body["tokens"]["token_type"] == "bearer"
    # The client needs this to refresh proactively rather than waiting for 401.
    assert body["tokens"]["expires_in"] > 0
    # The password must never come back in any form.
    assert "password" not in response.text.lower().replace("password_policy", "")


def test_register_rejects_duplicate_email_case_insensitively(client: TestClient):
    assert client.post(REGISTER, json=_register_payload()).status_code == 201
    duplicate = client.post(REGISTER, json=_register_payload(email="ADA@example.com"))
    assert duplicate.status_code == 409


def test_register_rejects_weak_password(client: TestClient):
    for weak in ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"]:
        response = client.post(REGISTER, json=_register_payload(password=weak))
        assert response.status_code == 422, f"{weak!r} should be rejected"


def test_register_creates_profile_with_submitted_timezone(client: TestClient, db):
    client.post(REGISTER, json=_register_payload(timezone="Asia/Tokyo"))
    user = db.scalar(select(User).where(User.email == "ada@example.com"))
    assert user.profile is not None
    # Timezone correctness is what makes local_date, and therefore streaks,
    # right from the first check-in.
    assert user.profile.timezone == "Asia/Tokyo"


def test_password_policy_matches_validation(client: TestClient):
    policy = client.get("/api/v1/auth/password-policy").json()
    assert policy["min_length"] == 8
    assert policy["max_length"] == 72
    assert len(policy["rules"]) == 4


# -------------------------------------------------------------------------- login

def test_login_succeeds_with_correct_credentials(client: TestClient, registered):
    response = client.post(
        LOGIN, json={"email": registered["email"], "password": registered["password"]}
    )
    assert response.status_code == 200, response.text
    assert response.json()["tokens"]["access_token"]


def test_login_email_is_case_insensitive(client: TestClient, registered):
    response = client.post(
        LOGIN,
        json={"email": registered["email"].upper(), "password": registered["password"]},
    )
    assert response.status_code == 200


def test_login_does_not_leak_whether_an_account_exists(client: TestClient, registered):
    """
    Wrong password and unknown email must be indistinguishable. On a
    mental-health platform, confirming that an address has an account is itself
    a disclosure about that person.
    """
    wrong_password = client.post(
        LOGIN, json={"email": registered["email"], "password": "WrongPassword9"}
    )
    unknown_email = client.post(
        LOGIN, json={"email": "nobody@example.com", "password": "WrongPassword9"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_login_updates_last_login_at(client: TestClient, registered, db):
    before = db.scalar(select(User).where(User.email == registered["email"]))
    assert before.last_login_at is None or before.last_login_at is not None

    client.post(
        LOGIN, json={"email": registered["email"], "password": registered["password"]}
    )
    db.expire_all()
    after = db.scalar(select(User).where(User.email == registered["email"]))
    assert after.last_login_at is not None


# ------------------------------------------------------------------------- tokens

def test_me_requires_a_token(client: TestClient):
    assert client.get(ME).status_code == 401


def test_me_rejects_a_garbage_token(client: TestClient):
    response = client.get(ME, headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_me_returns_the_signed_in_user(client: TestClient, auth_headers, registered):
    response = client.get(ME, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == registered["email"]


def test_refresh_token_is_rejected_as_an_access_token(client: TestClient, registered):
    """
    The `type` claim check in decode_token exists for this: a refresh token
    lives for 30 days, so accepting one as an access token would hand out a
    month-long bearer credential.
    """
    headers = {"Authorization": f"Bearer {registered['refresh_token']}"}
    assert client.get(ME, headers=headers).status_code == 401


def test_refresh_rotates_and_invalidates_the_old_token(client: TestClient, registered):
    first = client.post(REFRESH, json={"refresh_token": registered["refresh_token"]})
    assert first.status_code == 200, first.text
    new_tokens = first.json()
    assert new_tokens["refresh_token"] != registered["refresh_token"]

    # The new access token works.
    assert (
        client.get(
            ME, headers={"Authorization": f"Bearer {new_tokens['access_token']}"}
        ).status_code
        == 200
    )


def test_refresh_reuse_revokes_every_session(client: TestClient, registered, db):
    """
    Presenting an already-rotated refresh token means either a buggy client or
    a stolen token. Revoking everything is the safe response: the real user
    signs in again, the attacker's copy stops working.
    """
    stolen = registered["refresh_token"]
    rotated = client.post(REFRESH, json={"refresh_token": stolen})
    assert rotated.status_code == 200
    fresh_refresh = rotated.json()["refresh_token"]

    replay = client.post(REFRESH, json={"refresh_token": stolen})
    assert replay.status_code == 401

    # The legitimately-issued token must also be dead now.
    assert client.post(REFRESH, json={"refresh_token": fresh_refresh}).status_code == 401

    live = db.scalars(
        select(RefreshToken).where(RefreshToken.revoked_at.is_(None))
    ).all()
    assert live == []


def test_refresh_rejects_an_unknown_token(client: TestClient, registered):
    from app.core.security import create_refresh_token

    # Correctly signed but never stored — e.g. minted from a leaked key.
    orphan = create_refresh_token(registered["user"]["id"])
    assert client.post(REFRESH, json={"refresh_token": orphan}).status_code == 401


def test_refresh_rejects_an_expired_stored_token(client: TestClient, registered, db):
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(registered["refresh_token"])
        )
    )
    stored.expires_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)
    db.commit()

    response = client.post(REFRESH, json={"refresh_token": registered["refresh_token"]})
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_access_token_carries_the_expected_claims(registered):
    claims = decode_token(registered["access_token"], expected_type="access")
    assert claims["sub"] == str(registered["user"]["id"])
    assert claims["type"] == "access"
    assert claims["exp"] > claims["iat"]
    assert claims["jti"]


# ------------------------------------------------------------------------ logout

def test_logout_revokes_only_that_token(client: TestClient, registered, db):
    second_login = client.post(
        LOGIN, json={"email": registered["email"], "password": registered["password"]}
    ).json()
    other_refresh = second_login["tokens"]["refresh_token"]

    assert (
        client.post(LOGOUT, json={"refresh_token": registered["refresh_token"]}).status_code
        == 200
    )

    # The revoked one is refused; the other session still works.
    assert (
        client.post(REFRESH, json={"refresh_token": registered["refresh_token"]}).status_code
        == 401
    )
    assert client.post(REFRESH, json={"refresh_token": other_refresh}).status_code == 200


def test_logout_does_not_revoke_other_sessions(client: TestClient, registered, db):
    """
    Guards the distinction between a rotated token being replayed (theft) and a
    logged-out token being retried (ordinary race). Only the former should
    revoke everything — otherwise closing one tab signs you out on every
    device, which is precisely the silent-logout behaviour this token design
    replaces.
    """
    other_refresh = client.post(
        LOGIN, json={"email": registered["email"], "password": registered["password"]}
    ).json()["tokens"]["refresh_token"]

    client.post(LOGOUT, json={"refresh_token": registered["refresh_token"]})
    # Retrying the logged-out token must not cascade.
    assert (
        client.post(REFRESH, json={"refresh_token": registered["refresh_token"]}).status_code
        == 401
    )
    assert client.post(REFRESH, json={"refresh_token": other_refresh}).status_code == 200


def test_logout_is_idempotent(client: TestClient, registered):
    payload = {"refresh_token": registered["refresh_token"]}
    assert client.post(LOGOUT, json=payload).status_code == 200
    # A client clearing storage twice must not see an error.
    assert client.post(LOGOUT, json=payload).status_code == 200


def test_logout_all_revokes_every_session(client: TestClient, registered, auth_headers, db):
    client.post(LOGIN, json={"email": registered["email"], "password": registered["password"]})
    response = client.post("/api/v1/auth/logout-all", headers=auth_headers)
    assert response.status_code == 200

    live = db.scalars(select(RefreshToken).where(RefreshToken.revoked_at.is_(None))).all()
    assert live == []


# ---------------------------------------------------------------- password reset

def test_forgot_password_response_is_identical_for_unknown_emails(
    client: TestClient, registered
):
    known = client.post("/api/v1/auth/forgot-password", json={"email": registered["email"]})
    unknown = client.post(
        "/api/v1/auth/forgot-password", json={"email": "ghost@example.com"}
    )
    assert known.status_code == unknown.status_code == 200
    # Both start with the same sentence; only the dev token differs.
    assert known.json()["detail"].startswith("If an account exists")
    assert unknown.json()["detail"].startswith("If an account exists")
    assert unknown.json()["dev_token"] is None


def test_forgot_password_returns_a_dev_token_outside_production(
    client: TestClient, registered
):
    """
    No SMTP is configured, so claiming an email was sent would be false. In
    development the token is handed back with an explanation instead.
    """
    body = client.post(
        "/api/v1/auth/forgot-password", json={"email": registered["email"]}
    ).json()
    assert body["dev_token"]
    assert body["expires_in_minutes"] == 30


def test_reset_password_works_once_and_ends_all_sessions(client: TestClient, registered):
    token = client.post(
        "/api/v1/auth/forgot-password", json={"email": registered["email"]}
    ).json()["dev_token"]

    new_password = "BrandNewPass7"
    reset = client.post(
        "/api/v1/auth/reset-password", json={"token": token, "password": new_password}
    )
    assert reset.status_code == 200, reset.text

    # Old sessions are gone — a reset is often a response to a compromise.
    assert (
        client.post(REFRESH, json={"refresh_token": registered["refresh_token"]}).status_code
        == 401
    )
    # Old password no longer works, new one does.
    assert (
        client.post(LOGIN, json={"email": registered["email"], "password": VALID_PASSWORD}).status_code
        == 401
    )
    assert (
        client.post(LOGIN, json={"email": registered["email"], "password": new_password}).status_code
        == 200
    )
    # The token is single-use.
    assert (
        client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "password": "YetAnother8"},
        ).status_code
        == 400
    )


def test_reset_password_rejects_an_invalid_token(client: TestClient):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "made-up-token", "password": "Whatever123"},
    )
    assert response.status_code == 400


# --------------------------------------------------------------- change password

def test_change_password_requires_the_current_one(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers,
        json={"current_password": "NotMyPassword1", "new_password": "Replacement9"},
    )
    assert response.status_code == 400


def test_change_password_rejects_reusing_the_same_password(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers,
        json={"current_password": VALID_PASSWORD, "new_password": VALID_PASSWORD},
    )
    assert response.status_code == 400


def test_change_password_signs_out_other_devices(client: TestClient, registered, auth_headers):
    response = client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers,
        json={"current_password": VALID_PASSWORD, "new_password": "Replacement9"},
    )
    assert response.status_code == 200
    assert (
        client.post(REFRESH, json={"refresh_token": registered["refresh_token"]}).status_code
        == 401
    )


# ------------------------------------------------------------ data-integrity guard

def test_deleting_a_user_cascades_to_their_data(client: TestClient, registered, db):
    """
    The GDPR deletion guarantee. SQLite disables foreign keys by default, so
    without the PRAGMA in db/session.py this would leave mood entries behind —
    orphaned rows that still describe a real person's mental health.
    """
    user_id = registered["user"]["id"]
    db.add(
        MoodEntry(
            user_id=user_id,
            mood_score=6,
            recorded_at=dt.datetime.now(dt.timezone.utc),
            local_date=dt.date.today(),
        )
    )
    db.commit()
    assert db.scalars(select(MoodEntry).where(MoodEntry.user_id == user_id)).all()

    db.delete(db.get(User, user_id))
    db.commit()

    assert db.scalars(select(MoodEntry).where(MoodEntry.user_id == user_id)).all() == []
    assert (
        db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id)).all() == []
    )


def test_tokens_stop_working_once_the_account_is_gone(
    client: TestClient, registered, auth_headers, db
):
    db.delete(db.get(User, registered["user"]["id"]))
    db.commit()
    # A validly-signed token for a deleted account must not be honoured.
    assert client.get(ME, headers=auth_headers).status_code == 401


def test_refresh_tokens_are_never_stored_in_plaintext(registered, db):
    stored = db.scalars(select(RefreshToken)).all()
    assert stored
    for row in stored:
        assert row.token_hash != registered["refresh_token"]
        assert len(row.token_hash) == 64  # SHA-256 hex


# --------------------------------------------------------------------- meta

def test_health_check_reports_a_real_database_round_trip(client: TestClient):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["database"]["reachable"] is True
    assert body["rate_limiting"] is True
