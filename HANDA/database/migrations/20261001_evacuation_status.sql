BEGIN;

CREATE TABLE IF NOT EXISTS public.evacuation_registrations (
  id TEXT PRIMARY KEY,
  resident_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  center_id TEXT NOT NULL REFERENCES public.evacuation_centers(id) ON DELETE RESTRICT,
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
  checked_in_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS age INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS sex TEXT NOT NULL DEFAULT '';
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.evacuation_registrations ADD COLUMN IF NOT EXISTS household_size INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS evacuation_registrations_one_active_per_resident_idx
  ON public.evacuation_registrations (resident_user_id)
  WHERE status <> 'released';
CREATE INDEX IF NOT EXISTS evacuation_registrations_center_status_idx
  ON public.evacuation_registrations (center_id, status);

CREATE TABLE IF NOT EXISTS public.evacuation_household_members (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES public.evacuation_registrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'evacuated', 'released')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evacuation_household_members_registration_idx
  ON public.evacuation_household_members (registration_id);

COMMIT;