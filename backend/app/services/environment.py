"""
Live environment service.

Everything in this module is a measurement fetched from a third-party API for
coordinates the user actually consented to share. There is no fallback city, no
climate average, no interpolation: if an upstream is unreachable the affected
fields come back `None` and the failure is reported to the caller.

Providers, all real and attributed in the response:

  * Open-Meteo forecast API      — weather + astronomy (keyless, no signup)
  * Open-Meteo air-quality API   — CAMS particulates, AQI, UV, pollen (keyless)
  * Nager.Date                   — public holidays by country (keyless)
  * BigDataCloud                 — reverse geocode lat/lon -> city (keyless)
  * OpenCage                     — reverse geocode, preferred when a key exists
  * Tomorrow.io                  — pollen outside the European CAMS domain,
                                   only when a key exists

Two behaviours worth knowing about:

**Caching is for the upstreams' benefit, not to fake freshness.** Readings are
reused for `ENV_CACHE_TTL_SECONDS`, and every response carries `fetched_at` plus
`cache_age_seconds` per provider, so the UI can always show how old a number is.
Weather moves on the scale of tens of minutes; a dashboard that re-fetched on
every component mount would hammer a free shared service for identical answers.

**Failures are per-provider.** A `gather` with `return_exceptions=True` means an
air-quality outage still returns live temperature, rather than collapsing the
whole panel.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.db.base import utcnow
from app.schemas.environment import (
    AirQualityNow,
    Astronomy,
    ForecastDay,
    HolidayInfo,
    LocationInfo,
    UpstreamStatus,
    WeatherNow,
)

log = logging.getLogger("soulsync.environment")

# Requesting the same window for every weather call means /env/now,
# /env/forecast and /env/astronomy share one cache entry and therefore one
# upstream request. Today plus three days is exactly what the Emotional
# Forecast needs.
FORECAST_DAYS = 4

# Cache keys round coordinates to ~1.1 km. Finer precision would mean GPS
# jitter alone produced a cache miss on every request; coarser would start
# reporting a genuinely different place's weather.
_COORD_PRECISION = 2

# Bounded so a long-running process cannot grow this without limit.
_MAX_CACHE_ENTRIES = 512

# key -> (stored_at_monotonic, stored_at_wall, payload)
_cache: Dict[str, Tuple[float, dt.datetime, Any]] = {}
_locks: Dict[str, asyncio.Lock] = {}
_client: Optional[httpx.AsyncClient] = None

# Sentinel cached for a country-year that has no published calendar yet, so a
# subsequent request does not re-hit Nager for an answer that will not change
# within the session.
_UNAVAILABLE_HOLIDAYS: Any = {"__holidays_unavailable__": True}

HOLIDAY_NOT_PUBLISHED_MSG = (
    "no public holiday calendar is published for this country and year yet"
)


class HolidayNotPublished(Exception):
    """
    Nager.Date answered that it has no calendar for a country-year.

    This is a real fact, not an outage: national holiday feeds are only
    published once the government confirms them, and a 204/404 is how the API
    says "not yet". It must surface as "holiday status unknown", never as either
    "the service is down" or — worse — "today is not a holiday".
    """

    def __init__(self, country_code: str, year: int):
        super().__init__(f"{country_code}-{year} has no published calendar")
        self.country_code = country_code
        self.year = year


# --------------------------------------------------------------- lookup tables

# WMO code 4677, the published standard Open-Meteo encodes `weather_code` with.
# This is a translation of a documented enum, not a generated description.
WMO_CODES: Dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

# US EPA AQI breakpoints and the agency's own advice for each band. Used to
# label `us_aqi`; the numeric value itself comes from Open-Meteo.
AQI_BANDS: Tuple[Tuple[int, str, str], ...] = (
    (50, "Good", "Air quality is satisfactory and poses little or no risk."),
    (
        100,
        "Moderate",
        "Acceptable, though unusually sensitive people may want to limit long "
        "outdoor exertion.",
    ),
    (
        150,
        "Unhealthy for sensitive groups",
        "Sensitive groups may feel effects. Consider shortening intense "
        "outdoor activity.",
    ),
    (
        200,
        "Unhealthy",
        "Everyone may begin to feel effects. Prefer indoor activity today.",
    ),
    (
        300,
        "Very unhealthy",
        "Health alert: avoid outdoor exertion and keep windows closed.",
    ),
    (
        10_000,
        "Hazardous",
        "Emergency conditions. Stay indoors and use filtration if you have it.",
    ),
)


def describe_weather_code(code: Optional[int]) -> Optional[str]:
    if code is None:
        return None
    return WMO_CODES.get(int(code), f"Weather code {int(code)}")


def describe_aqi(us_aqi: Optional[float]) -> Tuple[Optional[str], Optional[str]]:
    """US EPA band and advice for an AQI value, or (None, None) if unavailable."""
    if us_aqi is None:
        return None, None
    for ceiling, band, advice in AQI_BANDS:
        if us_aqi <= ceiling:
            return band, advice
    return None, None


# ------------------------------------------------------------------ http plumbing


def get_client(
    transport: Optional[httpx.AsyncBaseTransport] = None,
) -> httpx.AsyncClient:
    """
    Process-wide client so connections to the same four hosts are reused.

    A per-request client would pay a TLS handshake on every dashboard load.

    ``transport`` is a test hook: the offline suite injects an
    ``httpx.MockTransport`` so correctness is proven without a live network.
    """
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=settings.UPSTREAM_TIMEOUT_SECONDS,
            follow_redirects=True,
            # Several of these providers ask for an identifying User-Agent as a
            # condition of their free tier. Sending one is the polite minimum.
            headers={"User-Agent": "SoulSync/2.0 (self-hosted wellbeing app)"},
            transport=transport,
        )
    return _client


async def close_client() -> None:
    """Called from the app lifespan so shutdown does not leak sockets."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


