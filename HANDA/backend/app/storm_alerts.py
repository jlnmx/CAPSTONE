import hashlib
import json
import logging
from uuid import uuid4

import psycopg

from .config import settings
from .db import CONNECT_TIMEOUT_SECONDS, open_connection_pool
from .push import enqueue_weather_alert
from .sms import send_sms_to_many, sms_delivery_configured
from .typhoons import get_live_typhoons

logger = logging.getLogger(__name__)
STORM_ADVISORY_POLL_SECONDS = 600


def storm_advisory_fingerprint(storm: dict) -> str:
    meaningful_update = {
        "id": storm["id"],
        "classification": storm["classification"],
        "par_status": storm["par_status"],
    }
    return hashlib.sha256(
        json.dumps(meaningful_update, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def storm_advisory_message(storm: dict) -> str:
    wind = storm.get("max_wind_kmh")
    wind_text = f" Maximum winds: {wind} km/h." if wind is not None else ""
    return (
        f"HANDA Storm Advisory: {storm['international_name']} is a "
        f"{storm['classification']} inside PAR.{wind_text} "
        "Follow official PAGASA bulletins."
    )


def notify_storm_advisory(connection: psycopg.Connection, storm: dict) -> bool:
    if storm.get("par_status") != "Inside PAR":
        return False
    fingerprint = storm_advisory_fingerprint(storm)
    with connection.transaction():
        inserted = connection.execute(
            """
            INSERT INTO storm_advisory_sms_events (storm_id, fingerprint)
            VALUES (%s, %s)
            ON CONFLICT (storm_id, fingerprint) DO NOTHING
            RETURNING storm_id
            """,
            (storm["id"], fingerprint),
        ).fetchone()
        if not inserted:
            return False

        title = f"Tropical storm advisory: {storm['international_name']}"
        message = storm_advisory_message(storm)
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
                (f"weather-{uuid4()}", user_id, title, message),
            )
            enqueue_weather_alert(connection, user_id, title, message)

        recipients = connection.execute(
            """
            SELECT mobile_number FROM users
            WHERE status = 'Active' AND sms_alerts_enabled
              AND mobile_number IS NOT NULL AND mobile_number <> ''
            """
        ).fetchall()
        numbers = [recipient[0] for recipient in recipients]
        if numbers and sms_delivery_configured(settings):
            send_sms_to_many(numbers, message, configuration=settings)
    return True


def process_live_storm_advisories() -> int:
    storms = get_live_typhoons()
    if not storms:
        return 0

    notifications_sent = 0
    with open_connection_pool().connection(timeout=CONNECT_TIMEOUT_SECONDS) as connection:
        for storm in storms:
            try:
                if notify_storm_advisory(connection, storm):
                    notifications_sent += 1
            except Exception:
                logger.exception("Tropical storm advisory SMS could not be delivered.")
    return notifications_sent
