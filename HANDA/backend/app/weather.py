import copy
import json
import logging
import math
from threading import RLock
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException

logger = logging.getLogger(__name__)

BINAN_WEATHER_LOCATION = {"latitude": 14.3036, "longitude": 121.0781}
WEATHER_CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup"
WEATHER_HOURS_URL = "https://weather.googleapis.com/v1/forecast/hours:lookup"
WEATHER_DAYS_URL = "https://weather.googleapis.com/v1/forecast/days:lookup"
AIR_QUALITY_URL = "https://airquality.googleapis.com/v1/currentConditions:lookup"
WEATHER_CACHE_SECONDS = 60 * 60
FAILED_AIR_QUALITY_CACHE_SECONDS = 5 * 60

_cache_lock = RLock()
_cached_snapshot: dict | None = None
_cache_expires_at = 0.0


def _google_request(
    service: str,
    url: str,
    api_key: str,
    *,
    query: dict[str, str] | None = None,
    body: dict | None = None,
) -> dict:
    params = {"key": api_key, **(query or {})}
    request_url = f"{url}?{urlencode(params)}"
    request = Request(
        request_url,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"Content-Type": "application/json"} if body is not None else {},
        method="POST" if body is not None else "GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        logger.warning("Google %s API returned HTTP %s.", service, error.code)
        if error.code == 403:
            raise HTTPException(
                status_code=503,
                detail=f"Google {service} API is not enabled or allowed for the server key.",
            ) from error
        raise HTTPException(
            status_code=502,
            detail=f"Google {service} data is temporarily unavailable. Try again shortly.",
        ) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        logger.warning("Google %s request failed (%s).", service, type(error).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"Google {service} data is temporarily unavailable. Try again shortly.",
        ) from error
    if not isinstance(result, dict):
        raise HTTPException(status_code=502, detail=f"Google {service} returned an invalid response.")
    return result


def _number(value: object, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise HTTPException(status_code=502, detail=f"Google Weather returned invalid {field} data.")
    return float(value)


def _degrees(source: dict, key: str, field: str) -> float:
    value = source.get(key)
    degrees = value.get("degrees") if isinstance(value, dict) else None
    return _number(degrees, field)


def _optional_number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)


def _condition(source: dict, service: str = "Weather") -> tuple[str, str]:
    condition = source.get("weatherCondition")
    condition_type = condition.get("type") if isinstance(condition, dict) else None
    description = condition.get("description") if isinstance(condition, dict) else None
    description_text = description.get("text") if isinstance(description, dict) else None
    if not isinstance(condition_type, str) or not condition_type:
        raise HTTPException(status_code=502, detail=f"Google {service} returned an invalid weather condition.")
    return condition_type, description_text if isinstance(description_text, str) and description_text else condition_type.replace("_", " ").title()


def _precipitation(source: dict) -> tuple[float | None, float | None]:
    precipitation = source.get("precipitation")
    if not isinstance(precipitation, dict):
        return None, None
    probability = precipitation.get("probability")
    qpf = precipitation.get("qpf")
    probability_percent = probability.get("percent") if isinstance(probability, dict) else None
    quantity = qpf.get("quantity") if isinstance(qpf, dict) else None
    return _optional_number(probability_percent), _optional_number(quantity)


def _wind_value(source: dict, key: str) -> float | None:
    wind = source.get("wind")
    value = wind.get(key) if isinstance(wind, dict) else None
    speed = value.get("value") if isinstance(value, dict) else None
    return _optional_number(speed)


def _forecast_hour_time(source: dict) -> str:
    display_time = source.get("displayDateTime")
    if not isinstance(display_time, dict):
        raise HTTPException(status_code=502, detail="Google Weather returned an invalid forecast time.")
    try:
        year = int(display_time["year"])
        month = int(display_time["month"])
        day = int(display_time["day"])
        hour = int(display_time["hours"])
        if not (1 <= month <= 12 and 1 <= day <= 31 and 0 <= hour <= 23):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Google Weather returned an invalid forecast time.") from None
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:00"


