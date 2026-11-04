-- Response history timeline and on-scene responder photos for incidents.
CREATE TABLE IF NOT EXISTS incident_status_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_status_events_actor_idx ON incident_status_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS incident_status_events_incident_idx ON incident_status_events (incident_id, created_at);

CREATE TABLE IF NOT EXISTS incident_response_photos (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  responder_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  photo_uri TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_response_photos_incident_idx ON incident_response_photos (incident_id, created_at);
