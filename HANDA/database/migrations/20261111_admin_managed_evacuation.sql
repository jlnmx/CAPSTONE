-- Admin-managed households may be walk-in records without a linked Resident account.
ALTER TABLE evacuation_registrations
  ALTER COLUMN resident_user_id DROP NOT NULL;