def _forecast_day_date(source: dict) -> str:
    display_date = source.get("displayDate")
    if not isinstance(display_date, dict):
        raise HTTPException(status_code=502, detail="Google Weather returned an invalid forecast date.")
    try:
        year = int(display_date["year"])
        month = int(display_date["month"])
        day = int(display_date["day"])
        if not (1 <= month <= 12 and 1 <= day <= 31):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="Google Weather returned an invalid forecast date.") from None
    return f"{year:04d}-{month:02d}-{day:02d}"


def _air_quality_factor(response: dict) -> int | None:
    indexes = response.get("indexes")
    if not isinstance(indexes, list):
        return None
    index = next(
        (item for item in indexes if isinstance(item, dict) and item.get("code") == "uaqi"),
        next((item for item in indexes if isinstance(item, dict)), None),
    )
    category = index.get("category") if isinstance(index, dict) else None
    if not isinstance(category, str) or not category.strip():
        return None
    normalized = category.lower()
    if any(term in normalized for term in ("extreme", "hazardous", "very unhealthy")):
        return 4
    if any(term in normalized for term in ("unhealthy", "very poor")):
        return 3
    if any(term in normalized for term in ("poor", "sensitive")):
        return 2
    if any(term in normalized for term in ("moderate", "fair")):
        return 1
    return 0


def _weather_risk_factor(current: dict, hourly: list[dict]) -> int:
    level = 0
    observations = [current, *hourly]
    for item in observations:
        condition_type = str(item.get("conditionType", "")).upper()
        temperature = item.get("temperature")
        precipitation = item.get("precipitation")
        wind_speed = item.get("windSpeed")
        wind_gust = item.get("windGust")
        thunderstorm_probability = item.get("thunderstormProbability")

        if "THUNDER" in condition_type or "HAIL" in condition_type or (thunderstorm_probability or 0) >= 60:
            level = max(level, 3)
        if ("HEAVY" in condition_type and "RAIN" in condition_type) or (precipitation or 0) >= 10:
            level = max(level, 3)
        if (wind_gust or 0) >= 70 or (wind_speed or 0) >= 55:
            level = max(level, 4)
        elif "WINDY" in condition_type or (wind_gust or 0) >= 50 or (wind_speed or 0) >= 40:
            level = max(level, 3)
        if isinstance(temperature, (int, float)):
            if temperature >= 40:
                level = max(level, 4)
            elif temperature >= 35:
                level = max(level, 2)
        if (precipitation or 0) > 0 or any(term in condition_type for term in ("RAIN", "SHOWERS")):
            level = max(level, 1)
    return level


def _risk_label(level: int) -> str:
    return ("Low", "Moderate", "Elevated", "High", "Very high")[level]


