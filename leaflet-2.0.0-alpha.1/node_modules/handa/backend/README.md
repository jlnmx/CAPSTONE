# HANDA FastAPI Backend

The backend accepts the same `incident` and `evacuee` payloads created by the mobile SQLite outbox and exposes live responder operations.

## Local startup

From `HANDA/`:

```powershell
docker compose up --build
```

The API is available at `http://localhost:8000`. OpenAPI documentation is at `http://localhost:8000/docs`.

## Tests

Run the backend authorization tests from `backend/`:

```powershell
python -m unittest discover -s tests -v
```

## Supabase connection

Copy `backend/.env.example` to `backend/.env`, replace `[YOUR-PASSWORD]`, and start the API from the `backend/` directory:

```powershell
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Binding to `0.0.0.0` lets Expo Go on a phone reach the API over the same local network. Keep the phone and development computer on the same Wi-Fi network.

The connection string uses `sslmode=require` for Supabase. Before starting the API, run `database/init.sql` in the Supabase SQL Editor so the `incidents` and `evacuees` tables and PostGIS indexes exist.

When using Docker Compose, set `DATABASE_URL` in the shell before starting it; Compose will use that value instead of the local Postgres fallback:

```powershell
$env:DATABASE_URL = "postgresql://postgres:[YOUR-PASSWORD]@db.dvqgxrlkqdlqzsrqeqtb.supabase.co:5432/postgres?sslmode=require"
docker compose up --build api
```

Check the service:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Responder data is available from `/api/v1/disasters`, `/api/v1/incidents`, `/api/v1/evacuees`, and `/api/v1/centers`. Responders update incident action state with `PATCH /api/v1/incidents/{id}/status` and evacuation state with `PATCH /api/v1/evacuees/{id}/status`. The API applies the operational schema migration at startup for existing database volumes.

## Sync contract

Send pending SQLite outbox events in batches of up to 100. The server uses the client ID as the primary key and `ON CONFLICT` upserts, so retrying a batch is safe. A future mobile sync worker should mark an outbox row complete only when its corresponding result has `status: "accepted"`.

```json
{
  "events": [
    {
      "entityType": "incident",
      "operation": "create",
      "payload": {
        "id": "incident-123",
        "type": "Flooding",
        "description": "Water is entering the ground floor.",
        "severity": "high",
        "location": "Barangay Hall",
        "photoUris": [],
        "createdAt": "2026-09-20T10:00:00Z"
      }
    }
  ]
}
```

## Database

`database/init.sql` enables PostGIS and creates the `incidents` and `evacuees` tables. Latitude and longitude are stored as a PostGIS `GEOGRAPHY(POINT, 4326)` value when available, while the original human-readable location remains in `location_text`.
