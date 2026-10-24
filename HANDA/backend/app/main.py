import base64
import json
import hashlib
import hmac
import logging
import secrets
import smtplib
from email.message import EmailMessage
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentUser, create_access_token, get_current_user, normalize_role, require_roles
from .config import settings
from .db import CONNECT_TIMEOUT_SECONDS, get_connection
from .typhoons import get_live_typhoon_report
from .schemas import AdminUserCreate, AdminUserUpdate, CenterCapacityUpdate, CenterCreate, DisasterCreate, EvacuationRegistrationCreate, EvacuationRegistrationStatusUpdate, EvacueeCreate, EvacueeStatusUpdate, HouseholdMembersUpdate, IncidentCreate, IncidentStatusUpdate, NotificationPreferencesUpdate, PasswordResetCompletion, PasswordResetOtpVerification, PasswordResetRequest, ResponderApplicationReview, ResidentAccountUpdate, ResidentProfileUpdate, SyncBatch, UserLogin, UserRegistration
from .schemas import SelfProfileUpdate

logger = logging.getLogger(__name__)


def normalize_id(value: str | None, prefix: str) -> str:
    return value or f"{prefix}-{uuid4()}"


def timestamp(value: datetime | None) -> datetime:
    return value or datetime.now(UTC)


def write_log(connection: psycopg.Connection, category: str, action: str, actor_id: str, entity_type: str, entity_id: str | None, details: str, status: str = "success") -> None:
    connection.execute(
        "INSERT INTO application_logs (category, action, actor_id, entity_type, entity_id, details, status) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (category, action, actor_id, entity_type, entity_id, details, status),
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split('$')
        if algorithm != 'pbkdf2_sha256':
            return False
        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def hash_reset_otp(otp: str) -> str:
    return hmac.new(settings.auth_secret.encode(), otp.encode(), hashlib.sha256).hexdigest()


def mask_destination(value: str, channel: str) -> str:
    if channel == "email":
        name, domain = value.split("@", 1)
        return f"{name[:1]}***@{domain}"
    return f"***{value[-4:]}"


def deliver_password_reset_otp(destination: str, channel: str, otp: str) -> None:
    if channel == "email" and settings.smtp_host and settings.smtp_from:
        message = EmailMessage()
        message["Subject"] = "Your HANDA password reset code"
        message["From"] = settings.smtp_from
        message["To"] = destination
        message.set_content(f"Your HANDA password reset code is {otp}. It expires in {settings.password_reset_expiry_minutes} minutes.")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return

    if channel == "sms" and settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number:
        from urllib.parse import urlencode
        from urllib.request import Request, urlopen

        body = urlencode({"To": destination, "From": settings.twilio_from_number, "Body": f"Your HANDA password reset code is {otp}."}).encode()
        request = Request(
            f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
            data=body,
            headers={"Authorization": "Basic " + base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()).decode()},
        )
        with urlopen(request, timeout=10):
            pass
        return

    logger.warning("Password reset OTP for %s (%s): %s", mask_destination(destination, channel), channel, otp)


def notify_responder_application_status(email: str, mobile_number: str, responder_type: str, status: str, note: str = "") -> None:
    if status == "Pending":
        message = f"Your HANDA {responder_type.lower()} responder application was received and is pending administrator review."
    elif status == "Active":
        message = "Your HANDA responder application was approved. You can now sign in."
    else:
        message = "Your HANDA responder application was not approved. Contact your local administrator for more information."
    if note.strip():
        message += f" Administrator note: {note.strip()}"

    if settings.smtp_host and settings.smtp_from:
        try:
            email_message = EmailMessage()
            email_message["Subject"] = "HANDA responder application update"
            email_message["From"] = settings.smtp_from
            email_message["To"] = email
            email_message.set_content(message)
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                server.starttls()
                if settings.smtp_username:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(email_message)
        except Exception:
            logger.exception("Responder application email notification could not be delivered.")
    else:
        logger.warning("Responder application email notification not sent because SMTP is not configured.")

    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number:
        try:
            from urllib.parse import urlencode
            from urllib.request import Request, urlopen

            body = urlencode({"To": mobile_number, "From": settings.twilio_from_number, "Body": message}).encode()
            request = Request(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                data=body,
                headers={"Authorization": "Basic " + base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()).decode()},
            )
            with urlopen(request, timeout=10):
                pass
        except Exception:
            logger.exception("Responder application SMS notification could not be delivered.")
    else:
        logger.warning("Responder application SMS notification not sent because Twilio is not configured.")


def deliver_incident_alert(email: str, mobile_number: str, title: str, message: str, email_enabled: bool, sms_enabled: bool) -> None:
    if email_enabled:
        if not settings.smtp_host or not settings.smtp_from:
            logger.warning("Incident email alert skipped because SMTP is not configured.")
        else:
            try:
                email_message = EmailMessage()
                email_message["Subject"] = f"HANDA alert: {title}"
                email_message["From"] = settings.smtp_from
                email_message["To"] = email
                email_message.set_content(message)
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                    server.starttls()
                    if settings.smtp_username:
                        server.login(settings.smtp_username, settings.smtp_password)
                    server.send_message(email_message)
            except Exception:
                logger.exception("Incident email alert could not be delivered.")

    if sms_enabled:
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
            logger.warning("Incident SMS alert skipped because Twilio is not configured.")
        elif not mobile_number:
            logger.warning("Incident SMS alert skipped because the user has no mobile number.")
        else:
            try:
                from urllib.parse import urlencode
                from urllib.request import Request, urlopen

                body = urlencode({"To": mobile_number, "From": settings.twilio_from_number, "Body": f"{title}: {message}"}).encode()
                request = Request(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                    data=body,
                    headers={"Authorization": "Basic " + base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()).decode()},
                )
                with urlopen(request, timeout=10):
                    pass
            except Exception:
                logger.exception("Incident SMS alert could not be delivered.")


MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15


def write_incident(connection: psycopg.Connection, incident: IncidentCreate, reporter_id: str | None = None) -> dict:
    incident_id = normalize_id(incident.id, "incident")
    created_at = timestamp(incident.createdAt)
    connection.execute(
        """
        INSERT INTO incidents
          (id, type, description, severity, location_text, latitude, longitude,
              photo_uris, created_at, reporter_user_id)
          VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          severity = EXCLUDED.severity,
          location_text = EXCLUDED.location_text,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          photo_uris = EXCLUDED.photo_uris,
          reporter_user_id = COALESCE(EXCLUDED.reporter_user_id, incidents.reporter_user_id)
        """,
            (
                incident_id,
                incident.type,
                incident.description,
                "medium" if incident.severity == "moderity" else incident.severity,
                incident.location,
                incident.latitude,
                incident.longitude,
                json.dumps(incident.photoUris),
                created_at,
                reporter_id,
            ),
    )
    return {"id": incident_id, "entityType": "incident", "status": "accepted"}


def write_evacuee(connection: psycopg.Connection, evacuee: EvacueeCreate) -> dict:
    evacuee_id = normalize_id(evacuee.id, "evacuee")
    created_at = timestamp(evacuee.createdAt)
    connection.execute(
        """
        INSERT INTO evacuees
          (id, first_name, middle_name, last_name, age, sex, contact_number,
           address, household_size, barangay, latitude, longitude, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          middle_name = EXCLUDED.middle_name,
          last_name = EXCLUDED.last_name,
          age = EXCLUDED.age,
          sex = EXCLUDED.sex,
          contact_number = EXCLUDED.contact_number,
          address = EXCLUDED.address,
          household_size = EXCLUDED.household_size,
          barangay = EXCLUDED.barangay,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude
        """,
                (
                        evacuee_id,
                        evacuee.firstName,
                        evacuee.middleName,
                        evacuee.lastName,
                        evacuee.age,
                        evacuee.sex,
                        evacuee.contactNumber,
                        evacuee.address,
                        evacuee.householdSize,
                        evacuee.barangay,
                        evacuee.latitude,
                        evacuee.longitude,
                        created_at,
                ),
    )
    return {"id": evacuee_id, "entityType": "evacuee", "status": "accepted"}