def _prune_cache() -> None:
    now = time.monotonic()
    for key in [k for k, (stored, _, _) in _cache.items() if now - stored > 86_400]:
        _cache.pop(key, None)
        _locks.pop(key, None)
    if len(_cache) > _MAX_CACHE_ENTRIES:
        # Oldest first; these are the least likely to be asked for again.
        for key, _ in sorted(_cache.items(), key=lambda kv: kv[1][0])[
            : len(_cache) - _MAX_CACHE_ENTRIES
        ]:
            _cache.pop(key, None)
            _locks.pop(key, None)


def _cache_get(key: str, ttl: int) -> Tuple[Optional[Any], Optional[int]]:
    entry = _cache.get(key)
    if entry is None:
        return None, None
    stored_monotonic, _, payload = entry
    age = int(time.monotonic() - stored_monotonic)
    if age > ttl:
        return None, None
    return payload, age


def _cache_put(key: str, payload: Any) -> None:
    _cache[key] = (time.monotonic(), utcnow(), payload)
    _prune_cache()


def clear_cache() -> None:
    """Test hook. Never called from request handling."""
    _cache.clear()
    _locks.clear()


def _coord_key(prefix: str, lat: float, lon: float) -> str:
    return f"{prefix}:{round(lat, _COORD_PRECISION)},{round(lon, _COORD_PRECISION)}"


async def _cached_json(
    key: str, ttl: int, url: str, params: Dict[str, Any]
) -> Tuple[Dict[str, Any], int]:
    """
    Fetch JSON with TTL caching, returning `(payload, cache_age_seconds)`.

    The per-key lock matters on a dashboard: several panels mount at once and
    would otherwise each fire the same upstream request before the first
    response had a chance to populate the cache.
    """
    payload, age = _cache_get(key, ttl)
    if payload is not None:
        return payload, age or 0

    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        # Re-check: another coroutine may have filled the cache while we waited.
        payload, age = _cache_get(key, ttl)
        if payload is not None:
            return payload, age or 0

        response = await get_client().get(url, params=params)
        response.raise_for_status()
        payload = response.json()
        _cache_put(key, payload)
        return payload, 0


