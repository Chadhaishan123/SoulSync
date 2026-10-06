"""
Live environment endpoints.

Coordinates come from one of two real places: query parameters the browser
filled in from the Geolocation API, or the coordinates the user previously
consented to store. There is no third case — no default city, no IP-based
guess. When neither is available the endpoint says so (409) instead of
returning weather for somewhere the user has never been.

Status codes are the contract the frontend branches on:

  403  environment consent is off      -> show the consent toggle
  409  consent is on, no coordinates   -> ask the browser for a position
  200  a real reading, possibly partial (check `sources`)

A 200 never means "everything worked". Each response lists every provider it
called and whether that call succeeded, because a panel showing temperature but
silently omitting a failed air-quality lookup is indistinguishable from one
where the air was clean.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.api.deps import get_profile
from app.core.config import settings
from app.core.limiter import limiter
from app.db.base import utcnow
from app.models import UserProfile
from app.schemas.environment import (
    AstronomyOut,
    EnvironmentNow,
    ForecastOut,
    HolidayOut,
    UpstreamStatus,
)
from app.services import environment as env

router = APIRouter(prefix="/env", tags=["environment"])

CONSENT_REQUIRED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail=(
        "Environment data is off. Turn on location and environment consent in "
        "settings to see live weather and air quality."
    ),
)

LOCATION_REQUIRED = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail=(
        "No coordinates available. Share your location from the browser, or "
        "pass lat and lon, so readings are for where you actually are."
    ),
)

LAT = Query(None, ge=-90, le=90, description="Real latitude from the browser")
LON = Query(None, ge=-180, le=180, description="Real longitude from the browser")


def resolve_coordinates(
    lat: Optional[float],
    lon: Optional[float],
    profile: UserProfile,
) -> Tuple[float, float, str]:
    """
    Pick the coordinates for this request and record where they came from.

    Fresh browser coordinates win over stored ones: someone checking in from a
    different city should see that city's weather, not the last place they
    saved. Consent is checked first either way — passing lat/lon in the URL is
    not a way around the toggle.
    """
    if not profile.environment_enabled:
        raise CONSENT_REQUIRED

    if lat is not None and lon is not None:
        return lat, lon, "request"

    if profile.last_latitude is not None and profile.last_longitude is not None:
        return profile.last_latitude, profile.last_longitude, "profile"

    raise LOCATION_REQUIRED


def _unreachable(what: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"{what} is unreachable right now. Please try again shortly.",
    )


# ------------------------------------------------------------------------ now


@router.get("/now", response_model=EnvironmentNow, summary="Live conditions here")
@limiter.limit(settings.RATE_LIMIT_ENVIRONMENT)
async def environment_now(
    request: Request,
    response: Response,
    lat: Optional[float] = LAT,
    lon: Optional[float] = LON,
    profile: UserProfile = Depends(get_profile),
) -> EnvironmentNow:
    """
    Current weather, air quality, daylight and holiday status for real
    coordinates.

    This is the reading stored alongside a check-in, and the one every
    weather-mood and PM2.5-mood correlation is later computed from.
    """
    latitude, longitude, source = resolve_coordinates(lat, lon, profile)
    bundle = await env.gather_environment(latitude, longitude, source=source)

    return EnvironmentNow(
        location=bundle["location"],
        weather=bundle["weather"],
        air_quality=bundle["air_quality"],
        astronomy=bundle["astronomy"],
        holiday=bundle["holiday"],
        fetched_at=utcnow(),
        sources=bundle["sources"],
    )


# ------------------------------------------------------------------- forecast


@router.get("/forecast", response_model=ForecastOut, summary="Three-day forecast")
@limiter.limit(settings.RATE_LIMIT_ENVIRONMENT)
async def environment_forecast(
    request: Request,
    response: Response,
    lat: Optional[float] = LAT,
    lon: Optional[float] = LON,
    days: int = Query(
        env.FORECAST_DAYS,
        ge=1,
        le=env.FORECAST_DAYS,
        description="Days to return, today first",
    ),
    profile: UserProfile = Depends(get_profile),
) -> ForecastOut:
    """
    Daily forecast including PM2.5 and UV, which the Emotional Forecast pairs
    with the user's own learned weather sensitivity.

    The window is capped at what a single upstream request already returns, so
    asking for more days can never trigger a second call.
    """
    latitude, longitude, source = resolve_coordinates(lat, lon, profile)
    sources: List[UpstreamStatus] = []

    weather_payload = await env.call_provider(
        "open-meteo-weather", env.fetch_weather(latitude, longitude), sources
    )
    if weather_payload is None:
        raise _unreachable("The weather service")

    # Particulates and the city label are enrichments: the forecast is still
    # worth showing without either.
    air_payload = await env.call_provider(
        "open-meteo-air-quality", env.fetch_air_quality(latitude, longitude), sources
    )
    geo_payload = await env.call_provider(
        "reverse-geocode", env.reverse_geocode(latitude, longitude), sources
    )

    return ForecastOut(
        location=await env.build_location(
            latitude, longitude, source=source, weather=weather_payload, geo=geo_payload
        ),
        days=env.parse_forecast_days(weather_payload, air_payload)[:days],
        fetched_at=utcnow(),
        sources=sources,
    )


# ------------------------------------------------------------------ astronomy


@router.get("/astronomy", response_model=AstronomyOut, summary="Sun times and daylight")
@limiter.limit(settings.RATE_LIMIT_ENVIRONMENT)
async def environment_astronomy(
    request: Request,
    response: Response,
    lat: Optional[float] = LAT,
    lon: Optional[float] = LON,
    profile: UserProfile = Depends(get_profile),
) -> AstronomyOut:
    """
    Sunrise, sunset and daylight length — the circadian context behind sleep
    insights like "sunset was 18:42, and your bedtime drifted 1.4 h later this
    week".
    """
    latitude, longitude, source = resolve_coordinates(lat, lon, profile)
    sources: List[UpstreamStatus] = []

    weather_payload = await env.call_provider(
        "open-meteo-weather", env.fetch_weather(latitude, longitude), sources
    )
    if weather_payload is None:
        raise _unreachable("The sun-times service")

    return AstronomyOut(
        location=await env.build_location(
            latitude, longitude, source=source, weather=weather_payload
        ),
        today=env.parse_astronomy(weather_payload),
        upcoming=env.parse_forecast_days(weather_payload),
        fetched_at=utcnow(),
        sources=sources,
    )


# ------------------------------------------------------------------- holidays


@router.get("/holidays", response_model=HolidayOut, summary="Public holidays")
@limiter.limit(settings.RATE_LIMIT_ENVIRONMENT)
async def environment_holidays(
    request: Request,
    response: Response,
    country: Optional[str] = Query(
        None,
        min_length=2,
        max_length=2,
        description=(
            "ISO 3166-1 alpha-2 code. Resolved from your coordinates when omitted."
        ),
    ),
    year: Optional[int] = Query(None, ge=1975, le=2100),
    lat: Optional[float] = LAT,
    lon: Optional[float] = LON,
    profile: UserProfile = Depends(get_profile),
) -> HolidayOut:
    """
    The real public-holiday calendar for a country, behind the holiday-versus
    -workday mood comparison.

    A country code can be given directly; otherwise it is reverse-geocoded from
    the user's coordinates, which is why this endpoint is consent-gated like the
    rest even though holidays themselves are public data.
    """
    sources: List[UpstreamStatus] = []
    country_code = (country or "").upper() or None

    if country_code is None:
        latitude, longitude, _ = resolve_coordinates(lat, lon, profile)
        geo_payload = await env.call_provider(
            "reverse-geocode", env.reverse_geocode(latitude, longitude), sources
        )
        if geo_payload is None:
            raise _unreachable("The geocoding service")
        country_code = geo_payload.get("country_code")
        if not country_code:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Your country could not be determined from those "
                    "coordinates. Pass country=XX to choose one."
                ),
            )

    resolved_year = year or utcnow().year
    raw = await env.call_provider(
        "nager-date", env.fetch_holidays(country_code, resolved_year), sources
    )
    if raw is None:
        # Two distinguishable causes are recorded in `sources`. A transport
        # failure is a real outage (503); a "no published calendar for this
        # country-year" is a fact about the data, returned as an empty list so
        # the UI can say the holiday status is unknown instead of lying that it
        # is not a holiday. Both surface differently, neither pretends.
        if any(s.error == env.HOLIDAY_NOT_PUBLISHED_MSG for s in sources):
            return HolidayOut(
                country_code=country_code,
                year=resolved_year,
                holidays=[],
                fetched_at=utcnow(),
                sources=sources,
            )
        # Nager.Date 404s for country codes it does not cover at all. That is
        # also "this data does not exist", treated the same way above — but a
        # 503 on a transport error would hide the real distinction.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Public holidays for {country_code} are unavailable. The "
                "calendar service may not cover that country."
            ),
        )

    return HolidayOut(
        country_code=country_code,
        year=resolved_year,
        holidays=env.parse_holidays(raw, country_code),
        fetched_at=utcnow(),
        sources=sources,
    )
