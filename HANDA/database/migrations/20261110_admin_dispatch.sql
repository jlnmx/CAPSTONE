-- Admin-controlled responder dispatch and assignment history.
CREATE TABLE IF NOT EXISTS incident_responder_assignments (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  responder_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'released')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (incident_id, responder_id)
);
CREATE INDEX IF NOT EXISTS incident_responder_assignments_responder_idx
  ON incident_responder_assignments (responder_id, assigned_at DESC);