def _parse_local(value: Optional[str], offset_seconds: int) -> Optional[dt.datetime]:
    """
    Open-Meteo returns naive local timestamps alongside `utc_offset_seconds`.

    Storing those naive strings is how "sunset 18:42" ends up displayed as
    13:12: the offset has to be applied before the value becomes a real instant.
    """
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=dt.timezone(dt.timedelta(seconds=offset_seconds))
        )
    return parsed.astimezone(dt.timezone.utc)


def _num(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> Optional[int]:
    number = _num(value)
    return None if number is None else int(round(number))


def _at(series: Any, index: int) -> Any:
    if not isinstance(series, list) or index >= len(series):
        return None
    return series[index]


def describe_error(exc: BaseException) -> str:
    """A short, non-leaky reason string for the client."""
    if isinstance(exc, HolidayNotPublished):
        return HOLIDAY_NOT_PUBLISHED_MSG
    if isinstance(exc, httpx.HTTPStatusError):
        return f"upstream returned HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.TimeoutException):
        return f"upstream timed out after {settings.UPSTREAM_TIMEOUT_SECONDS:g}s"
    if isinstance(exc, httpx.HTTPError):
        return "upstream unreachable"
    return type(exc).__name__


async def call_provider(
    provider: str, awaitable: Any, sources: List[UpstreamStatus]
) -> Optional[Any]:
    """
    Await one upstream call, recording the outcome in `sources` rather than
    raising.

    Every endpoint here talks to two or more services, and any of them can be
    down independently. Letting the first failure propagate would throw away
    the readings that did succeed.
    """
    try:
        payload, age = await awaitable
    except Exception as exc:  # noqa: BLE001 - the outcome is the return value
        log.warning("%s failed: %s", provider, describe_error(exc))
        sources.append(
            UpstreamStatus(provider=provider, ok=False, error=describe_error(exc))
        )
        return None
    sources.append(UpstreamStatus(provider=provider, ok=True, cache_age_seconds=age))
    return payload


# ------------------------------------------------------------------- weather

WEATHER_CURRENT_FIELDS = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
    "precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m"
)
WEATHER_DAILY_FIELDS = (
    "weather_code,temperature_2m_max,temperature_2m_min,"
    "apparent_temperature_max,sunrise,sunset,daylight_duration,"
    "uv_index_max,precipitation_sum,precipitation_probability_max,"
    "wind_speed_10m_max"
)


async def fetch_weather(lat: float, lon: float) -> Tuple[Dict[str, Any], int]:
    return await _cached_json(
        _coord_key("weather", lat, lon),
        settings.ENV_CACHE_TTL_SECONDS,
        settings.OPEN_METEO_WEATHER_URL,
        {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "current": WEATHER_CURRENT_FIELDS,
            "daily": WEATHER_DAILY_FIELDS,
            # `auto` makes the daily buckets align with the user's local
            # calendar days, so "today's sunrise" is today where they live.
            "timezone": "auto",
            "forecast_days": FORECAST_DAYS,
        },
    )


AIR_CURRENT_FIELDS = (
    "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,"
    "uv_index,european_aqi,us_aqi,alder_pollen,birch_pollen,grass_pollen,"
    "mugwort_pollen,olive_pollen,ragweed_pollen"
)
AIR_HOURLY_FIELDS = "pm2_5,us_aqi"


