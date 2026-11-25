DROP INDEX IF EXISTS users_one_superadmin_idx;

CREATE INDEX IF NOT EXISTS users_superadmin_idx
  ON users (id)
  WHERE is_superadmin;
