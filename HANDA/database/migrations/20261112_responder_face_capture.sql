ALTER TABLE responder_verification_documents
  ADD COLUMN IF NOT EXISTS face_file_name TEXT,
  ADD COLUMN IF NOT EXISTS face_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS face_file_bytes BYTEA,
  ADD COLUMN IF NOT EXISTS face_consent_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responder_verification_face_mime_check'
  ) THEN
    ALTER TABLE responder_verification_documents
      ADD CONSTRAINT responder_verification_face_mime_check
      CHECK (face_mime_type IS NULL OR face_mime_type IN ('image/jpeg', 'image/png', 'image/webp'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responder_verification_face_fields_check'
  ) THEN
    ALTER TABLE responder_verification_documents
      ADD CONSTRAINT responder_verification_face_fields_check
      CHECK (
        (face_file_name IS NULL AND face_mime_type IS NULL AND face_file_bytes IS NULL)
        OR (face_file_name IS NOT NULL AND face_mime_type IS NOT NULL AND face_file_bytes IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'responder_verification_face_consent_check'
  ) THEN
    ALTER TABLE responder_verification_documents
      ADD CONSTRAINT responder_verification_face_consent_check
      CHECK (face_file_bytes IS NULL OR face_consent_at IS NOT NULL);
  END IF;
END $$;
