import json
import hashlib
import hmac
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentUser, create_access_token, get_current_user, require_roles
from .config import settings
from .db import get_connection
from .schemas import CenterCreate, DisasterCreate, EvacueeCreate, EvacueeStatusUpdate, IncidentCreate, IncidentStatusUpdate, SyncBatch, UserLogin, UserRegistration


def normalize_id(value: str | None, prefix: str) -> str:
    return value or f"{prefix}-{uuid4()}"


def timestamp(value: datetime | None) -> datetime:
    return value or datetime.now(UTC)


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


def ensure_operational_schema() -> None:
    with psycopg.connect(settings.database_url) as connection:
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reported'")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS action_notes TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_by TEXT")
        connection.execute("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS evacuation_status TEXT NOT NULL DEFAULT 'registered'")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_by TEXT")
        connection.execute("ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0")
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


def ensure_default_admin() -> None:
    with psycopg.connect(settings.database_url) as connection:
        connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Administrator', 'Active')
            ON CONFLICT (email) DO NOTHING
            """,
            (
                'admin-001',
                'HANDA Administrator',
                'admin@handa.local',
                '1990-01-01',
                '+639171234567',
                'HANDA Development Environment',
                hash_password('admin123'),
            ),
        )
        connection.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_operational_schema()
    ensure_default_admin()
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
def sync_batch(batch: SyncBatch, connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
    results = []
    for event in batch.events:
        try:
            with connection.transaction():
                if event.entityType == "incident":
                    result = write_incident(connection, IncidentCreate.model_validate(event.payload))
                else:
                    result = write_evacuee(connection, EvacueeCreate.model_validate(event.payload))
            results.append(result)
        except (ValueError, psycopg.Error) as error:
            results.append({"status": "rejected", "entityType": event.entityType, "error": str(error)})
    return {"processed": len(results), "results": results}


@app.get("/api/v1/incidents")
def list_incidents(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("resident", "responder", "admin"))):
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
        update.status,
        update.actionNotes.strip(),
        incident_id,
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


@app.get("/api/v1/users")
def list_users(connection: psycopg.Connection = Depends(get_connection), _: CurrentUser = Depends(require_roles("admin"))):
    rows = connection.execute(
        "SELECT id, name, email, birthday, mobile_number, current_address, role, status, created_at, updated_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.post("/api/v1/users/register", status_code=201)
def register_user(registration: UserRegistration, connection: psycopg.Connection = Depends(get_connection)):
    if not any((char.isupper() for char in registration.password)) or not any((char.islower() for char in registration.password)) or not any((char.isdigit() for char in registration.password)) or not any((not char.isalnum() for char in registration.password)):
        raise HTTPException(status_code=422, detail="Password must include uppercase, lowercase, number, and symbol.")

    user_id = f"user-{uuid4()}"
    try:
        connection.execute(
            """
            INSERT INTO users
              (id, name, email, birthday, mobile_number, current_address, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Resident', 'Active')
            """,
            (
                user_id,
                f"{registration.firstName.strip()} {registration.lastName.strip()}",
                registration.email.strip().lower(),
                registration.birthday,
                registration.mobileNumber,
                registration.currentAddress.strip(),
                hash_password(registration.password),
            ),
        )
        connection.commit()
    except psycopg.errors.UniqueViolation as error:
        connection.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error

        access_token, expires_in = create_access_token(user_id, "resident", 0)
        return {
            "id": user_id,
            "status": "active",
            "message": "Registration completed.",
            "accessToken": access_token,
            "expiresIn": expires_in,
        }


@app.post("/api/v1/auth/login")
def login_user(credentials: UserLogin, connection: psycopg.Connection = Depends(get_connection)):
    row = connection.execute(
        "SELECT id, name, email, role, status, password_hash, token_version FROM users WHERE LOWER(email) = LOWER(%s)",
        (credentials.email.strip(),),
    ).fetchone()
    if not row or row["status"] != "Active" or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    access_token, expires_in = create_access_token(row["id"], row["role"].lower(), row["token_version"])
    return {"accessToken": access_token, "tokenType": "bearer", "expiresIn": expires_in, "user": {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"].lower()}}


@app.get("/api/v1/auth/me")
def current_user(user: CurrentUser = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


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
