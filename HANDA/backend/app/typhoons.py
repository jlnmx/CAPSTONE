import json
import re
import threading
import time
from datetime import UTC, datetime
from urllib.error import URLError
from urllib.request import Request, urlopen


GDACS_TROPICAL_CYCLONES_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventtype=TC"
GDACS_SOURCE_URL = "https://www.gdacs.org/"
CACHE_SECONDS = 300
REGION_BOUNDS = (100.0, 0.0, 180.0, 35.0)
PAR_BOUNDARY = ((115.0, 5.0), (115.0, 15.0), (120.0, 21.0), (120.0, 25.0), (135.0, 25.0), (135.0, 5.0))

_cache_lock = threading.Lock()
_cached_at: float | None = None
_cached_storms: list[dict] = []


def is_inside_par(longitude: float, latitude: float) -> bool:
    inside = False
    previous_longitude, previous_latitude = PAR_BOUNDARY[-1]
    for current_longitude, current_latitude in PAR_BOUNDARY:
        cross_product = (longitude - previous_longitude) * (current_latitude - previous_latitude) - (latitude - previous_latitude) * (current_longitude - previous_longitude)
        if abs(cross_product) < 1e-9 and min(previous_longitude, current_longitude) <= longitude <= max(previous_longitude, current_longitude) and min(previous_latitude, current_latitude) <= latitude <= max(previous_latitude, current_latitude):
            return True
        crosses_latitude = (current_latitude > latitude) != (previous_latitude > latitude)
        if crosses_latitude:
            crossing_longitude = (previous_longitude - current_longitude) * (latitude - current_latitude) / (previous_latitude - current_latitude) + current_longitude
            if longitude < crossing_longitude:
                inside = not inside
        previous_longitude, previous_latitude = current_longitude, current_latitude
    return inside


def _international_name(properties: dict) -> str:
    value = str(properties.get("eventname") or properties.get("name") or "Tropical cyclone").strip()
    value = re.sub(r"-\d{2}$", "", value)
    value = re.sub(r"^Tropical Cyclone\s+", "", value, flags=re.IGNORECASE)
    return value.title()


def _wind_speed_kmh(properties: dict) -> int | None:
    severity = properties.get("severitydata") or {}
    value = severity.get("severity")
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    unit = str(severity.get("severityunit", "")).lower()
    if unit == "km/h":
        return round(value)
    if unit == "m/s":
        return round(value * 3.6)
    if unit == "knots":
        return round(value * 1.852)
    return None


def parse_gdacs_typhoons(payload: dict) -> list[dict]:
    storms = []
    min_longitude, min_latitude, max_longitude, max_latitude = REGION_BOUNDS
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if str(properties.get("eventtype", "")).upper() != "TC":
            continue
        if str(properties.get("iscurrent", "")).lower() != "true":
            continue
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue

        longitude, latitude = coordinates[:2]
        if not (min_longitude <= longitude <= max_longitude and min_latitude <= latitude <= max_latitude):
            continue

        inside_par = is_inside_par(longitude, latitude)
        event_id = properties.get("eventid")
        storms.append({
            "id": f"gdacs-{event_id}",
            "international_name": _international_name(properties),
            "status": "Active",
            "latitude": latitude,
            "longitude": longitude,
            "par_status": "Inside PAR" if inside_par else "Outside PAR",
            "signal_no": None,
            "max_wind_kmh": _wind_speed_kmh(properties),
            "gust_speed_kmh": None,
            "data_source": str(properties.get("source") or "GDACS"),
            "source_url": (properties.get("url") or {}).get("report") or GDACS_SOURCE_URL,
            "updated_at": properties.get("datemodified"),
        })

    return sorted(storms, key=lambda storm: (storm["par_status"] != "Inside PAR", storm["international_name"]))


def get_live_typhoons() -> list[dict]:
    global _cached_at, _cached_storms
    with _cache_lock:
        if _cached_at is not None and time.monotonic() - _cached_at < CACHE_SECONDS:
            return _cached_storms

        request = Request(GDACS_TROPICAL_CYCLONES_URL, headers={"User-Agent": "HANDA-weather-dashboard/1.0"})
        try:
            with urlopen(request, timeout=8) as response:
                payload = json.load(response)
        except (OSError, TimeoutError, ValueError, URLError) as error:
            raise RuntimeError("GDACS tropical cyclone feed is unavailable") from error

        _cached_storms = parse_gdacs_typhoons(payload)
        _cached_at = time.monotonic()
        return _cached_storms