def normalize_google_weather(current_response: dict, hours_response: dict, days_response: dict, air_quality_response: dict | None) -> dict:
    raw_current = current_response.get("currentTime")
    if not isinstance(raw_current, str):
        raise HTTPException(status_code=502, detail="Google Weather returned no current conditions.")
    current_condition_type, current_description = _condition(current_response)
    current = {
        "time": raw_current,
        "temperature": _degrees(current_response, "temperature", "current temperature"),
        "feelsLike": _degrees(current_response, "feelsLikeTemperature", "feels-like temperature"),
        "humidity": _number(current_response.get("relativeHumidity"), "humidity"),
        "windSpeed": _number(_wind_value(current_response, "speed"), "wind speed"),
        "conditionType": current_condition_type,
        "conditionDescription": current_description,
        "isDay": bool(current_response.get("isDaytime")),
    }

    raw_hours = hours_response.get("forecastHours")
    raw_days = days_response.get("forecastDays")
    if not isinstance(raw_hours, list) or not raw_hours or not isinstance(raw_days, list) or not raw_days:
        raise HTTPException(status_code=502, detail="Google Weather returned no forecast data.")

    hourly = []
    for item in raw_hours:
        if not isinstance(item, dict):
            raise HTTPException(status_code=502, detail="Google Weather returned an invalid hourly forecast.")
        condition_type, description = _condition(item)
        precipitation_probability, precipitation = _precipitation(item)
        hourly.append({
            "time": _forecast_hour_time(item),
            "temperature": _degrees(item, "temperature", "hourly temperature"),
            "precipitationProbability": precipitation_probability,
            "precipitation": precipitation,
            "windSpeed": _wind_value(item, "speed"),
            "windGust": _wind_value(item, "gust"),
            "thunderstormProbability": _optional_number(item.get("thunderstormProbability")),
            "conditionType": condition_type,
            "conditionDescription": description,
            "isDay": bool(item.get("isDaytime")),
        })

    daily = []
    for item in raw_days:
        if not isinstance(item, dict):
            raise HTTPException(status_code=502, detail="Google Weather returned an invalid daily forecast.")
        daytime = item.get("daytimeForecast")
        nighttime = item.get("nighttimeForecast")
        if not isinstance(daytime, dict) or not isinstance(nighttime, dict):
            raise HTTPException(status_code=502, detail="Google Weather returned incomplete daily forecast data.")
        condition_type, description = _condition(daytime)
        day_probability, day_precipitation = _precipitation(daytime)
        night_probability, night_precipitation = _precipitation(nighttime)
        wind_speeds = [speed for speed in (_wind_value(daytime, "speed"), _wind_value(nighttime, "speed")) if speed is not None]
        daily.append({
            "date": _forecast_day_date(item),
            "conditionType": condition_type,
            "conditionDescription": description,
            "minTemperature": _degrees(item, "minTemperature", "daily minimum temperature"),
            "maxTemperature": _degrees(item, "maxTemperature", "daily maximum temperature"),
            "precipitationSum": day_precipitation + night_precipitation if day_precipitation is not None and night_precipitation is not None else None,
            "precipitationProbability": max(day_probability, night_probability) if day_probability is not None and night_probability is not None else day_probability if day_probability is not None else night_probability,
            "windSpeedMax": max(wind_speeds) if wind_speeds else None,
        })

    air_quality_factor = _air_quality_factor(air_quality_response) if air_quality_response else None
    air_quality_available = air_quality_factor is not None
    environmental_risk = None
    if air_quality_available:
        weather_factor = _weather_risk_factor(current, hourly)
        level = max(air_quality_factor, weather_factor)
        environmental_risk = {
            "level": level,
            "label": _risk_label(level),
            "airQualityFactor": _risk_label(air_quality_factor),
            "weatherFactor": _risk_label(weather_factor),
            "basis": "Combined current air quality and the next 24 hours of forecast conditions.",
        }

    return {
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "airQualityAvailable": air_quality_available,
        "environmentalRisk": environmental_risk,
    }


def _fetch_google_weather(api_key: str) -> dict:
    location_query = {
        "location.latitude": str(BINAN_WEATHER_LOCATION["latitude"]),
        "location.longitude": str(BINAN_WEATHER_LOCATION["longitude"]),
        "unitsSystem": "METRIC",
        "languageCode": "en",
    }
    current = _google_request("Weather", WEATHER_CURRENT_URL, api_key, query=location_query)
    hourly = _google_request(
        "Weather",
        WEATHER_HOURS_URL,
        api_key,
        query={**location_query, "hours": "24", "pageSize": "24"},
    )
    daily = _google_request(
        "Weather",
        WEATHER_DAYS_URL,
        api_key,
        query={**location_query, "days": "7", "pageSize": "7"},
    )
    try:
        air_quality = _google_request(
            "Air Quality",
            AIR_QUALITY_URL,
            api_key,
            body={
                "universalAqi": True,
                "location": BINAN_WEATHER_LOCATION,
                "languageCode": "en",
            },
        )
    except HTTPException as error:
        logger.warning("Google Air Quality data was unavailable (HTTP %s).", error.status_code)
        air_quality = None
    return normalize_google_weather(current, hourly, daily, air_quality)


def get_google_weather_snapshot(api_key: str) -> dict:
    global _cached_snapshot, _cache_expires_at
    with _cache_lock:
        now = monotonic()
        if _cached_snapshot is not None and now < _cache_expires_at:
            return copy.deepcopy(_cached_snapshot)
        snapshot = _fetch_google_weather(api_key)
        cache_seconds = WEATHER_CACHE_SECONDS if snapshot["airQualityAvailable"] else FAILED_AIR_QUALITY_CACHE_SECONDS
        _cached_snapshot = copy.deepcopy(snapshot)
        _cache_expires_at = monotonic() + cache_seconds
        return snapshot
