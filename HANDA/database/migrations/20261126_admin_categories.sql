ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_admin_category_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_admin_category_check
      CHECK (admin_category IS NULL OR admin_category IN ('BCDRRMO', 'CSWD'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_admin_category_role_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_admin_category_role_check
      CHECK (admin_category IS NULL OR role = 'Administrator');
  END IF;
END $$;

DROP POLICY IF EXISTS "handa_feeds_receive" ON realtime.messages;
CREATE POLICY "handa_feeds_receive" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (
    (SELECT realtime.topic()) = 'evacuation_centers:feed'
    AND (
      (SELECT auth.jwt() ->> 'app_role') IN ('resident', 'responder')
      OR (SELECT auth.jwt() ->> 'app_role') = 'admin'
        AND (
          (SELECT auth.jwt() ->> 'is_superadmin') = 'true'
          OR (SELECT auth.jwt() ->> 'admin_category') = 'CSWD'
        )
    )
    OR (SELECT realtime.topic()) = 'incidents:feed'
    AND (
      (SELECT auth.jwt() ->> 'app_role') = 'responder'
      OR (SELECT auth.jwt() ->> 'app_role') = 'admin'
        AND (
          (SELECT auth.jwt() ->> 'is_superadmin') = 'true'
          OR (SELECT auth.jwt() ->> 'admin_category') = 'BCDRRMO'
        )
    )
  )
);

DROP POLICY IF EXISTS "handa_responders_live_receive" ON realtime.messages;
CREATE POLICY "handa_responders_live_receive" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (SELECT realtime.topic()) = 'responders:live'
  AND (
    (SELECT auth.jwt() ->> 'app_role') = 'responder'
    OR (SELECT auth.jwt() ->> 'app_role') = 'admin'
      AND (
        (SELECT auth.jwt() ->> 'is_superadmin') = 'true'
        OR (SELECT auth.jwt() ->> 'admin_category') = 'BCDRRMO'
      )
  )
);
