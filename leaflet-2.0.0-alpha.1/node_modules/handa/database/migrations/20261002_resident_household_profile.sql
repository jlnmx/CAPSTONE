BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.resident_household_members (
  id TEXT PRIMARY KEY,
  resident_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS resident_household_members_user_idx
  ON public.resident_household_members (resident_user_id);

COMMIT;
