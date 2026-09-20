# HANDA FastAPI Backend

The backend accepts the same `incident` and `evacuee` payloads created by the mobile SQLite outbox.

## Local startup

From `HANDA/`:

```powershell
docker compose up --build
```

The API is available at `http://localhost:8000`. OpenAPI documentation is at `http://localhost:8000/docs`.

Check the service:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

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
