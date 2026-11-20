import math
from datetime import date
from uuid import uuid4

import psycopg

from .config import settings
from .db import CONNECT_TIMEOUT_SECONDS, open_connection_pool
from .push import enqueue_weather_alert
from .weather import get_google_weather_snapshot

WEATHER_ALERT_POLL_SECONDS = 600


def _forecast_date(item: dict) -> str | None:
    value = item.get("time")
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except ValueError:
        return None


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)


def significant_weather_alerts(snapshot: dict) -> list[dict]:
    alerts: dict[tuple[str, str], dict] = {}
    current = snapshot.get("current")
    hourly = snapshot.get("hourly")
    observations = [current] if isinstance(current, dict) else []
    if isinstance(hourly, list):
        observations.extend(item for item in hourly if isinstance(item, dict))

    def record(kind: str, forecast_date: str | None, severity: int, value: float | None = None) -> None:
        if not forecast_date:
            return
        key = (kind, forecast_date)
        alert = alerts.get(key)
        if alert is None:
            alerts[key] = {"kind": kind, "date": forecast_date, "severity": severity, "value": value}
            return
        alert["severity"] = max(alert["severity"], severity)
        if value is not None:
            alert["value"] = max(alert["value"] or value, value)

    for observation in observations:
        forecast_date = _forecast_date(observation)
        condition = str(observation.get("conditionType") or "").upper()
        temperature = _number(observation.get("temperature"))
        precipitation = _number(observation.get("precipitation"))
        wind_speed = _number(observation.get("windSpeed")) or 0
        wind_gust = _number(observation.get("windGust")) or 0
        thunder_probability = _number(observation.get("thunderstormProbability"))

        if "THUNDER" in condition or "HAIL" in condition or (
            thunder_probability is not None and thunder_probability >= 50
        ):
            severity = 2 if (
                "HAIL" in condition
                or (thunder_probability is not None and thunder_probability >= 70)
            ) else 1
            record("thunderstorms", forecast_date, severity, thunder_probability)

        if (
            (precipitation is not None and precipitation >= 7.5)
            or ("HEAVY" in condition and "RAIN" in condition)
        ):
            severity = 2 if precipitation is not None and precipitation >= 15 else 1
            record("heavy-rain", forecast_date, severity, precipitation)

        if wind_speed >= 40 or wind_gust >= 50:
            severity = 2 if wind_speed >= 55 or wind_gust >= 70 else 1
            record("strong-winds", forecast_date, severity, max(wind_speed, wind_gust))

        if temperature is not None and temperature >= 35:
            record("dangerous-heat", forecast_date, 2 if temperature >= 40 else 1, temperature)

    return [
        {
            **alert,
            "key": f"{alert['kind']}:{alert['date']}",
            "title": _alert_title(alert["kind"]),
            "message": _alert_message(alert),
        }
        for alert in sorted(alerts.values(), key=lambda item: (item["date"], item["kind"]))
    ]


def _alert_title(kind: str) -> str:
    return {
        "thunderstorms": "Thunderstorm alert",
        "heavy-rain": "Heavy rain alert",
        "strong-winds": "Strong wind alert",
        "dangerous-heat": "Dangerous heat alert",
    }[kind]


def _alert_message(alert: dict) -> str:
    forecast_date = alert["date"]
    intensified = " Conditions have intensified." if alert["severity"] > 1 else ""
    value = alert["value"]
    if alert["kind"] == "thunderstorms":
        details = "Thunderstorms or hail are forecast. Stay indoors during lightning and monitor PAGASA advisories."
    elif alert["kind"] == "heavy-rain":
        amount = f" up to {value:g} mm per hour" if value is not None else ""
        details = f"Heavy rainfall is forecast{amount}. Watch for localized flooding and monitor PAGASA advisories."
    elif alert["kind"] == "strong-winds":
        amount = f" up to {value:g} km/h" if value is not None else ""
        details = f"Strong winds are forecast{amount}. Secure loose outdoor items and monitor PAGASA advisories."
    else:
        amount = f" up to {value:g} degrees C" if value is not None else ""
        details = f"High temperatures are forecast{amount}. Limit outdoor exposure and stay hydrated."
    return f"Binan forecast for {forecast_date}: {details}{intensified} This forecast is not an official warning."


def notify_weather_alert(connection: psycopg.Connection, alert: dict) -> bool:
    with connection.transaction():
        changed = connection.execute(
            """
            INSERT INTO weather_alert_state (alert_key, forecast_date, severity)
            VALUES (%s, %s, %s)
            ON CONFLICT (alert_key) DO UPDATE
              SET severity = EXCLUDED.severity, updated_at = NOW()
              WHERE weather_alert_state.severity < EXCLUDED.severity
            RETURNING alert_key
            """,
            (alert["key"], date.fromisoformat(alert["date"]), alert["severity"]),
        ).fetchone()
        if not changed:
            return False

        recipients = connection.execute(
            "SELECT id FROM users WHERE status = 'Active' AND role IN ('Resident', 'Responder')"
        ).fetchall()
        for recipient in recipients:
            user_id = recipient["id"]
            connection.execute(
                """
                INSERT INTO notifications (id, user_id, incident_id, title, message, notification_type)
                VALUES (%s, %s, NULL, %s, %s, 'weather')
                """,
                (f"weather-{uuid4()}", user_id, alert["title"], alert["message"]),
            )
            enqueue_weather_alert(connection, user_id, alert["title"], alert["message"])
    return True


def process_weather_alerts() -> int:
    if not settings.google_weather_api_key:
        return 0
    snapshot = get_google_weather_snapshot(settings.google_weather_api_key)
    alerts = significant_weather_alerts(snapshot)
    if not alerts:
        return 0

    sent = 0
    with open_connection_pool().connection(timeout=CONNECT_TIMEOUT_SECONDS) as connection:
        for alert in alerts:
            if notify_weather_alert(connection, alert):
                sent += 1
    return sent
