BEGIN;

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS reporter_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS response_people TEXT NOT NULL DEFAULT '';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS response_organizations TEXT NOT NULL DEFAULT '';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS response_eta_minutes INTEGER;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS response_notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  incident_id TEXT REFERENCES public.incidents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

COMMIT;