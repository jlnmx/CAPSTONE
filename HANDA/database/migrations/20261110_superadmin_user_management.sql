ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS users_one_superadmin_idx
  ON users (is_superadmin)
  WHERE is_superadmin;

UPDATE users
SET is_superadmin = TRUE
WHERE id = (
  SELECT id
  FROM users
  WHERE role = 'Administrator' AND status = 'Active'
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_superadmin = TRUE);
