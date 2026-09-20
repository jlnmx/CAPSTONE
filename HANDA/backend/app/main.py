import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import psycopg
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_connection
from .schemas import EvacueeCreate, IncidentCreate, SyncBatch


def normalize_id(value: str | None, prefix: str) -> str:
    return value or f"{prefix}-{uuid4()}"


def timestamp(value: datetime | None) -> datetime:
    return value or datetime.now(UTC)


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
