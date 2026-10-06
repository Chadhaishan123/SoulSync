"""
Live environment schemas.

Every field here holds a measurement fetched from a third-party API for the
user's real coordinates. Nothing is estimated, interpolated or filled in: when
an upstream fails the field is `None` and the failure is reported in `sources`,
so the UI can say "air quality unavailable" instead of drawing a plausible
number.
"""

from __future__ import annotations

import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, Field


class UpstreamStatus(BaseModel):
    """
    Per-provider outcome for one request.

    Surfaced to the client (and on the Model Transparency page) because a
    partial reading presented as complete is the same lie as invented data.
    """

    provider: str
    ok: bool
    error: Optional[str] = None
    # 0 means fetched fresh for this request.
    cache_age_seconds: Optional[int] = None


class LocationInfo(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    # IANA name resolved from the coordinates by Open-Meteo.
    timezone: Optional[str] = None
    # "profile" when taken from the stored consented coordinates, "request"
    # when the client passed fresh browser coordinates.
    source: str = "profile"
    # Which service resolved the city name, or None if none could.
    geocoder: Optional[str] = None


class WeatherNow(BaseModel):
    temperature_c: Optional[float] = None
    apparent_temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    pressure_hpa: Optional[float] = None
    cloud_cover_pct: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    weather_code: Optional[int] = None
    # Plain-language reading of the WMO code (a published standard table, not
    # a generated description).
    weather_label: Optional[str] = None
    is_day: Optional[bool] = None
    observed_at: Optional[dt.datetime] = None


class AirQualityNow(BaseModel):
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    ozone: Optional[float] = None
    nitrogen_dioxide: Optional[float] = None
    sulphur_dioxide: Optional[float] = None
    carbon_monoxide: Optional[float] = None
    us_aqi: Optional[int] = None
    european_aqi: Optional[int] = None
    uv_index: Optional[float] = None
    pollen_index: Optional[float] = None
    # US EPA band for `us_aqi` and the official advice for that band.
    aqi_band: Optional[str] = None
    aqi_advice: Optional[str] = None


class Astronomy(BaseModel):
    sunrise: Optional[dt.datetime] = None
    sunset: Optional[dt.datetime] = None
    daylight_seconds: Optional[int] = None
    uv_index_max: Optional[float] = None
    is_daylight_now: Optional[bool] = None
    # Drives the real circadian nudge ("sunset is in 40 minutes").
    minutes_to_sunset: Optional[int] = None
    minutes_since_sunrise: Optional[int] = None


class HolidayInfo(BaseModel):
    is_holiday: bool = False
    name: Optional[str] = None
    date: Optional[dt.date] = None
    country_code: Optional[str] = None
    # True when no country code was resolvable, so "not a holiday" would be an
    # unfounded claim rather than a finding.
    unknown: bool = False


class EnvironmentNow(BaseModel):
    """The complete live context for one moment at one real location."""

    location: LocationInfo
    weather: WeatherNow
    air_quality: AirQualityNow
    astronomy: Astronomy
    holiday: HolidayInfo
    fetched_at: dt.datetime
    sources: List[UpstreamStatus] = Field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return all(s.ok for s in self.sources)


class ForecastDay(BaseModel):
    date: dt.date
    temperature_min_c: Optional[float] = None
    temperature_max_c: Optional[float] = None
    apparent_max_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    precipitation_probability_pct: Optional[int] = None
    wind_speed_max_kmh: Optional[float] = None
    weather_code: Optional[int] = None
    weather_label: Optional[str] = None
    uv_index_max: Optional[float] = None
    sunrise: Optional[dt.datetime] = None
    sunset: Optional[dt.datetime] = None
    daylight_seconds: Optional[int] = None
    pm2_5_mean: Optional[float] = None
    us_aqi_max: Optional[int] = None


class ForecastOut(BaseModel):
    location: LocationInfo
    days: List[ForecastDay]
    fetched_at: dt.datetime
    sources: List[UpstreamStatus] = Field(default_factory=list)


class HolidayOut(BaseModel):
    country_code: str
    year: int
    holidays: List[HolidayInfo]
    fetched_at: dt.datetime
    sources: List[UpstreamStatus] = Field(default_factory=list)


class AstronomyOut(BaseModel):
    location: LocationInfo
    today: Astronomy
    upcoming: List[ForecastDay] = Field(default_factory=list)
    fetched_at: dt.datetime
    sources: List[UpstreamStatus] = Field(default_factory=list)
