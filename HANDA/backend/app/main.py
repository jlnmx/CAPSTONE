import json
import hashlib
import hmac
import logging
import secrets
import smtplib
from email.message import EmailMessage
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentUser, create_access_token, get_current_user, normalize_role, require_roles
from .config import settings
from .db import get_connection
from .schemas import AdminUserCreate, AdminUserUpdate, CenterCreate, DisasterCreate, EvacuationRegistrationCreate, EvacuationRegistrationStatusUpdate, EvacueeCreate, EvacueeStatusUpdate, IncidentCreate, IncidentStatusUpdate, PasswordResetCompletion, PasswordResetOtpVerification, PasswordResetRequest, ResidentAccountUpdate, ResidentProfileUpdate, SyncBatch, UserLogin, UserRegistration

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


MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15


def write_incident(connection: psycopg.Connection, incident: IncidentCreate) -> dict:
    incident_id = normalize_id(incident.id, "incident")
    created_at = timestamp(incident.createdAt)
    connection.execute(
        """
        INSERT INTO incidents
          (id, type, description, severity, location_text, latitude, longitude,
           photo_uris, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          severity = EXCLUDED.severity,
          location_text = EXCLUDED.location_text,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          photo_uris = EXCLUDED.photo_uris
        """,
        incident_id,
        incident.type,
        incident.description,
        "medium" if incident.severity == "moderity" else incident.severity,
        incident.location,
        incident.latitude,
        incident.longitude,
        json.dumps(incident.photoUris),
        created_at,
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
    )
    return {"id": evacuee_id, "entityType": "evacuee", "status": "accepted"}


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
                    started_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """,
        )
        connection.execute("CREATE INDEX IF NOT EXISTS disasters_status_idx ON disasters (status)")
        connection.execute("CREATE INDEX IF NOT EXISTS disasters_started_at_idx ON disasters (started_at DESC)")


def ensure_operational_schema() -> None:
    with psycopg.connect(settings.database_url) as connection:
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reported'")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS action_notes TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_by TEXT")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ")
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
        connection.execute(
            """
            INSERT INTO evacuation_centers (id, name, location_text, capacity, current_occupancy, status, latitude, longitude)
            VALUES
              ('center-poblacion', 'Barangay Poblacion Covered Court', 'Poblacion, Biñan, Laguna', 300, 0, 'available', 14.301, 121.082),
              ('center-multipurpose', 'Biñan City Multi-Purpose Hall', 'Biñan City, Laguna', 500, 0, 'available', 14.307, 121.071),
              ('center-school-gym', 'School Gymnasium', 'Biñan City, Laguna', 250, 0, 'available', 14.312, 121.089),
              ('center-timbao', 'Timbao Open Field', 'Timbao, Biñan, Laguna', 400, 0, 'available', 14.2864, 121.0942)
            ON CONFLICT (id) DO NOTHING
            """,
        )
        connection.commit()


def ensure_default_users() -> None:
    with psycopg.connect(settings.database_url) as connection:
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
    ensure_operational_schema()
    ensure_default_users()
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
def health(connection: psycopg.Connection = Depends(get_connection)):
    connection.execute("SELECT 1")
    return {"status": "ok", "database": "ok"}


@app.post("/api/v1/incidents", status_code=201)
def create_incident(incident: IncidentCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    return write_incident(connection, incident)


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
                    result = write_incident(connection, IncidentCreate.model_validate(event.payload))
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
        "SELECT id, type, description, severity, location_text AS location, latitude, longitude, photo_uris, status, action_notes, verified_by, verified_at, created_at FROM incidents ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.patch("/api/v1/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, update: IncidentStatusUpdate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("responder", "admin"))):
    row = connection.execute(
        """
        UPDATE incidents
        SET status = %s, action_notes = %s, verified_at = NOW()
        WHERE id = %s
        RETURNING id, status, action_notes, verified_at
        """,
        (update.status, update.actionNotes.strip(), incident_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
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
        update.evacuationStatus,
        evacuee_id,
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evacuee not found.")
    connection.commit()
    return row


@app.get("/api/v1/centers")
def list_centers(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    return connection.execute(
        "SELECT id, name, location_text AS location, capacity, current_occupancy, status, latitude, longitude, updated_at FROM evacuation_centers ORDER BY name"
    ).fetchall()


@app.post("/api/v1/centers", status_code=201)
def create_center(center: CenterCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    center_id = f"center-{uuid4()}"
    row = connection.execute(
        """
        INSERT INTO evacuation_centers
          (id, name, location_text, capacity, current_occupancy, status, latitude, longitude)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, name, location_text AS location, capacity, current_occupancy, status, latitude, longitude, updated_at
        """,
        center_id,
        center.name.strip(),
        center.location.strip(),
        center.capacity,
        center.currentOccupancy,
        center.status,
        center.latitude,
        center.longitude,
    ).fetchone()
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
        return {
            "resident": {"id": resident.id, "name": resident.name, "status": "not_registered"},
            "registrationId": None,
            "status": "not_registered",
            "center": None,
            "registeredAt": None,
            "checkedInAt": None,
            "checkedInBy": None,
            "householdCount": 0,
            "evacuee": None,
            "members": [],
        }

    members = connection.execute(
        "SELECT id, name, relationship, status, updated_at FROM evacuation_household_members WHERE registration_id = %s ORDER BY name",
        (registration["id"],),
    ).fetchall()
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
        "householdCount": registration["household_size"],
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
        "SELECT id, status FROM evacuation_centers WHERE id = %s",
        (registration.centerId,),
    ).fetchone()
    if not center:
        raise HTTPException(status_code=404, detail="Evacuation center not found.")
    if center["status"] in ("closed", "full"):
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
        if center["status"] == "closed" or center["current_occupancy"] + household_count > center["capacity"]:
            raise HTTPException(status_code=409, detail="The evacuation center does not have enough available capacity for this household.")
        connection.execute(
            "UPDATE evacuation_centers SET current_occupancy = current_occupancy + %s, status = CASE WHEN current_occupancy + %s >= capacity THEN 'full' ELSE 'limited' END, updated_at = NOW() WHERE id = %s",
            (household_count, household_count, registration["center_id"]),
        )
    elif update.status == "released" and current_status in ("checked_in", "evacuated"):
        connection.execute(
            "UPDATE evacuation_centers SET current_occupancy = GREATEST(0, current_occupancy - %s), status = CASE WHEN status = 'closed' THEN 'closed' WHEN GREATEST(0, current_occupancy - %s) = 0 THEN 'available' ELSE 'limited' END, updated_at = NOW() WHERE id = %s",
            (household_count, household_count, registration["center_id"]),
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
        "SELECT id, name, email, birthday, mobile_number, current_address, role, status, created_at, updated_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return rows


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
    }


@app.post("/api/v1/users/register", status_code=201)
def register_user(registration: UserRegistration, connection: psycopg.Connection = Depends(get_connection)):
    if not any((char.isupper() for char in registration.password)) or not any((char.islower() for char in registration.password)) or not any((char.isdigit() for char in registration.password)) or not any((not char.isalnum() for char in registration.password)):
        raise HTTPException(status_code=422, detail="Password must include uppercase, lowercase, number, and symbol.")

    user_id = f"user-{uuid4()}"
    try:
        connection.execute(
            """
            INSERT INTO users
              (id, name, first_name, middle_name, last_name, email, birthday, mobile_number,
               current_address, sex, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Resident', 'Active')
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
            ),
        )
        for member in registration.members:
            connection.execute(
                "INSERT INTO resident_household_members (id, resident_user_id, name, relationship) VALUES (%s, %s, %s, %s)",
                (f"resident-household-{uuid4()}", user_id, member.name.strip(), member.relationship.strip()),
            )
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error

    access_token, expires_in = create_access_token(user_id, "resident", 0)
    row = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
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
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role, status, password_hash, token_version, failed_login_attempts, locked_until FROM users WHERE LOWER(email) = LOWER(%s)",
        (credentials.email.strip(),),
    ).fetchone()
    if not row or row["status"] != "Active":
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
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role FROM users WHERE id = %s",
        (user.id,),
    ).fetchone()
    return resident_profile_payload(row, household_members_for_user(connection, user.id))


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
    resident: CurrentUser = Depends(require_roles("resident")),
    connection: psycopg.Connection = Depends(get_connection),
):
    if account.email is None and account.mobileNumber is None and account.newPassword is None:
        raise HTTPException(status_code=422, detail="Provide an email, contact number, or new password.")
    if (account.email is not None or account.newPassword is not None) and not account.currentPassword:
        raise HTTPException(status_code=422, detail="Your current password is required for email or password changes.")
    row = connection.execute("SELECT password_hash FROM users WHERE id = %s", (resident.id,)).fetchone()
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
    values.append(resident.id)
    try:
        connection.execute(f"UPDATE users SET {', '.join(assignments)} WHERE id = %s", values)
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="That email address is already in use.") from error
    updated = connection.execute(
        "SELECT id, name, first_name, middle_name, last_name, email, birthday, sex, mobile_number, current_address, role FROM users WHERE id = %s",
        (resident.id,),
    ).fetchone()
    return resident_profile_payload(updated, household_members_for_user(connection, resident.id))


@app.post("/api/v1/auth/logout")
def logout_user(user: CurrentUser = Depends(get_current_user), connection: psycopg.Connection = Depends(get_connection)):
    connection.execute("UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = %s", (user.id,))
    connection.commit()
    return {"status": "signed_out"}


@app.get("/api/v1/disasters")
def list_disasters(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    rows = connection.execute(
        "SELECT id, name, description, severity, status, affected_areas, started_at, created_at FROM disasters ORDER BY COALESCE(started_at, created_at) DESC"
    ).fetchall()
    return rows


@app.post("/api/v1/disasters", status_code=201)
def create_disaster(disaster: DisasterCreate, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    disaster_id = f"disaster-{uuid4()}"
    connection.execute(
        """
        INSERT INTO disasters (id, name, description, severity, status, affected_areas, started_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (disaster_id, disaster.name.strip(), disaster.description.strip(), disaster.severity, disaster.status, disaster.affectedAreas, disaster.startedAt),
    )
    connection.commit()
    return {"id": disaster_id, "status": "accepted"}
