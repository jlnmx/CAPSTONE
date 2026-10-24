ALTER TABLE users
  ADD COLUMN IF NOT EXISTS responder_organization TEXT,
  ADD COLUMN IF NOT EXISTS responder_barangay TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_responder_organization_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_responder_organization_check
      CHECK (responder_organization IS NULL OR responder_organization IN ('PNP', 'BFP', 'POSO', 'BCDRRMO', 'Barangay Responder'));
  END IF;
END $$;
