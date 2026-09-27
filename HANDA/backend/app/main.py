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

from .config import settings
from .db import get_connection
from .schemas import DisasterCreate, EvacueeCreate, IncidentCreate, SyncBatch, UserLogin, UserRegistration


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


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="HANDA API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(connection: psycopg.Connection = Depends(get_connection)):
    connection.execute("SELECT 1")
    return {"status": "ok", "database": "ok"}


@app.post("/api/v1/incidents", status_code=201)
def create_incident(incident: IncidentCreate, connection: psycopg.Connection = Depends(get_connection)):
    return write_incident(connection, incident)


@app.post("/api/v1/evacuees", status_code=201)
def create_evacuee(evacuee: EvacueeCreate, connection: psycopg.Connection = Depends(get_connection)):
    return write_evacuee(connection, evacuee)


@app.post("/api/v1/sync", status_code=207)
def sync_batch(batch: SyncBatch, connection: psycopg.Connection = Depends(get_connection)):
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
def list_incidents(connection: psycopg.Connection = Depends(get_connection)):
    rows = connection.execute(
        "SELECT id, type, description, severity, location_text AS location, latitude, longitude, photo_uris, created_at FROM incidents ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.get("/api/v1/evacuees")
def list_evacuees(connection: psycopg.Connection = Depends(get_connection)):
    rows = connection.execute(
        "SELECT id, first_name, middle_name, last_name, age, sex, contact_number, address, household_size, barangay, latitude, longitude, created_at FROM evacuees ORDER BY created_at DESC"
    ).fetchall()
    return rows


@app.get("/api/v1/users")
def list_users(connection: psycopg.Connection = Depends(get_connection)):
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

    return {"id": user_id, "status": "active", "message": "Registration completed."}


@app.post("/api/v1/auth/login")
def login_user(credentials: UserLogin, connection: psycopg.Connection = Depends(get_connection)):
    row = connection.execute(
        "SELECT id, name, email, role, status, password_hash FROM users WHERE LOWER(email) = LOWER(%s)",
        (credentials.email.strip(),),
    ).fetchone()
    if not row or row["status"] != "Active" or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"].lower()}


@app.get("/api/v1/disasters")
def list_disasters(connection: psycopg.Connection = Depends(get_connection)):
    rows = connection.execute(
        "SELECT id, name, description, severity, status, affected_areas, started_at, created_at FROM disasters ORDER BY COALESCE(started_at, created_at) DESC"
    ).fetchall()
    return rows


@app.post("/api/v1/disasters", status_code=201)
def create_disaster(disaster: DisasterCreate, connection: psycopg.Connection = Depends(get_connection)):
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
