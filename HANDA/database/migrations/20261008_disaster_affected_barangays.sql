ALTER TABLE public.disasters
  ADD COLUMN IF NOT EXISTS affected_barangays TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.disasters
SET affected_barangays = '{}'
WHERE affected_barangays IS NULL;

COMMIT;