def evacuation_center_status(capacity: int, occupancy: int, current_status: str) -> str:
    if current_status == "closed":
        return "closed"
    if occupancy >= capacity:
        return "full"
    if occupancy > 0:
        return "limited"
    return "available"


def ensure_disaster_schema(connection: psycopg.Connection) -> None:
        connection.execute(
                """
                CREATE TABLE IF NOT EXISTS disasters (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
                    status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Active', 'Archived')),
                    affected_areas INTEGER NOT NULL DEFAULT 0 CHECK (affected_areas >= 0),
                    affected_barangays TEXT[] NOT NULL DEFAULT '{}',
                    started_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS disasters_status_idx ON disasters (status)")
        connection.execute("CREATE INDEX IF NOT EXISTS disasters_started_at_idx ON disasters (started_at DESC)")
        connection.execute("ALTER TABLE disasters ADD COLUMN IF NOT EXISTS affected_barangays TEXT[] NOT NULL DEFAULT '{}'")


BINAN_CENTERS_FILE = Path(__file__).parent / "data" / "binan_evacuation_centers.json"
# The source list has no capacities; admins replace this placeholder per center.
DEFAULT_CENTER_CAPACITY = 100
LEGACY_DEMO_CENTER_IDS = [
    "center-poblacion", "center-multipurpose", "center-school-gym", "center-timbao",
    "center-binan-brgy-briones", "center-binan-brgy-caingin", "center-binan-brgy-calaboso",
]


def seed_binan_evacuation_centers(connection: psycopg.Connection) -> None:
    centers = json.loads(BINAN_CENTERS_FILE.read_text(encoding="utf-8"))
    with connection.cursor() as cursor:
        # Capacity, occupancy, status, and existing coordinates are left untouched on re-run so admin edits persist.
        cursor.executemany(
            """
            INSERT INTO evacuation_centers (id, name, location_text, capacity, current_occupancy, status, contact_number, notes, latitude, longitude)
            VALUES (%s, %s, %s, %s, 0, 'available', %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              location_text = EXCLUDED.location_text,
              contact_number = EXCLUDED.contact_number,
              notes = EXCLUDED.notes,
              latitude = COALESCE(evacuation_centers.latitude, EXCLUDED.latitude),
              longitude = COALESCE(evacuation_centers.longitude, EXCLUDED.longitude)
            """,
            [(c["id"], c["name"], c["location"], DEFAULT_CENTER_CAPACITY, c["contactNumber"], c["notes"], c.get("latitude"), c.get("longitude")) for c in centers],
        )
    connection.execute(
        """
        DELETE FROM evacuation_centers
        WHERE id = ANY(%s)
          AND NOT EXISTS (SELECT 1 FROM evacuation_registrations WHERE center_id = evacuation_centers.id)
        """,
        (LEGACY_DEMO_CENTER_IDS,),
    )


def ensure_operational_schema() -> None:
    with psycopg.connect(settings.database_url, connect_timeout=CONNECT_TIMEOUT_SECONDS) as connection:
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reported'")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS action_notes TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_by TEXT")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_people TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_organizations TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_eta_minutes INTEGER")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_notes TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS evacuation_status TEXT NOT NULL DEFAULT 'registered'")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_by TEXT")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE users ALTER COLUMN current_address SET DEFAULT ''")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_type TEXT")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_organization TEXT")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_barangay TEXT")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS responder_verification_documents (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
                file_bytes BYTEA NOT NULL,
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMPTZ,
                decision TEXT CHECK (decision IS NULL OR decision IN ('approved', 'rejected')),
                review_note TEXT NOT NULL DEFAULT ''
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                read_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        connection.execute("CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC)")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS application_logs (
              id BIGSERIAL PRIMARY KEY,
              category TEXT NOT NULL CHECK (category IN ('sync', 'audit')),
              actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT,
              details TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'success',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS application_logs_category_created_idx ON application_logs (category, created_at DESC)")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS resident_household_members (
              id TEXT PRIMARY KEY,
              resident_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              relationship TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS resident_household_members_user_idx ON resident_household_members (resident_user_id)")
        connection.execute(
                        """
                        CREATE TABLE IF NOT EXISTS password_reset_requests (
                            token TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
                            otp_hash TEXT NOT NULL,
                            expires_at TIMESTAMPTZ NOT NULL,
                            attempts INTEGER NOT NULL DEFAULT 0,
                            verified_at TIMESTAMPTZ,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                        """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS password_reset_requests_user_idx ON password_reset_requests (user_id, created_at DESC)")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evacuation_centers (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              location_text TEXT NOT NULL DEFAULT '',
              capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
              current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
              status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'full', 'closed')),
              latitude DOUBLE PRECISION,
              longitude DOUBLE PRECISION,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS evacuation_centers_status_idx ON evacuation_centers (status)")
        connection.execute("ALTER TABLE evacuation_centers ADD COLUMN IF NOT EXISTS coordinator_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_centers ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_centers ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''")
        ensure_disaster_schema(connection)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evacuation_registrations (
              id TEXT PRIMARY KEY,
              resident_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              center_id TEXT NOT NULL REFERENCES evacuation_centers(id) ON DELETE RESTRICT,
              first_name TEXT NOT NULL DEFAULT '',
              middle_name TEXT,
              last_name TEXT NOT NULL DEFAULT '',
              age INTEGER NOT NULL DEFAULT 0,
              sex TEXT NOT NULL DEFAULT '',
              contact_number TEXT NOT NULL DEFAULT '',
              address TEXT NOT NULL DEFAULT '',
              household_size INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'evacuated', 'released')),
              registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              checked_in_at TIMESTAMPTZ,
              checked_in_by TEXT REFERENCES users(id) ON DELETE SET NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS middle_name TEXT")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS age INTEGER NOT NULL DEFAULT 0")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS household_size INTEGER NOT NULL DEFAULT 1")
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS evacuation_registrations_one_active_per_resident_idx
            ON evacuation_registrations (resident_user_id) WHERE status <> 'released'
            """,
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS evacuation_registrations_center_status_idx
            ON evacuation_registrations (center_id, status)
            """,
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evacuation_household_members (
              id TEXT PRIMARY KEY,
              registration_id TEXT NOT NULL REFERENCES evacuation_registrations(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              relationship TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'evacuated', 'released')),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS evacuation_household_members_registration_idx
            ON evacuation_household_members (registration_id)
            """,
        )
        seed_binan_evacuation_centers(connection)
        connection.commit()


def ensure_default_users() -> None:
    with psycopg.connect(settings.database_url, connect_timeout=CONNECT_TIMEOUT_SECONDS) as connection:
        connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Active')
            ON CONFLICT (email) DO NOTHING
            """,
            ('admin-001', 'HANDA Administrator', 'admin@handa.local', '1990-01-01', '+639171234567', 'HANDA Development Environment', hash_password('admin123'), 'Administrator'),
        )
        connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Active')
            ON CONFLICT (email) DO NOTHING
            """,
            ('responder-001', 'Juan Dela Cruz', 'responder@handa.local', '1990-01-01', '+639171234568', 'HANDA Development Environment', hash_password('responder123'), 'Responder'),
        )
        connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Active')
            ON CONFLICT (email) DO NOTHING
            """,
            ('resident-001', 'Maria Santos', 'resident@handa.local', '1990-01-01', '+639171234569', 'HANDA Development Environment', hash_password('resident123'), 'Resident'),
        )
        connection.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        ensure_operational_schema()
        ensure_default_users()
    except psycopg.OperationalError as error:
        logger.warning(
            "Database unavailable during startup; starting API in degraded mode error_type=%s sqlstate=%s",
            type(error).__name__, getattr(error, "sqlstate", None),
        )
    yield


app = FastAPI(title="HANDA API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def database_readiness(connection: psycopg.Connection = Depends(get_connection)):
    connection.execute("SELECT 1")
    return {"status": "ready", "database": "ok"}


@app.post("/api/v1/incidents", status_code=201)
def create_incident(incident: IncidentCreate, connection: psycopg.Connection = Depends(get_connection), user: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    result = write_incident(connection, incident, user.id if user.role == "resident" else None)
    connection.commit()
    return result


@app.post("/api/v1/evacuees", status_code=201)
def create_evacuee(evacuee: EvacueeCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    return write_evacuee(connection, evacuee)


@app.post("/api/v1/sync", status_code=207)
def sync_batch(batch: SyncBatch, connection: psycopg.Connection = Depends(get_connection), user: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    results = []
    for event in batch.events:
        try:
            with connection.transaction():
                if event.entityType == "incident":
                    result = write_incident(connection, IncidentCreate.model_validate(event.payload), user.id if user.role == "resident" else None)
                else:
                    result = write_evacuee(connection, EvacueeCreate.model_validate(event.payload))
                write_log(connection, "sync", "upload", user.id, event.entityType, result["id"], f"Synchronized {event.entityType} from the user device.")
            results.append(result)
        except (ValueError, psycopg.Error) as error:
            write_log(connection, "sync", "rejected", user.id, event.entityType, event.payload.get("id"), str(error), "failed")
            results.append({"status": "rejected", "entityType": event.entityType, "error": str(error)})
    return {"processed": len(results), "results": results}


@app.get("/api/v1/logs/{category}")
def list_logs(category: str, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    if category not in ("sync", "audit"):
        raise HTTPException(status_code=404, detail="Log category not found.")
    return connection.execute(
        "SELECT logs.id, logs.action, logs.entity_type, logs.entity_id, logs.details, logs.status, logs.created_at, COALESCE(actor.name, 'System') AS actor_name FROM application_logs AS logs LEFT JOIN users AS actor ON actor.id = logs.actor_id WHERE logs.category = %s ORDER BY logs.created_at DESC LIMIT 200",
        (category,),
    ).fetchall()


@app.get("/api/v1/incidents")
def list_incidents(connection: psycopg.Connection = Depends(get_connection)):
    rows = connection.execute(
        "SELECT id, type, description, severity, location_text AS location, latitude, longitude, photo_uris, status, action_notes, response_people, response_organizations, response_eta_minutes, response_notes, verified_by, verified_at, created_at FROM incidents ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.get("/api/v1/incidents/reporters")
def list_incident_reporters(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("responder", "admin"))):
    # Contact details are personal data, so they stay out of the public incident list.
    return connection.execute(
        """
        SELECT incidents.id AS incident_id, users.name, users.mobile_number
        FROM incidents
        JOIN users ON users.id = incidents.reporter_user_id
        WHERE incidents.status <> 'resolved'
        """
    ).fetchall()


def responder_organization_label(organization: str | None, barangay: str | None) -> str:
    if not organization:
        return ""
    if organization == "Barangay Responder" and barangay:
        return f"Barangay Responder (Brgy. {barangay})"
    return organization


def resolve_response_details(connection: psycopg.Connection, user: CurrentUser, update: IncidentStatusUpdate) -> IncidentStatusUpdate:
    """Fill people and organizations from the acknowledging responder only when the client omitted them."""
    people, organizations = update.responsePeople, update.responseOrganizations
    if update.status == "acknowledged" and user.role == "responder" and (people is None or organizations is None):
        profile = connection.execute(
            "SELECT name, responder_organization, responder_barangay FROM users WHERE id = %s",
            (user.id,),
        ).fetchone() or {}
        if people is None:
            people = profile.get("name") or user.name
        if organizations is None:
            organizations = responder_organization_label(profile.get("responder_organization"), profile.get("responder_barangay"))
    return update.model_copy(update={
        "responsePeople": None if people is None else people.strip(),
        "responseOrganizations": None if organizations is None else organizations.strip(),
    })


def incident_notification_message(status: str, update: IncidentStatusUpdate, incident_type: str = "incident") -> tuple[str, str]:
    status_label = status.replace('_', ' ').upper()
    report = f"{incident_type.strip() or 'incident'} report"
    title = "Incident update"
    message = f"Your {report} is now {status_label}."
    if status == "acknowledged":
        title = "Help is on the way"
        message = f"Responders acknowledged your {report} and are on the way. Please stay safe and stay where responders can find you. Status: {status_label}."
    elif status == "in_progress":
        title = "Response in progress"
        message = f"Responders are now responding to your {report}. Please stay safe and follow their instructions. Status: {status_label}."
    elif status == "resolved":
        title = "Incident response completed"
        message = f"Responders marked your {report} as resolved. Stay safe, and report again if you need help. Status: {status_label}."
    details = []
    if (update.responsePeople or "").strip(): details.append(f"People: {update.responsePeople.strip()}")
    if (update.responseOrganizations or "").strip(): details.append(f"Organizations: {update.responseOrganizations.strip()}")
    if update.responseEtaMinutes is not None: details.append(f"ETA: {update.responseEtaMinutes} minutes")
    if (update.responseNotes or "").strip(): details.append(update.responseNotes.strip())
    if details: message += " " + " | ".join(details)
    return title, message


@app.patch("/api/v1/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, update: IncidentStatusUpdate, connection: psycopg.Connection = Depends(get_connection), user: CurrentUser = Depends(require_roles("responder", "admin"))):
    update = resolve_response_details(connection, user, update)
    clean = lambda value: None if value is None else value.strip()
    row = connection.execute(
        """
        UPDATE incidents
        SET status = %s,
            action_notes = COALESCE(%s, action_notes),
            response_people = COALESCE(%s, response_people),
            response_organizations = COALESCE(%s, response_organizations),
            response_eta_minutes = COALESCE(%s, response_eta_minutes),
            response_notes = COALESCE(%s, response_notes),
            verified_by = %s, verified_at = NOW()
        WHERE id = %s
        RETURNING id, status, action_notes, response_people,
                  response_organizations, response_eta_minutes,
                  response_notes, verified_by, verified_at
        """,
        (update.status, clean(update.actionNotes), clean(update.responsePeople), clean(update.responseOrganizations), update.responseEtaMinutes, clean(update.responseNotes), user.id, incident_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    saved = update.model_copy(update={
        "responsePeople": row["response_people"],
        "responseOrganizations": row["response_organizations"],
        "responseEtaMinutes": row["response_eta_minutes"],
        "responseNotes": row["response_notes"],
    })
    reporter = connection.execute(
        """
        SELECT users.id, users.email, users.mobile_number,
               users.email_alerts_enabled, users.sms_alerts_enabled,
               incidents.type AS incident_type
        FROM incidents
        JOIN users ON users.id = incidents.reporter_user_id
        WHERE incidents.id = %s
        """,
        (incident_id,),
    ).fetchone()
    if reporter:
        title, message = incident_notification_message(update.status, saved, reporter["incident_type"])
        connection.execute(
            "INSERT INTO notifications (id, user_id, incident_id, title, message) VALUES (%s, %s, %s, %s, %s)",
            (f"notification-{uuid4()}", reporter["id"], incident_id, title, message),
        )
    connection.commit()
    if reporter:
        deliver_incident_alert(
            reporter["email"],
            reporter["mobile_number"],
            title,
            message,
            reporter["email_alerts_enabled"],
            reporter["sms_alerts_enabled"],
        )
    return row


@app.get("/api/v1/notifications")
def list_notifications(connection: psycopg.Connection = Depends(get_connection), resident: CurrentUser = Depends(require_roles("resident"))):
    return connection.execute(
        "SELECT id, incident_id, title, message, read_at, created_at FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT 100",
        (resident.id,),
    ).fetchall()


def notification_preferences_payload(row: dict) -> dict:
    email_configured = bool(settings.smtp_host and settings.smtp_from)
    sms_configured = bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number)
    return {
        "emailEnabled": row["email_alerts_enabled"],
        "smsEnabled": row["sms_alerts_enabled"],
        "emailConfigured": email_configured,
        "smsConfigured": sms_configured,
        "emailAvailable": email_configured and bool(row["email"]),
        "smsAvailable": sms_configured and bool(row["mobile_number"]),
        "emailAddress": row["email"],
        "mobileNumber": row["mobile_number"] or "",
    }


@app.get("/api/v1/notifications/preferences")
def get_notification_preferences(user: CurrentUser = Depends(get_current_user), connection: psycopg.Connection = Depends(get_connection)):
    row = connection.execute(
        "SELECT email, mobile_number, email_alerts_enabled, sms_alerts_enabled FROM users WHERE id = %s",
        (user.id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User account not found.")
    return notification_preferences_payload(row)


@app.patch("/api/v1/notifications/preferences")
def update_notification_preferences(
    update: NotificationPreferencesUpdate,
    user: CurrentUser = Depends(get_current_user),
    connection: psycopg.Connection = Depends(get_connection),
):
    if update.emailEnabled is None and update.smsEnabled is None:
        raise HTTPException(status_code=400, detail="Choose at least one notification preference to update.")
    try:
        row = connection.execute(
            """
            UPDATE users
            SET email_alerts_enabled = COALESCE(%s, email_alerts_enabled),
                sms_alerts_enabled = COALESCE(%s, sms_alerts_enabled),
                updated_at = NOW()
            WHERE id = %s
            RETURNING email, mobile_number, email_alerts_enabled, sms_alerts_enabled
            """,
            (update.emailEnabled, update.smsEnabled, user.id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User account not found.")
        connection.commit()
    except psycopg.Error:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Notification preferences could not be saved.") from None
    return notification_preferences_payload(row)


@app.patch("/api/v1/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, connection: psycopg.Connection = Depends(get_connection), resident: CurrentUser = Depends(require_roles("resident"))):
    row = connection.execute(
        "UPDATE notifications SET read_at = NOW() WHERE id = %s AND user_id = %s RETURNING id, read_at",
        (notification_id, resident.id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found.")
    connection.commit()
    return row


@app.get("/api/v1/evacuees")
def list_evacuees(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    rows = connection.execute(
        "SELECT id, first_name, middle_name, last_name, age, sex, contact_number, address, household_size, barangay, latitude, longitude, evacuation_status, verified_by, verified_at, created_at FROM evacuees ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.patch("/api/v1/evacuees/{evacuee_id}/status")
def update_evacuee_status(evacuee_id: str, update: EvacueeStatusUpdate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("responder", "admin"))):
    row = connection.execute(
        """
        UPDATE evacuees
        SET evacuation_status = %s, verified_at = NOW()
        WHERE id = %s
        RETURNING id, evacuation_status, verified_at
        """,
        (update.evacuationStatus, evacuee_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evacuee not found.")
    connection.commit()
    return row


@app.get("/api/v1/centers")
def list_centers(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    rows = connection.execute(
        "SELECT id, name, location_text AS location, capacity, current_occupancy, status, coordinator_name, contact_number, notes, latitude, longitude, updated_at FROM evacuation_centers ORDER BY name"
    ).fetchall()
    return [
        {
            **row,
            "status": evacuation_center_status(row["capacity"], row["current_occupancy"], row["status"]),
        }
        for row in rows
    ]


@app.post("/api/v1/centers", status_code=201)
def create_center(center: CenterCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    center_id = f"center-{uuid4()}"
    status = evacuation_center_status(center.capacity, center.currentOccupancy, center.status)
    row = connection.execute(
        """
        INSERT INTO evacuation_centers
                    (id, name, location_text, capacity, current_occupancy, status, coordinator_name, contact_number, notes, latitude, longitude)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, location_text AS location, capacity, current_occupancy, status, coordinator_name, contact_number, notes, latitude, longitude, updated_at
        """,
        (
            center_id,
            center.name.strip(),
            center.location.strip(),
            center.capacity,
            center.currentOccupancy,
            status,
            center.coordinatorName.strip(),
            center.contactNumber.strip(),
            center.notes.strip(),
            center.latitude,
            center.longitude,
        ),
    ).fetchone()
    connection.commit()
    return row


@app.patch("/api/v1/centers/{center_id}")
def update_center_capacity(
    center_id: str,
    update: CenterCapacityUpdate,
    connection: psycopg.Connection = Depends(get_connection),
    _: CurrentUser = Depends(require_roles("admin")),
):
    row = connection.execute(
        """
        UPDATE evacuation_centers
        SET capacity = %s,
            status = CASE
              WHEN status = 'closed' THEN status
              WHEN current_occupancy >= %s THEN 'full'
                            WHEN current_occupancy > 0 THEN 'limited'
                            ELSE 'available'
            END,
            updated_at = NOW()
        WHERE id = %s
        RETURNING id, name, location_text AS location, capacity, current_occupancy, status, coordinator_name, contact_number, notes, latitude, longitude, updated_at
        """,
        (update.capacity, update.capacity, center_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evacuation center not found.")
    connection.commit()
    return row


def resident_evacuation_status(connection: psycopg.Connection, resident: CurrentUser) -> dict:
    registration = connection.execute(
        """
        SELECT registration.id, registration.status, registration.registered_at,
             registration.checked_in_at, registration.first_name,
             registration.middle_name, registration.last_name, registration.age,
             registration.sex, registration.contact_number, registration.address,
             registration.household_size, verifier.name AS checked_in_by,
               center.id AS center_id, center.name AS center_name,
               center.location_text AS center_location
        FROM evacuation_registrations AS registration
        JOIN evacuation_centers AS center ON center.id = registration.center_id
        LEFT JOIN users AS verifier ON verifier.id = registration.checked_in_by
        WHERE registration.resident_user_id = %s
        ORDER BY registration.registered_at DESC
        LIMIT 1
        """,
        (resident.id,),
    ).fetchone()
    if not registration:
        saved_members = connection.execute(
            "SELECT COUNT(*) AS member_count FROM resident_household_members WHERE resident_user_id = %s",
            (resident.id,),
        ).fetchone()
        return {
            "resident": {"id": resident.id, "name": resident.name, "status": "not_registered"},
            "registrationId": None,
            "status": "not_registered",
            "center": None,
            "registeredAt": None,
            "checkedInAt": None,
            "checkedInBy": None,
            "householdCount": int(saved_members["member_count"]) + 1,
            "evacuee": None,
            "members": [],
        }

    members = connection.execute(
        "SELECT id, name, relationship, status, updated_at FROM evacuation_household_members WHERE registration_id = %s ORDER BY name",
        (registration["id"],),
    ).fetchall()
    household_count = max(int(registration["household_size"] or 0), len(members) + 1, 1)
    return {
        "resident": {"id": resident.id, "name": resident.name, "status": registration["status"]},
        "registrationId": registration["id"],
        "status": registration["status"],
        "center": {
            "id": registration["center_id"],
            "name": registration["center_name"],
            "location": registration["center_location"],
        },
        "registeredAt": registration["registered_at"],
        "checkedInAt": registration["checked_in_at"],
        "checkedInBy": registration["checked_in_by"],
        "householdCount": household_count,
        "evacuee": {
            "name": " ".join(part for part in (registration["first_name"], registration["middle_name"], registration["last_name"]) if part),
            "age": registration["age"],
            "sex": registration["sex"],
            "contactNumber": registration["contact_number"],
            "address": registration["address"],
        },
        "members": members,
    }


@app.get("/api/v1/resident/evacuation-status")
def get_resident_evacuation_status(
    resident: CurrentUser = Depends(require_roles("resident")),
    connection: psycopg.Connection = Depends(get_connection),
):
    return resident_evacuation_status(connection, resident)


@app.post("/api/v1/resident/evacuation-registrations", status_code=201)
def register_resident_at_center(
    registration: EvacuationRegistrationCreate,
    resident: CurrentUser = Depends(require_roles("resident")),
    connection: psycopg.Connection = Depends(get_connection),
):
    if len(registration.members) != registration.householdSize - 1:
        raise HTTPException(status_code=422, detail="Add a name and relationship for every household member besides the evacuee.")

    center = connection.execute(
        "SELECT id, capacity, current_occupancy, status FROM evacuation_centers WHERE id = %s",
        (registration.centerId,),
    ).fetchone()
    if not center:
        raise HTTPException(status_code=404, detail="Evacuation center not found.")
    if evacuation_center_status(center["capacity"], center["current_occupancy"], center["status"]) in ("closed", "full"):
        raise HTTPException(status_code=409, detail="This evacuation center is not accepting registrations.")

    existing = connection.execute(
        "SELECT id FROM evacuation_registrations WHERE resident_user_id = %s AND status <> 'released' LIMIT 1",
        (resident.id,),
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Your household already has an active evacuation registration.")

    registration_id = f"evac-registration-{uuid4()}"
    try:
        connection.execute(
            "INSERT INTO evacuation_registrations (id, resident_user_id, center_id, first_name, middle_name, last_name, age, sex, contact_number, address, household_size) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (registration_id, resident.id, registration.centerId, registration.firstName.strip(), (registration.middleName or "").strip() or None, registration.lastName.strip(), registration.age, registration.sex, registration.contactNumber, registration.address.strip(), registration.householdSize),
        )
        for member in registration.members:
            connection.execute(
                "INSERT INTO evacuation_household_members (id, registration_id, name, relationship) VALUES (%s, %s, %s, %s)",
                (f"household-member-{uuid4()}", registration_id, member.name.strip(), member.relationship.strip()),
            )
        connection.execute("DELETE FROM resident_household_members WHERE resident_user_id = %s", (resident.id,))
        for member in registration.members:
            connection.execute(
                "INSERT INTO resident_household_members (id, resident_user_id, name, relationship) VALUES (%s, %s, %s, %s)",
                (f"resident-household-{uuid4()}", resident.id, member.name.strip(), member.relationship.strip()),
            )
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="Your household already has an active evacuation registration.") from error

    return resident_evacuation_status(connection, resident)


@app.get("/api/v1/evacuation-registrations")
def list_evacuation_registrations(
    include_released: bool = False,
    connection: psycopg.Connection = Depends(get_connection),
    _: CurrentUser = Depends(require_roles("responder", "admin")),
):
    status_filter = "" if include_released else "WHERE registration.status <> 'released'"
    registrations = connection.execute(
        f"""
        SELECT registration.id, registration.status, registration.registered_at,
             registration.checked_in_at, registration.first_name,
             registration.middle_name, registration.last_name, registration.age,
             registration.sex, registration.contact_number, registration.address,
             registration.household_size, resident.name AS resident_name,
               center.name AS center_name, center.location_text AS center_location
        FROM evacuation_registrations AS registration
        JOIN users AS resident ON resident.id = registration.resident_user_id
        JOIN evacuation_centers AS center ON center.id = registration.center_id
        {status_filter}
        ORDER BY CASE WHEN registration.status = 'registered' THEN 0 ELSE 1 END,
                 registration.registered_at DESC
        """,
    ).fetchall()
    result = []
    for registration in registrations:
        item = dict(registration)
        item["members"] = connection.execute(
            "SELECT id, name, relationship, status, updated_at FROM evacuation_household_members WHERE registration_id = %s ORDER BY name",
            (registration["id"],),
        ).fetchall()
        result.append(item)
    return result


@app.patch("/api/v1/evacuation-registrations/{registration_id}/status")
def update_evacuation_registration_status(
    registration_id: str,
    update: EvacuationRegistrationStatusUpdate,
    user: CurrentUser = Depends(require_roles("responder", "admin")),
    connection: psycopg.Connection = Depends(get_connection),
):
    registration = connection.execute(
        "SELECT id, center_id, status, household_size FROM evacuation_registrations WHERE id = %s FOR UPDATE",
        (registration_id,),
    ).fetchone()
    if not registration:
        raise HTTPException(status_code=404, detail="Evacuation registration not found.")

    current_status = registration["status"]
    allowed_transitions = {
        "registered": {"checked_in", "released"},
        "checked_in": {"evacuated", "released"},
        "evacuated": {"released"},
        "released": set(),
    }
    if update.status not in allowed_transitions[current_status]:
        raise HTTPException(status_code=409, detail=f"Cannot change status from {current_status} to {update.status}.")

    household_count = registration["household_size"]

    if update.status == "checked_in":
        center = connection.execute(
            "SELECT capacity, current_occupancy, status FROM evacuation_centers WHERE id = %s FOR UPDATE",
            (registration["center_id"],),
        ).fetchone()
        center_status = evacuation_center_status(center["capacity"], center["current_occupancy"], center["status"])
        if center_status == "closed" or center["current_occupancy"] + household_count > center["capacity"]:
            raise HTTPException(status_code=409, detail="The evacuation center does not have enough available capacity for this household.")
        connection.execute(
            "UPDATE evacuation_centers SET current_occupancy = current_occupancy + %s, status = CASE WHEN current_occupancy + %s >= capacity THEN 'full' ELSE 'limited' END, updated_at = NOW() WHERE id = %s",
            (household_count, household_count, registration["center_id"]),
        )
    elif update.status == "released" and current_status in ("checked_in", "evacuated"):
        connection.execute(
            "UPDATE evacuation_centers SET current_occupancy = GREATEST(0, current_occupancy - %s), status = CASE WHEN status = 'closed' THEN 'closed' WHEN GREATEST(0, current_occupancy - %s) >= capacity THEN 'full' WHEN GREATEST(0, current_occupancy - %s) > 0 THEN 'limited' ELSE 'available' END, updated_at = NOW() WHERE id = %s",
            (household_count, household_count, household_count, registration["center_id"]),
        )

    connection.execute(
        "UPDATE evacuation_registrations SET status = %s, checked_in_at = CASE WHEN %s = 'checked_in' THEN NOW() ELSE checked_in_at END, checked_in_by = CASE WHEN %s = 'checked_in' THEN %s ELSE checked_in_by END, updated_at = NOW() WHERE id = %s",
        (update.status, update.status, update.status, user.id, registration_id),
    )
    connection.execute(
        "UPDATE evacuation_household_members SET status = %s, updated_at = NOW() WHERE registration_id = %s",
        (update.status, registration_id),
    )
    connection.commit()
    return {"id": registration_id, "status": update.status}


@app.get("/api/v1/users")
def list_users(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    rows = connection.execute(
        "SELECT users.id, users.name, users.email, users.birthday, users.mobile_number, users.current_address, users.role, users.status, users.responder_type, users.responder_organization, users.responder_barangay, EXISTS (SELECT 1 FROM responder_verification_documents AS document WHERE document.user_id = users.id) AS has_verification_document, users.created_at, users.updated_at FROM users ORDER BY users.created_at DESC"
    ).fetchall()
    return rows


@app.get("/api/v1/users/{user_id}/verification-document")
def get_responder_verification_document(user_id: str, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    row = connection.execute(
        "SELECT document.file_name, document.mime_type, document.file_bytes, users.responder_type FROM responder_verification_documents AS document JOIN users ON users.id = document.user_id WHERE document.user_id = %s",
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Responder verification document not found.")
    return {
        "fileName": row["file_name"],
        "mimeType": row["mime_type"],
        "base64": base64.b64encode(bytes(row["file_bytes"])).decode("ascii"),
        "responderType": row["responder_type"],
    }


@app.patch("/api/v1/users/{user_id}/responder-application")
def review_responder_application(
    user_id: str,
    review: ResponderApplicationReview,
    admin: CurrentUser = Depends(require_roles("admin")),
    connection: psycopg.Connection = Depends(get_connection),
):
    applicant = connection.execute(
        "SELECT users.id, users.name, users.email, users.mobile_number, users.role, users.status, users.responder_type FROM users JOIN responder_verification_documents AS document ON document.user_id = users.id WHERE users.id = %s FOR UPDATE OF users",
        (user_id,),
    ).fetchone()
    if not applicant or applicant["role"] != "Responder":
        raise HTTPException(status_code=404, detail="Responder application not found.")
    if applicant["status"] != "Pending":
        raise HTTPException(status_code=409, detail="This responder application has already been reviewed.")

    new_status = "Active" if review.decision == "approved" else "Inactive"
    connection.execute(
        "UPDATE users SET status = %s, token_version = token_version + 1, updated_at = NOW() WHERE id = %s",
        (new_status, user_id),
    )
    connection.execute(
        "UPDATE responder_verification_documents SET decision = %s, reviewed_by = %s, reviewed_at = NOW(), review_note = %s WHERE user_id = %s",
        (review.decision, admin.id, review.note.strip(), user_id),
    )
    write_log(connection, "audit", review.decision, admin.id, "responder_application", user_id, f"{review.decision.title()} {applicant['responder_type']} responder application.")
    connection.commit()
    notify_responder_application_status(applicant["email"], applicant["mobile_number"], applicant["responder_type"], new_status, review.note)
    return {"id": user_id, "status": new_status, "decision": review.decision}


def validate_account_password(password: str) -> None:
    if not any(char.isupper() for char in password) or not any(char.islower() for char in password) or not any(char.isdigit() for char in password) or not any(not char.isalnum() for char in password):
        raise HTTPException(status_code=422, detail="Password must include uppercase, lowercase, number, and symbol.")


@app.post("/api/v1/users", status_code=201)
def create_user(account: AdminUserCreate, connection: psycopg.Connection = Depends(get_connection), user: CurrentUser = Depends(require_roles("admin"))):
    validate_account_password(account.password)
    user_id = f"user-{uuid4()}"
    try:
        row = connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, email, birthday, mobile_number, current_address, role, status, created_at, updated_at
            """,
                        (
                                user_id,
                                account.name.strip(),
                                account.email.strip().lower(),
                                account.birthday,
                                account.mobileNumber,
                                account.currentAddress.strip(),
                                hash_password(account.password),
                                account.role,
                                account.status,
                        ),
        ).fetchone()
        write_log(connection, "audit", "create", user.id, "user", user_id, f"Created {account.role.lower()} account {account.email.strip().lower()}.")
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return row


