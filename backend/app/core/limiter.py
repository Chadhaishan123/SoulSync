"""
Rate limiting.

Auth endpoints without rate limiting are an open invitation to credential
stuffing, and the companion chat endpoint runs model inference — expensive
enough that unbounded requests are a denial-of-service vector against
yourself.

Storage backend is chosen automatically: Redis when REDIS_URL is set
(survives restarts, works across multiple workers), otherwise in-memory
(perfectly adequate for localhost development).

If slowapi is not installed the module degrades to a no-op decorator so the
application still boots — a missing optional dependency should not take the
whole API down, but it is logged loudly so it is not missed.
"""

from __future__ import annotations

import logging

from app.core.config import settings

log = logging.getLogger("soulsync.limiter")

try:  # pragma: no cover - exercised by presence/absence of the dependency
    from slowapi import Limiter
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    SLOWAPI_AVAILABLE = True
except ImportError:  # pragma: no cover
    SLOWAPI_AVAILABLE = False
    RateLimitExceeded = None  # type: ignore[assignment]

    def get_remote_address(request):  # type: ignore[misc]
        return "anonymous"


def _client_key(request) -> str:
    """
    Rate-limit key: the authenticated user when we can cheaply tell, else the
    client IP. Using the user id where available means one abusive account on
    a shared NAT does not lock out everyone behind that IP.
    """
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        # Deliberately not verifying the signature here — this is a bucketing
        # key, not an authorisation decision. A forged token only ever puts
        # the caller into a different (equally limited) bucket.
        return f"token:{auth[7:][:32]}"
    return f"ip:{get_remote_address(request)}"


if SLOWAPI_AVAILABLE:
    limiter = Limiter(
        key_func=_client_key,
        storage_uri=settings.REDIS_URL or "memory://",
        # Do not fail requests if Redis blips; fall open rather than 500.
        in_memory_fallback_enabled=True,
        headers_enabled=True,
    )
    if settings.REDIS_URL:
        log.info("Rate limiting active (Redis backend).")
    else:
        log.info("Rate limiting active (in-memory backend).")
else:  # pragma: no cover

    class _NoopLimiter:
        """Stand-in so decorators still resolve when slowapi is absent."""

        enabled = False

        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

    limiter = _NoopLimiter()  # type: ignore[assignment]
    log.warning(
        "slowapi is not installed — rate limiting is DISABLED. "
        "Install it with: pip install slowapi"
    )
