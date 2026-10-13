ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_responder_type_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_responder_type_check
      CHECK (responder_type IS NULL OR responder_type IN ('Official', 'Volunteer'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS responder_verification_documents (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_bytes BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IS NULL OR decision IN ('approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT ''
);