async def fetch_air_quality(lat: float, lon: float) -> Tuple[Dict[str, Any], int]:
    return await _cached_json(
        _coord_key("air", lat, lon),
        settings.ENV_CACHE_TTL_SECONDS,
        settings.OPEN_METEO_AIR_QUALITY_URL,
        {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "current": AIR_CURRENT_FIELDS,
            "hourly": AIR_HOURLY_FIELDS,
            "timezone": "auto",
            "forecast_days": FORECAST_DAYS,
        },
    )


def parse_weather_now(payload: Dict[str, Any]) -> WeatherNow:
    current = payload.get("current") or {}
    offset = _int(payload.get("utc_offset_seconds")) or 0
    code = _int(current.get("weather_code"))
    is_day = _int(current.get("is_day"))
    return WeatherNow(
        temperature_c=_num(current.get("temperature_2m")),
        apparent_temperature_c=_num(current.get("apparent_temperature")),
        humidity_pct=_num(current.get("relative_humidity_2m")),
        pressure_hpa=_num(current.get("pressure_msl")),
        cloud_cover_pct=_num(current.get("cloud_cover")),
        precipitation_mm=_num(current.get("precipitation")),
        wind_speed_kmh=_num(current.get("wind_speed_10m")),
        weather_code=code,
        weather_label=describe_weather_code(code),
        is_day=None if is_day is None else bool(is_day),
        observed_at=_parse_local(current.get("time"), offset),
    )


def parse_air_quality_now(payload: Dict[str, Any]) -> AirQualityNow:
    current = payload.get("current") or {}
    us_aqi = _int(current.get("us_aqi"))
    band, advice = describe_aqi(us_aqi)

    # CAMS only models pollen over Europe, so these are absent elsewhere. Taking
    # the max of whichever species are reported keeps the field meaningful
    # without inventing a value where none is published.
    pollen_values = [
        _num(current.get(field))
        for field in (
            "alder_pollen",
            "birch_pollen",
            "grass_pollen",
            "mugwort_pollen",
            "olive_pollen",
            "ragweed_pollen",
        )
    ]
    present = [v for v in pollen_values if v is not None]

    return AirQualityNow(
        pm2_5=_num(current.get("pm2_5")),
        pm10=_num(current.get("pm10")),
        ozone=_num(current.get("ozone")),
        nitrogen_dioxide=_num(current.get("nitrogen_dioxide")),
        sulphur_dioxide=_num(current.get("sulphur_dioxide")),
        carbon_monoxide=_num(current.get("carbon_monoxide")),
        us_aqi=us_aqi,
        european_aqi=_int(current.get("european_aqi")),
        uv_index=_num(current.get("uv_index")),
        pollen_index=max(present) if present else None,
        aqi_band=band,
        aqi_advice=advice,
    )


