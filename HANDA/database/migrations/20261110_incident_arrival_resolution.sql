-- Record responder arrival and incident resolution for response history.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS arrival_latitude DOUBLE PRECISION;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS arrival_longitude DOUBLE PRECISION;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

UPDATE incidents AS incident
SET arrived_at = first_scene_photo.created_at,
    arrival_latitude = COALESCE(incident.arrival_latitude, incident.latitude),
    arrival_longitude = COALESCE(incident.arrival_longitude, incident.longitude)
FROM (
  SELECT DISTINCT ON (photos.incident_id) photos.incident_id, photos.created_at
  FROM incident_response_photos AS photos
  JOIN users ON users.id = photos.responder_id
  WHERE users.role = 'Responder'
  ORDER BY photos.incident_id, photos.created_at
) AS first_scene_photo
WHERE incident.id = first_scene_photo.incident_id
  AND incident.arrived_at IS NULL;

UPDATE incidents
SET resolved_at = verified_at
WHERE status = 'resolved'
  AND resolved_at IS NULL
  AND verified_at IS NOT NULL;
