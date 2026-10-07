CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  location_text TEXT NOT NULL,
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  photo_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_location_gix ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reported';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS action_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
UPDATE incidents SET status = 'reported' WHERE status IS NULL;

CREATE TABLE IF NOT EXISTS evacuees (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 150),
  sex TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  household_size INTEGER CHECK (household_size IS NULL OR household_size BETWEEN 1 AND 100),
  barangay TEXT,
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evacuees_location_gix ON evacuees USING GIST (location);
CREATE INDEX IF NOT EXISTS evacuees_barangay_idx ON evacuees (barangay);

ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS evacuation_status TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE evacuees ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
UPDATE evacuees SET evacuation_status = 'registered' WHERE evacuation_status IS NULL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT,
  last_name TEXT NOT NULL DEFAULT '',
  birthday DATE NOT NULL,
  sex TEXT NOT NULL DEFAULT '',
  mobile_number TEXT NOT NULL,
  current_address TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  role TEXT NOT NULL CHECK (role IN ('Responder', 'Resident', 'Administrator')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE users ALTER COLUMN current_address SET DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS resident_household_members (
  id TEXT PRIMARY KEY,
  resident_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resident_household_members_user_idx
  ON resident_household_members (resident_user_id);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS application_logs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('sync', 'audit')),
  action TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS application_logs_category_created_idx
  ON application_logs (category, created_at DESC);

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
);

CREATE INDEX IF NOT EXISTS disasters_status_idx ON disasters (status);
CREATE INDEX IF NOT EXISTS disasters_started_at_idx ON disasters (started_at DESC);

CREATE TABLE IF NOT EXISTS evacuation_centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location_text TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'full', 'closed')),
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evacuation_centers_status_idx ON evacuation_centers (status);

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
);

ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS age INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT '';
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE evacuation_registrations ADD COLUMN IF NOT EXISTS household_size INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS evacuation_registrations_one_active_per_resident_idx
  ON evacuation_registrations (resident_user_id)
  WHERE status <> 'released';
CREATE INDEX IF NOT EXISTS evacuation_registrations_center_status_idx
  ON evacuation_registrations (center_id, status);

CREATE TABLE IF NOT EXISTS evacuation_household_members (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES evacuation_registrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'evacuated', 'released')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evacuation_household_members_registration_idx
  ON evacuation_household_members (registration_id);

INSERT INTO evacuation_centers (id, name, location_text, capacity, current_occupancy, status, latitude, longitude)
VALUES
  ('center-poblacion', 'Barangay Poblacion Covered Court', 'Poblacion, Biñan, Laguna', 300, 0, 'available', 14.301, 121.082),
  ('center-multipurpose', 'Biñan City Multi-Purpose Hall', 'Biñan City, Laguna', 500, 0, 'available', 14.307, 121.071),
  ('center-school-gym', 'School Gymnasium', 'Biñan City, Laguna', 250, 0, 'available', 14.312, 121.089),
  ('center-timbao', 'Timbao Open Field', 'Timbao, Biñan, Laguna', 400, 0, 'available', 14.2864, 121.0942)
ON CONFLICT (id) DO NOTHING;
