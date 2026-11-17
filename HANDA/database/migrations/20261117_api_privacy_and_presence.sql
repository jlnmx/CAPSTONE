-- Keep application tables accessible through the API only; mobile and web clients
-- use the authenticated HANDA API and Supabase Realtime, not Supabase's table API.
-- Run as the database owner/project postgres role in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.responder_live_presence (
  responder_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy')),
  online_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  accuracy DOUBLE PRECISION,
  city TEXT,
  barangay TEXT,
  location_updated_at TIMESTAMPTZ,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE INDEX IF NOT EXISTS responder_live_presence_seen_idx
  ON public.responder_live_presence (last_seen DESC);

DO $$
BEGIN
  IF to_regrole('anon') IS NOT NULL AND to_regrole('authenticated') IS NOT NULL THEN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
  END IF;
END
$$;