@app.patch("/api/v1/users/{user_id}")
def update_user(user_id: str, update: AdminUserUpdate, user: CurrentUser = Depends(require_roles("admin")), connection: psycopg.Connection = Depends(get_connection)):
    changes = {field: value for field, value in update.model_dump(exclude_unset=True).items() if value is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one account field to update.")
    if user_id == user.id and any(field in changes for field in ("password", "role", "status")):
        raise HTTPException(status_code=400, detail="You cannot change your own password, role, or status here.")

    password = changes.pop("password", None)
    if password:
        validate_account_password(password)
        changes["password_hash"] = hash_password(password)

    column_names = {
        "name": "name",
        "email": "email",
        "birthday": "birthday",
        "mobileNumber": "mobile_number",
        "currentAddress": "current_address",
        "role": "role",
        "status": "status",
        "password_hash": "password_hash",
    }
    assignments = [f"{column_names[field]} = %s" for field in changes]
    values = [value.strip().lower() if field == "email" else value.strip() if field in ("name", "currentAddress") else value for field, value in changes.items()]
    if any(field in changes for field in ("password_hash", "role", "status")):
        assignments.append("token_version = token_version + 1")
    assignments.append("updated_at = NOW()")

    try:
        row = connection.execute(
            f"UPDATE users SET {', '.join(assignments)} WHERE id = %s RETURNING id, name, email, birthday, mobile_number, current_address, role, status, created_at, updated_at",
            (*values, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User account not found.")
        write_log(connection, "audit", "update", user.id, "user", user_id, f"Updated account fields: {', '.join(changes.keys())}.")
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return row


@app.delete("/api/v1/users/{user_id}", status_code=204)
def delete_user(user_id: str, user: CurrentUser = Depends(require_roles("admin")), connection: psycopg.Connection = Depends(get_connection)):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own administrator account.")
    cursor = connection.execute("DELETE FROM users WHERE id = %s", (user_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="User account not found.")
    write_log(connection, "audit", "delete", user.id, "user", user_id, "Deleted a user account.")
    connection.commit()


def household_members_for_user(connection: psycopg.Connection, user_id: str) -> list[dict]:
    return connection.execute(
        "SELECT id, name, relationship FROM resident_household_members WHERE resident_user_id = %s ORDER BY created_at, id",
        (user_id,),
    ).fetchall()


def resident_profile_payload(row: dict, members: list[dict] | None = None) -> dict:
    name_parts = row["name"].split()
    middle_name = row.get("middle_name") or ""
    first_name = row.get("first_name") or (name_parts[0] if name_parts else "")
    last_name = row.get("last_name") or " ".join(part for part in name_parts[1:] if part != middle_name)
    birthday = row.get("birthday")
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": normalize_role(row["role"]),
        "firstName": first_name,
        "middleName": middle_name,
        "lastName": last_name,
        "birthday": birthday.isoformat() if birthday else "",
        "sex": row.get("sex") or "",
        "mobileNumber": row.get("mobile_number") or "",
        "currentAddress": row.get("current_address") or "",
        "householdMembers": members if members is not None else [],
        "responderType": row.get("responder_type"),
        "responderOrganization": row.get("responder_organization"),
        "responderBarangay": row.get("responder_barangay"),
    }


@app.post("/api/v1/users/register", status_code=201)
def register_user(registration: UserRegistration, connection: psycopg.Connection = Depends(get_connection)):
    if not any((char.isupper() for char in registration.password)) or not any((char.islower() for char in registration.password)) or not any((char.isdigit() for char in registration.password)) or not any((not char.isalnum() for char in registration.password)):
        raise HTTPException(status_code=422, detail="Password must include uppercase, lowercase, number, and symbol.")

    document_bytes = None
    if registration.role == "Responder":
        if not registration.responderType or not registration.verificationDocumentBase64 or not registration.verificationDocumentMimeType or not registration.verificationDocumentName:
            raise HTTPException(status_code=422, detail="Choose Official or Volunteer and upload a responder ID.")
        try:
            document_bytes = base64.b64decode(registration.verificationDocumentBase64, validate=True)
        except ValueError as error:
            raise HTTPException(status_code=422, detail="The uploaded responder ID is invalid.") from error
        if not document_bytes or len(document_bytes) > 4 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Responder ID images must be 4 MB or smaller.")
        signatures = {
            "image/jpeg": document_bytes.startswith(b"\xff\xd8\xff"),
            "image/png": document_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": document_bytes.startswith(b"RIFF") and document_bytes[8:12] == b"WEBP",
        }
        if not signatures.get(registration.verificationDocumentMimeType, False):
            raise HTTPException(status_code=422, detail="Upload a valid JPEG, PNG, or WebP responder ID image.")

    user_id = f"user-{uuid4()}"
    is_responder = registration.role == "Responder"
    account_status = "Pending" if is_responder else "Active"
    try:
        connection.execute(
            """
            INSERT INTO users
              (id, name, first_name, middle_name, last_name, email, birthday, mobile_number,
               current_address, sex, password_hash, role, status, responder_type,
               responder_organization, responder_barangay)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                " ".join(part for part in (registration.firstName.strip(), (registration.middleName or "").strip(), registration.lastName.strip()) if part),
                registration.firstName.strip(),
                (registration.middleName or "").strip() or None,
                registration.lastName.strip(),
                registration.email.strip().lower(),
                registration.birthday,
                registration.mobileNumber,
                registration.currentAddress.strip(),
                registration.sex,
                hash_password(registration.password),
                registration.role,
                account_status,
                registration.responderType if is_responder else None,
                registration.responderOrganization if is_responder else None,
                registration.responderBarangay if is_responder else None,
            ),
        )
        if is_responder:
            connection.execute(
                "INSERT INTO responder_verification_documents (user_id, file_name, mime_type, file_bytes) VALUES (%s, %s, %s, %s)",
                (user_id, registration.verificationDocumentName, registration.verificationDocumentMimeType, document_bytes),
            )
        else:
            for member in registration.members:
                connection.execute(
                    "INSERT INTO resident_household_members (id, resident_user_id, name, relationship) VALUES (%s, %s, %s, %s)",
                    (f"resident-household-{uuid4()}", user_id, member.name.strip(), member.relationship.strip()),
                )
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error

    row = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role, status, responder_type, responder_organization, responder_barangay FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
    if is_responder:
        notify_responder_application_status(row["email"], row["mobile_number"], row["responder_type"], "Pending")
        return {
            "id": user_id,
            "status": "pending",
            "message": "Your responder application was submitted for administrator approval. We will notify you by email and SMS when its status changes.",
            "user": resident_profile_payload(row, []),
        }

    access_token, expires_in = create_access_token(user_id, "resident", 0)
    return {
        "id": user_id,
        "status": "active",
        "message": "Registration completed.",
        "accessToken": access_token,
        "expiresIn": expires_in,
        "user": resident_profile_payload(row, household_members_for_user(connection, user_id)),
    }


@app.post("/api/v1/auth/password-reset/request")
def request_password_reset(request: PasswordResetRequest, connection: psycopg.Connection = Depends(get_connection)):
    identifier = request.identifier.strip().lower() if request.channel == "email" else request.identifier.strip()
    column = "email" if request.channel == "email" else "mobile_number"
    user = connection.execute(
        f"SELECT id, email, mobile_number FROM users WHERE LOWER({column}) = LOWER(%s) AND status = 'Active'",
        (identifier,),
    ).fetchone()
    response = {"message": "If the account exists, a one-time code has been sent to the selected contact."}
    if not user:
        return response

    otp = f"{secrets.randbelow(1_000_000):06d}"
    reset_token = secrets.token_urlsafe(32)
    connection.execute("DELETE FROM password_reset_requests WHERE user_id = %s", (user["id"],))
    connection.execute(
        "INSERT INTO password_reset_requests (token, user_id, channel, otp_hash, expires_at) VALUES (%s, %s, %s, %s, NOW() + (%s * INTERVAL '1 minute'))",
        (reset_token, user["id"], request.channel, hash_reset_otp(otp), settings.password_reset_expiry_minutes),
    )
    connection.commit()
    destination = user["email"] if request.channel == "email" else user["mobile_number"]
    deliver_password_reset_otp(destination, request.channel, otp)
    response["resetToken"] = reset_token
    response["destination"] = mask_destination(destination, request.channel)
    return response


def verify_reset_request(reset_token: str, otp: str, connection: psycopg.Connection) -> dict:
    row = connection.execute(
        "SELECT token, user_id, otp_hash, expires_at, attempts, verified_at FROM password_reset_requests WHERE token = %s",
        (reset_token,),
    ).fetchone()
    if not row or row["expires_at"] <= datetime.now(UTC) or row["attempts"] >= settings.password_reset_max_attempts:
        raise HTTPException(status_code=400, detail="This reset code is invalid or expired.")
    if not hmac.compare_digest(row["otp_hash"], hash_reset_otp(otp)):
        connection.execute("UPDATE password_reset_requests SET attempts = attempts + 1 WHERE token = %s", (reset_token,))
        connection.commit()
        raise HTTPException(status_code=400, detail="This reset code is invalid or expired.")
    connection.execute("UPDATE password_reset_requests SET verified_at = NOW() WHERE token = %s", (reset_token,))
    connection.commit()
    return row


@app.post("/api/v1/auth/password-reset/verify")
def verify_password_reset(request: PasswordResetOtpVerification, connection: psycopg.Connection = Depends(get_connection)):
    verify_reset_request(request.resetToken, request.otp, connection)
    return {"message": "Code verified. You can now choose a new password."}


@app.post("/api/v1/auth/password-reset/complete")
def complete_password_reset(request: PasswordResetCompletion, connection: psycopg.Connection = Depends(get_connection)):
    validate_account_password(request.newPassword)
    reset = verify_reset_request(request.resetToken, request.otp, connection)
    connection.execute(
        "UPDATE users SET password_hash = %s, token_version = token_version + 1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = %s",
        (hash_password(request.newPassword), reset["user_id"]),
    )
    connection.execute("DELETE FROM password_reset_requests WHERE token = %s", (request.resetToken,))
    connection.commit()
    return {"message": "Password updated. You can now sign in."}


@app.post("/api/v1/auth/login")
def login_user(credentials: UserLogin, connection: psycopg.Connection = Depends(get_connection)):
    row = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role, status, responder_type, responder_organization, responder_barangay, password_hash, token_version, failed_login_attempts, locked_until FROM users WHERE LOWER(email) = LOWER(%s)",
        (credentials.email.strip(),),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if row["locked_until"] and row["locked_until"] > datetime.now(UTC):
        raise HTTPException(status_code=423, detail="Too many failed login attempts. Try again in 15 minutes.")
    if not verify_password(credentials.password, row["password_hash"]):
        failed_attempts = row["failed_login_attempts"] + 1
        if failed_attempts >= MAX_LOGIN_ATTEMPTS:
            connection.execute(
                "UPDATE users SET failed_login_attempts = %s, locked_until = NOW() + (%s * INTERVAL '1 minute'), updated_at = NOW() WHERE id = %s",
                (failed_attempts, LOGIN_LOCKOUT_MINUTES, row["id"]),
            )
            connection.commit()
            raise HTTPException(status_code=423, detail="Too many failed login attempts. Try again in 15 minutes.")
        connection.execute("UPDATE users SET failed_login_attempts = %s, updated_at = NOW() WHERE id = %s", (failed_attempts, row["id"]))
        connection.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if row["status"] != "Active":
        if row["status"] == "Pending" and row["role"] == "Responder":
            raise HTTPException(status_code=403, detail="Your responder application is awaiting administrator approval.")
        raise HTTPException(status_code=403, detail="This account is not active. Contact your administrator.")
    if row["failed_login_attempts"] or row["locked_until"]:
        connection.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = %s", (row["id"],))
        connection.commit()
    role = normalize_role(row["role"])
    access_token, expires_in = create_access_token(row["id"], role, row["token_version"])
    profile = resident_profile_payload(row, household_members_for_user(connection, row["id"]))
    profile["role"] = role
    return {"accessToken": access_token, "tokenType": "bearer", "expiresIn": expires_in, "user": profile}


@app.get("/api/v1/auth/me")
def current_user(user: CurrentUser = Depends(get_current_user), connection: psycopg.Connection = Depends(get_connection)):
    row = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role, responder_type, responder_organization, responder_barangay FROM users WHERE id = %s",
        (user.id,),
    ).fetchone()
    return resident_profile_payload(row, household_members_for_user(connection, user.id))


@app.patch("/api/v1/auth/profile")
def update_current_profile(
    profile: SelfProfileUpdate,
    user: CurrentUser = Depends(get_current_user),
    connection: psycopg.Connection = Depends(get_connection),
):
    first_name = profile.firstName.strip()
    middle_name = (profile.middleName or "").strip() or None
    last_name = profile.lastName.strip()
    full_name = " ".join(part for part in (first_name, middle_name, last_name) if part)
    row = connection.execute(
        "UPDATE users SET name = %s, first_name = %s, middle_name = %s, last_name = %s, updated_at = NOW() WHERE id = %s RETURNING id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role",
        (full_name, first_name, middle_name, last_name, user.id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User account not found.")
    connection.commit()
    return resident_profile_payload(row, household_members_for_user(connection, user.id))


@app.patch("/api/v1/resident/household-members")
def update_resident_household_members(
    update: HouseholdMembersUpdate,
    resident: CurrentUser = Depends(require_roles("resident")),
    connection: psycopg.Connection = Depends(get_connection),
):
    try:
        connection.execute("DELETE FROM resident_household_members WHERE resident_user_id = %s", (resident.id,))
        for member in update.members:
            connection.execute(
                "INSERT INTO resident_household_members (id, resident_user_id, name, relationship) VALUES (%s, %s, %s, %s)",
                (f"resident-household-{uuid4()}", resident.id, member.name.strip(), member.relationship.strip()),
            )
        connection.commit()
    except psycopg.Error:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Household members could not be saved.") from None
    return {"members": household_members_for_user(connection, resident.id)}


@app.patch("/api/v1/resident/profile")
def update_resident_profile(
    profile: ResidentProfileUpdate,
    resident: CurrentUser = Depends(require_roles("resident")),
    connection: psycopg.Connection = Depends(get_connection),
):
    full_name = " ".join(part for part in (profile.firstName.strip(), (profile.middleName or "").strip(), profile.lastName.strip()) if part)
    connection.execute(
        "UPDATE users SET name = %s, first_name = %s, middle_name = %s, last_name = %s, birthday = %s, sex = %s, mobile_number = %s, current_address = %s, updated_at = NOW() WHERE id = %s",
        (full_name, profile.firstName.strip(), (profile.middleName or "").strip() or None, profile.lastName.strip(), profile.birthday, profile.sex, profile.mobileNumber, profile.currentAddress.strip(), resident.id),
    )
    connection.execute("DELETE FROM resident_household_members WHERE resident_user_id = %s", (resident.id,))
    for member in profile.members:
        connection.execute(
            "INSERT INTO resident_household_members (id, resident_user_id, name, relationship) VALUES (%s, %s, %s, %s)",
            (f"resident-household-{uuid4()}", resident.id, member.name.strip(), member.relationship.strip()),
        )
    connection.commit()
    row = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role FROM users WHERE id = %s",
        (resident.id,),
    ).fetchone()
    return resident_profile_payload(row, household_members_for_user(connection, resident.id))


@app.patch("/api/v1/resident/account")
def update_resident_account(
    account: ResidentAccountUpdate,
    user: CurrentUser = Depends(get_current_user),
    connection: psycopg.Connection = Depends(get_connection),
):
    if account.email is None and account.mobileNumber is None and account.newPassword is None:
        raise HTTPException(status_code=422, detail="Provide an email, contact number, or new password.")
    if (account.email is not None or account.newPassword is not None) and not account.currentPassword:
        raise HTTPException(status_code=422, detail="Your current password is required for email or password changes.")
    row = connection.execute("SELECT password_hash FROM users WHERE id = %s", (user.id,)).fetchone()
    if account.currentPassword and (not row or not verify_password(account.currentPassword, row["password_hash"])):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    if account.newPassword:
        validate_account_password(account.newPassword)
    assignments: list[str] = []
    values: list[object] = []
    if account.email is not None:
        assignments.append("email = %s")
        values.append(account.email.strip().lower())
    if account.mobileNumber is not None:
        assignments.append("mobile_number = %s")
        values.append(account.mobileNumber)
    if account.newPassword is not None:
        assignments.append("password_hash = %s")
        values.append(hash_password(account.newPassword))
    assignments.append("updated_at = NOW()")
    values.append(user.id)
    try:
        connection.execute(f"UPDATE users SET {', '.join(assignments)} WHERE id = %s", values)
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="That email address is already in use.") from error
    updated = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role FROM users WHERE id = %s",
        (user.id,),
    ).fetchone()
    return resident_profile_payload(updated, household_members_for_user(connection, user.id))


@app.post("/api/v1/auth/logout")
def logout_user(user: CurrentUser = Depends(get_current_user), connection: psycopg.Connection = Depends(get_connection)):
    connection.execute("UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = %s", (user.id,))
    connection.commit()
    return {"status": "signed_out"}


@app.get("/api/v1/disasters")
def list_disasters(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    rows = connection.execute(
        "SELECT id, name, description, severity, status, affected_areas, affected_barangays, started_at, created_at FROM disasters ORDER BY COALESCE(started_at, created_at) DESC"
    ).fetchall()
    return rows


@app.get("/api/v1/typhoons")
def list_live_typhoons(_: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    try:
        report = get_live_typhoon_report()
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail="Live tropical cyclone data is temporarily unavailable.") from error
    return report


@app.post("/api/v1/disasters", status_code=201)
def create_disaster(disaster: DisasterCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    disaster_id = f"disaster-{uuid4()}"
    connection.execute(
        """
        INSERT INTO disasters (id, name, description, severity, status, affected_areas, affected_barangays, started_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (disaster_id, disaster.name.strip(), disaster.description.strip(), disaster.severity, disaster.status, len(disaster.affectedBarangays) or disaster.affectedAreas, disaster.affectedBarangays, disaster.startedAt),
    )
    connection.commit()
    return {"id": disaster_id, "status": "accepted"}
