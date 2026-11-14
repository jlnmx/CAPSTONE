import hashlib
import json
import logging

import psycopg

from .config import settings
from .db import CONNECT_TIMEOUT_SECONDS
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

        recipients = connection.execute(
            """
            SELECT mobile_number FROM users
            WHERE status = 'Active' AND sms_alerts_enabled
              AND mobile_number IS NOT NULL AND mobile_number <> ''
            """
        ).fetchall()
        numbers = [recipient[0] for recipient in recipients]
        if numbers:
            send_sms_to_many(numbers, storm_advisory_message(storm), configuration=settings)
    return True


def process_live_storm_advisories() -> int:
    if not sms_delivery_configured(settings):
        return 0

    storms = get_live_typhoons()
    if not storms:
        return 0

    notifications_sent = 0
    with psycopg.connect(
        settings.database_url,
        connect_timeout=CONNECT_TIMEOUT_SECONDS,
    ) as connection:
        for storm in storms:
            try:
                if notify_storm_advisory(connection, storm):
                    notifications_sent += 1
            except Exception:
                logger.exception("Tropical storm advisory SMS could not be delivered.")
    return notifications_sent
