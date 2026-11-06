import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg
from psycopg.rows import dict_row

from .config import settings
from .db import CONNECT_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)
EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"

PUSH_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS push_devices (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices (user_id);
CREATE TABLE IF NOT EXISTS push_deliveries (
    id BIGSERIAL PRIMARY KEY,
    token TEXT NOT NULL REFERENCES push_devices(token) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'incident',
    receipt_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_deliveries_due_idx ON push_deliveries (next_attempt);
ALTER TABLE push_deliveries ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'incident';
"""


def enqueue_user(connection: psycopg.Connection, user_id: str, incident_id: str, title: str, body: str) -> None:
    connection.execute(
        """INSERT INTO push_deliveries (token, user_id, title, body, incident_id)
           SELECT token, user_id, %s, %s, %s FROM push_devices
           WHERE user_id = %s AND updated_at > NOW() - INTERVAL '30 days'""",
        (title, body, incident_id, user_id),
    )


def enqueue_evacuation_status(connection: psycopg.Connection, user_id: str, registration_id: str, body: str) -> None:
    connection.execute(
        """INSERT INTO push_deliveries (token, user_id, title, body, incident_id, notification_type)
           SELECT token, user_id, %s, %s, %s, 'evacuation'
           FROM push_devices WHERE user_id = %s AND updated_at > NOW() - INTERVAL '30 days'""",
        ("Evacuation status update", body, registration_id, user_id),
    )


def enqueue_responders(connection: psycopg.Connection, incident_id: str, incident_type: str, severity: str, location: str, exclude_user_id: str | None) -> None:
    connection.execute(
        """INSERT INTO push_deliveries (token, user_id, title, body, incident_id)
           SELECT devices.token, devices.user_id, %s, %s, %s
           FROM push_devices AS devices JOIN users ON users.id = devices.user_id
           WHERE users.role = 'Responder' AND users.status = 'Active'
             AND users.id <> COALESCE(%s, '')
             AND devices.updated_at > NOW() - INTERVAL '30 days'""",
        ("New incident reported", f"{incident_type}: {severity.upper()} severity. Location: {location}.", incident_id, exclude_user_id),
    )


def _request(url: str, body: dict) -> dict:
    request = Request(url, data=json.dumps(body).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
    }, method="POST")
    with urlopen(request, timeout=15) as response:
        result = json.load(response)
    if not isinstance(result, dict):
        raise ValueError("Expo returned an invalid response")
    return result


def _retry(connection: psycopg.Connection, delivery: dict, reason: str) -> None:
    logger.warning("Push delivery %s failed: %s", delivery["id"], reason)
    connection.execute(
        """UPDATE push_deliveries SET attempts = attempts + 1,
           next_attempt = NOW() + LEAST(3600, 15 * POWER(2, LEAST(attempts, 8))) * INTERVAL '1 second'
           WHERE id = %s""",
        (delivery["id"],),
    )


def process_one() -> bool:
    with psycopg.connect(settings.database_url, row_factory=dict_row, connect_timeout=CONNECT_TIMEOUT_SECONDS) as connection:
        # A row lock prevents multiple API instances from delivering the same alert concurrently.
        delivery = connection.execute(
            """SELECT d.* FROM push_deliveries d
               JOIN push_devices p ON p.token = d.token AND p.user_id = d.user_id
               WHERE d.next_attempt <= NOW()
               ORDER BY d.next_attempt, d.id FOR UPDATE OF d, p SKIP LOCKED LIMIT 1"""
        ).fetchone()
        if not delivery:
            return False
        if delivery["attempts"] >= 10:
            logger.error("Push delivery %s abandoned after repeated failures", delivery["id"])
            connection.execute("DELETE FROM push_deliveries WHERE id = %s", (delivery["id"],))
            return True
        try:
            if delivery["receipt_id"]:
                data = _request(EXPO_RECEIPTS_URL, {"ids": [delivery["receipt_id"]]}).get("data", {})
                ticket = data.get(delivery["receipt_id"]) if isinstance(data, dict) else None
                if ticket is None:
                    _retry(connection, delivery, "receipt not available yet")
                    return True
            else:
                data = _request(EXPO_SEND_URL, {
                    "to": delivery["token"],
                    "title": delivery["title"],
                    "body": delivery["body"],
                    "sound": "default",
                    "priority": "high",
                    "channelId": "incidents",
                    "data": (
                        {"type": "evacuation", "registrationId": delivery["incident_id"]}
                        if delivery["notification_type"] == "evacuation"
                        else {"type": "incident", "incidentId": delivery["incident_id"]}
                    ),
                }).get("data")
                ticket = data[0] if isinstance(data, list) and data else data
            if not isinstance(ticket, dict):
                raise ValueError("Expo returned an invalid ticket or receipt")
            if ticket.get("status") == "ok":
                if delivery["receipt_id"]:
                    connection.execute("DELETE FROM push_deliveries WHERE id = %s", (delivery["id"],))
                elif isinstance(ticket.get("id"), str):
                    connection.execute(
                        "UPDATE push_deliveries SET receipt_id = %s, attempts = 0, next_attempt = NOW() + INTERVAL '20 seconds' WHERE id = %s",
                        (ticket["id"], delivery["id"]),
                    )
                else:
                    raise ValueError("Expo did not return a receipt ID")
            elif isinstance(ticket.get("details"), dict) and ticket["details"].get("error") == "DeviceNotRegistered":
                connection.execute("DELETE FROM push_devices WHERE token = %s AND user_id = %s", (delivery["token"], delivery["user_id"]))
            else:
                _retry(connection, delivery, str(ticket.get("message", "Expo rejected notification"))[:200])
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
            _retry(connection, delivery, type(error).__name__)
        return True