def parse_astronomy(
    payload: Dict[str, Any], now: Optional[dt.datetime] = None
) -> Astronomy:
    daily = payload.get("daily") or {}
    offset = _int(payload.get("utc_offset_seconds")) or 0
    now = now or utcnow()

    sunrise = _parse_local(_at(daily.get("sunrise"), 0), offset)
    sunset = _parse_local(_at(daily.get("sunset"), 0), offset)

    is_daylight = None
    if sunrise and sunset:
        is_daylight = sunrise <= now <= sunset

    minutes_to_sunset = None
    if sunset:
        minutes_to_sunset = int((sunset - now).total_seconds() // 60)
    minutes_since_sunrise = None
    if sunrise:
        minutes_since_sunrise = int((now - sunrise).total_seconds() // 60)

    return Astronomy(
        sunrise=sunrise,
        sunset=sunset,
        daylight_seconds=_int(_at(daily.get("daylight_duration"), 0)),
        uv_index_max=_num(_at(daily.get("uv_index_max"), 0)),
        is_daylight_now=is_daylight,
        minutes_to_sunset=minutes_to_sunset,
        minutes_since_sunrise=minutes_since_sunrise,
    )


def parse_forecast_days(
    weather: Dict[str, Any], air: Optional[Dict[str, Any]] = None
) -> List[ForecastDay]:
    daily = weather.get("daily") or {}
    dates = daily.get("time") or []
    offset = _int(weather.get("utc_offset_seconds")) or 0

    # Hourly particulates collapsed to one number per local day, so the
    # forecast can carry an air-quality dimension without 96 rows of noise.
    pm_by_date: Dict[str, List[float]] = {}
    aqi_by_date: Dict[str, List[int]] = {}
    if air:
        hourly = air.get("hourly") or {}
        times = hourly.get("time") or []
        pm_series = hourly.get("pm2_5") or []
        aqi_series = hourly.get("us_aqi") or []
        for index, stamp in enumerate(times):
            day = str(stamp)[:10]
            pm_value = _num(_at(pm_series, index))
            if pm_value is not None:
                pm_by_date.setdefault(day, []).append(pm_value)
            aqi_value = _int(_at(aqi_series, index))
            if aqi_value is not None:
                aqi_by_date.setdefault(day, []).append(aqi_value)

    days: List[ForecastDay] = []
    for index, raw_date in enumerate(dates):
        try:
            day_date = dt.date.fromisoformat(str(raw_date))
        except ValueError:
            continue
        code = _int(_at(daily.get("weather_code"), index))
        key = str(raw_date)
        pm_values = pm_by_date.get(key) or []
        aqi_values = aqi_by_date.get(key) or []
        days.append(
            ForecastDay(
                date=day_date,
                temperature_min_c=_num(_at(daily.get("temperature_2m_min"), index)),
                temperature_max_c=_num(_at(daily.get("temperature_2m_max"), index)),
                apparent_max_c=_num(_at(daily.get("apparent_temperature_max"), index)),
                precipitation_mm=_num(_at(daily.get("precipitation_sum"), index)),
                precipitation_probability_pct=_int(
                    _at(daily.get("precipitation_probability_max"), index)
                ),
                wind_speed_max_kmh=_num(_at(daily.get("wind_speed_10m_max"), index)),
                weather_code=code,
                weather_label=describe_weather_code(code),
                uv_index_max=_num(_at(daily.get("uv_index_max"), index)),
                sunrise=_parse_local(_at(daily.get("sunrise"), index), offset),
                sunset=_parse_local(_at(daily.get("sunset"), index), offset),
                daylight_seconds=_int(_at(daily.get("daylight_duration"), index)),
                pm2_5_mean=(
                    round(sum(pm_values) / len(pm_values), 1) if pm_values else None
                ),
                us_aqi_max=max(aqi_values) if aqi_values else None,
            )
        )
    return days


# --------------------------------------------------------------- reverse geocode


async def reverse_geocode(lat: float, lon: float) -> Tuple[Dict[str, Any], int]:
    """
    Turn coordinates into a real place name.

    OpenCage is used when a key is configured because it is the more accurate of
    the two; BigDataCloud's keyless endpoint is the default so the feature works
    with zero signup. Either way the answer is attributed in `geocoder`, and a
    failure leaves the city blank rather than guessing from the coordinates.
    """
    key = _coord_key("geo", lat, lon)
    # A city name does not change; only the coordinate rounding does.
    ttl = settings.HOLIDAY_CACHE_TTL_SECONDS

    if settings.OPENCAGE_API_KEY:
        payload, age = await _cached_json(
            key,
            ttl,
            settings.OPENCAGE_URL,
            {
                "q": f"{round(lat, 4)},{round(lon, 4)}",
                "key": settings.OPENCAGE_API_KEY,
                "no_annotations": 1,
                "limit": 1,
            },
        )
        results = payload.get("results") or []
        components = (results[0].get("components") or {}) if results else {}
        return (
            {
                "city": components.get("city")
                or components.get("town")
                or components.get("village")
                or components.get("suburb")
                or components.get("county"),
                "region": components.get("state"),
                "country": components.get("country"),
                "country_code": (components.get("country_code") or "").upper() or None,
                "geocoder": "opencage",
            },
            age,
        )

    payload, age = await _cached_json(
        key,
        ttl,
        settings.BIGDATACLOUD_URL,
        {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "localityLanguage": "en",
        },
    )
    return (
        {
            "city": payload.get("city") or payload.get("locality") or None,
            "region": payload.get("principalSubdivision") or None,
            "country": payload.get("countryName") or None,
            "country_code": (payload.get("countryCode") or "").upper() or None,
            "geocoder": "bigdatacloud",
        },
        age,
    )


# -------------------------------------------------------------------- holidays


async def fetch_holidays(
    country_code: str, year: int
) -> Tuple[List[Dict[str, Any]], int]:
    """
    The published public-holiday list for a country and year.

    Raises `HolidayNotPublished` for a country-year with no calendar yet. That
    exception is a fact about the data source, distinct from a transport
    failure, and the caller handles the two differently: no calendar means an
    explicitly "unknown" result, unreachable means "try again".
    """
    key = f"holidays:{country_code.upper()}:{year}"

    cached, age = _cache_get(key, settings.HOLIDAY_CACHE_TTL_SECONDS)
    if cached is not None:
        if cached is _UNAVAILABLE_HOLIDAYS:
            raise HolidayNotPublished(country_code, year)
        return cached, age

    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        cached, age = _cache_get(key, settings.HOLIDAY_CACHE_TTL_SECONDS)
        if cached is not None:
            if cached is _UNAVAILABLE_HOLIDAYS:
                raise HolidayNotPublished(country_code, year)
            return cached, age

        response = await get_client().get(
            f"{settings.NAGER_DATE_URL}/PublicHolidays/{year}/{country_code.upper()}",
        )
        # 204 = the country has no published calendar for that year. 404 marks
        # an unrecognised code. Both say "this data does not exist yet".
        if response.status_code in (204, 404):
            _cache_put(key, _UNAVAILABLE_HOLIDAYS)
            raise HolidayNotPublished(country_code, year)
        response.raise_for_status()
        payload = response.json()
        _cache_put(key, payload)
        return payload, 0


def parse_holidays(raw: List[Dict[str, Any]], country_code: str) -> List[HolidayInfo]:
    holidays: List[HolidayInfo] = []
    for item in raw:
        try:
            day = dt.date.fromisoformat(str(item.get("date")))
        except (TypeError, ValueError):
            continue
        holidays.append(
            HolidayInfo(
                is_holiday=True,
                name=item.get("localName") or item.get("name"),
                date=day,
                country_code=country_code.upper(),
            )
        )
    holidays.sort(key=lambda h: h.date or dt.date.min)
    return holidays


def holiday_for(holidays: List[HolidayInfo], day: dt.date, country_code: str) -> HolidayInfo:
    for holiday in holidays:
        if holiday.date == day:
            return holiday
    return HolidayInfo(is_holiday=False, date=day, country_code=country_code.upper())


# ---------------------------------------------------------------------- pollen


async def fetch_pollen_index(lat: float, lon: float) -> Optional[float]:
    """
    Pollen outside Europe, only when a Tomorrow.io key is configured.

    Open-Meteo's pollen fields come from CAMS, which only covers the European
    domain, so this fills a real gap rather than duplicating a source. Returns
    `None` — never a zero — when unavailable, because "no data" and "no pollen"
    are different claims.
    """
    if not settings.TOMORROW_IO_API_KEY:
        return None
    try:
        payload, _ = await _cached_json(
            _coord_key("pollen", lat, lon),
            settings.ENV_CACHE_TTL_SECONDS,
            settings.TOMORROW_IO_URL,
            {
                "location": f"{round(lat, 4)},{round(lon, 4)}",
                "fields": "treeIndex,grassIndex,weedIndex",
                "apikey": settings.TOMORROW_IO_API_KEY,
            },
        )
    except Exception as exc:  # noqa: BLE001 - optional enrichment, never fatal
        log.info("Tomorrow.io pollen unavailable: %s", describe_error(exc))
        return None

    values = (payload.get("data") or {}).get("values") or {}
    present = [
        _num(values.get(field))
        for field in ("treeIndex", "grassIndex", "weedIndex")
    ]
    present = [v for v in present if v is not None]
    return max(present) if present else None


# ------------------------------------------------------------------- aggregate


async def build_location(
    lat: float,
    lon: float,
    *,
    source: str,
    weather: Optional[Dict[str, Any]] = None,
    geo: Optional[Dict[str, Any]] = None,
) -> LocationInfo:
    return LocationInfo(
        latitude=lat,
        longitude=lon,
        city=(geo or {}).get("city"),
        region=(geo or {}).get("region"),
        country=(geo or {}).get("country"),
        country_code=(geo or {}).get("country_code"),
        timezone=(weather or {}).get("timezone"),
        source=source,
        geocoder=(geo or {}).get("geocoder"),
    )


async def gather_environment(
    lat: float,
    lon: float,
    *,
    source: str = "profile",
    include_holiday: bool = True,
) -> Dict[str, Any]:
    """
    One live snapshot for one real location.

    Weather, air quality and geocoding are requested concurrently — serially
    they would stack three round trips into the user's page load. Holidays
    depend on the country code, so they follow geocoding.

    Returns a dict of parsed pieces plus a `sources` list recording, per
    provider, whether it answered and how stale its answer is.
    """
    sources: List[UpstreamStatus] = []

    weather_result, air_result, geo_result = await asyncio.gather(
        fetch_weather(lat, lon),
        fetch_air_quality(lat, lon),
        reverse_geocode(lat, lon),
        return_exceptions=True,
    )

    def unpack(result: Any, provider: str) -> Optional[Any]:
        if isinstance(result, BaseException):
            log.warning("%s failed: %s", provider, describe_error(result))
            sources.append(
                UpstreamStatus(provider=provider, ok=False, error=describe_error(result))
            )
            return None
        payload, age = result
        sources.append(UpstreamStatus(provider=provider, ok=True, cache_age_seconds=age))
        return payload

    weather_payload = unpack(weather_result, "open-meteo-weather")
    air_payload = unpack(air_result, "open-meteo-air-quality")
    geo_payload = unpack(geo_result, "reverse-geocode")

    weather = parse_weather_now(weather_payload) if weather_payload else WeatherNow()
    air = parse_air_quality_now(air_payload) if air_payload else AirQualityNow()
    astronomy = parse_astronomy(weather_payload) if weather_payload else Astronomy()

    if air.pollen_index is None:
        air.pollen_index = await fetch_pollen_index(lat, lon)

    location = await build_location(
        lat, lon, source=source, weather=weather_payload, geo=geo_payload
    )

    holiday = HolidayInfo(unknown=True)
    if include_holiday:
        holiday = await _holiday_today(location, sources)

    return {
        "location": location,
        "weather": weather,
        "air_quality": air,
        "astronomy": astronomy,
        "holiday": holiday,
        "weather_payload": weather_payload,
        "air_payload": air_payload,
        "sources": sources,
    }


async def _holiday_today(
    location: LocationInfo, sources: List[UpstreamStatus]
) -> HolidayInfo:
    """
    Today's holiday status, in the user's own local date.

    Without a country code there is no honest answer, so the result is marked
    `unknown` rather than defaulting to "not a holiday" — the difference matters
    for the holiday-vs-workday mood comparison, which must not silently treat
    unknown days as workdays.
    """
    if not location.country_code:
        return HolidayInfo(unknown=True)

    local_today = _local_today(location.timezone)
    try:
        raw, age = await fetch_holidays(location.country_code, local_today.year)
    except HolidayNotPublished:
        # Real, identifiable fact: no calendar for this country-year. "Unknown"
        # is the only honest holiday status — the comparison must be able to
        # exclude these days rather than count them as workdays.
        sources.append(
            UpstreamStatus(
                provider="nager-date",
                ok=False,
                error=HOLIDAY_NOT_PUBLISHED_MSG,
            )
        )
        return HolidayInfo(unknown=True, country_code=location.country_code)
    except Exception as exc:  # noqa: BLE001 - one provider down is not fatal
        sources.append(
            UpstreamStatus(
                provider="nager-date", ok=False, error=describe_error(exc)
            )
        )
        return HolidayInfo(unknown=True, country_code=location.country_code)

    sources.append(
        UpstreamStatus(provider="nager-date", ok=True, cache_age_seconds=age)
    )
    return holiday_for(
        parse_holidays(raw, location.country_code), local_today, location.country_code
    )


def _local_today(timezone_name: Optional[str]) -> dt.date:
    from zoneinfo import ZoneInfo

    now = utcnow()
    if not timezone_name:
        return now.date()
    try:
        return now.astimezone(ZoneInfo(timezone_name)).date()
    except Exception:  # noqa: BLE001 - an unknown IANA name falls back to UTC
        return now.date()


# ------------------------------------------------------------------ persistence


def build_snapshot(
    bundle: Dict[str, Any],
    *,
    user_id: int,
    mood_entry_id: Optional[int] = None,
):
    """
    Turn a `gather_environment` result into an unpersisted `EnvironmentSnapshot`.

    Check-ins call this so the conditions at the moment of logging are stored
    alongside the entry — that join is what makes "does PM2.5 affect my mood?"
    answerable later. The caller adds and commits it.

    Fields whose provider failed stay `None`. A snapshot with a real
    temperature and a null AQI is an accurate record of a partial reading; one
    with a plausible AQI filled in would poison every correlation computed from
    it.
    """
    from app.models import EnvironmentSnapshot

    location: LocationInfo = bundle["location"]
    weather: WeatherNow = bundle["weather"]
    air: AirQualityNow = bundle["air_quality"]
    astronomy: Astronomy = bundle["astronomy"]
    holiday: HolidayInfo = bundle["holiday"]

    providers = sorted({s.provider for s in bundle["sources"] if s.ok})

    return EnvironmentSnapshot(
        user_id=user_id,
        mood_entry_id=mood_entry_id,
        captured_at=utcnow(),
        latitude=location.latitude,
        longitude=location.longitude,
        city=location.city,
        timezone=location.timezone,
        temperature_c=weather.temperature_c,
        apparent_temperature_c=weather.apparent_temperature_c,
        humidity_pct=weather.humidity_pct,
        pressure_hpa=weather.pressure_hpa,
        cloud_cover_pct=weather.cloud_cover_pct,
        precipitation_mm=weather.precipitation_mm,
        wind_speed_kmh=weather.wind_speed_kmh,
        weather_code=weather.weather_code,
        is_day=None if weather.is_day is None else int(weather.is_day),
        pm2_5=air.pm2_5,
        pm10=air.pm10,
        ozone=air.ozone,
        nitrogen_dioxide=air.nitrogen_dioxide,
        sulphur_dioxide=air.sulphur_dioxide,
        carbon_monoxide=air.carbon_monoxide,
        us_aqi=air.us_aqi,
        european_aqi=air.european_aqi,
        uv_index=air.uv_index,
        pollen_index=air.pollen_index,
        sunrise=astronomy.sunrise,
        sunset=astronomy.sunset,
        daylight_seconds=astronomy.daylight_seconds,
        # `unknown` stays NULL rather than 0: the holiday-vs-workday comparison
        # must be able to exclude days it could not classify.
        is_holiday=None if holiday.unknown else int(holiday.is_holiday),
        holiday_name=holiday.name,
        provider=",".join(providers) if providers else "unavailable",
    )
