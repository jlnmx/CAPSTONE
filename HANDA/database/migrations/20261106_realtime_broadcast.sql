-- Supabase Realtime: private Broadcast channels and Presence authorization.
-- Review before applying; run in the Supabase SQL Editor. Idempotent.
--
-- Expected JWT claims (minted by POST /api/v1/realtime/token and signed with the imported signing key):
--   role = 'authenticated', aud = 'authenticated'
--   sub = public.users.id (text)
--   app_role = 'resident' | 'responder' | 'admin'
--
-- Topics:
--   incidents:feed                 broadcast (database -> clients), resident/responder/admin read
--   evacuation_centers:feed        broadcast (database -> clients), resident/responder/admin read
--   user:<users.id>:notifications  broadcast (database -> clients), only that user reads
--   responders:live                presence + broadcast 'location' (transient, never stored);
--                                  responders read/write, admins read only

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE EXCEPTION 'realtime.messages not found. Run this migration on the Supabase project, not a plain Postgres database.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.handa_broadcast_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.incidents;
  body jsonb;
BEGIN
  source := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  body := CASE
    WHEN TG_OP = 'DELETE' THEN jsonb_build_object('op', TG_OP, 'incident', jsonb_build_object('id', source.id))
    ELSE jsonb_build_object('op', TG_OP, 'incident', jsonb_build_object(
      'id', source.id,
      'type', source.type,
      'severity', source.severity,
      'status', source.status,
      'location', source.location_text,
      'latitude', source.latitude,
      'longitude', source.longitude,
      'created_at', source.created_at,
      'updated_at', source.updated_at
    ))
  END;
  PERFORM realtime.send(body, 'incident_changed', 'incidents:feed', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'incident broadcast failed: %', SQLERRM;
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.handa_broadcast_evacuation_center()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.evacuation_centers;
  body jsonb;
BEGIN
  source := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  body := CASE
    WHEN TG_OP = 'DELETE' THEN jsonb_build_object('op', TG_OP, 'center', jsonb_build_object('id', source.id))
    ELSE jsonb_build_object('op', TG_OP, 'center', jsonb_build_object(
      'id', source.id,
      'name', source.name,
      'location', source.location_text,
      'capacity', source.capacity,
      'current_occupancy', source.current_occupancy,
      'status', source.status,
      'latitude', source.latitude,
      'longitude', source.longitude,
      'updated_at', source.updated_at
    ))
  END;
  PERFORM realtime.send(body, 'center_changed', 'evacuation_centers:feed', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'evacuation center broadcast failed: %', SQLERRM;
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.handa_broadcast_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('notification', jsonb_build_object(
      'id', NEW.id,
      'incident_id', NEW.incident_id,
      'title', NEW.title,
      'message', NEW.message,
      'created_at', NEW.created_at
    )),
    'notification_created',
    'user:' || NEW.user_id || ':notifications',
    true
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification broadcast failed: %', SQLERRM;
  RETURN NULL;
END
$$;

REVOKE ALL ON FUNCTION public.handa_broadcast_incident() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handa_broadcast_evacuation_center() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handa_broadcast_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS handa_incidents_broadcast ON public.incidents;
CREATE TRIGGER handa_incidents_broadcast
AFTER INSERT OR DELETE OR UPDATE OF type, severity, status, location_text, latitude, longitude ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.handa_broadcast_incident();

DROP TRIGGER IF EXISTS handa_evacuation_centers_broadcast ON public.evacuation_centers;
CREATE TRIGGER handa_evacuation_centers_broadcast
AFTER INSERT OR DELETE OR UPDATE OF name, location_text, capacity, current_occupancy, status, latitude, longitude ON public.evacuation_centers
FOR EACH ROW EXECUTE FUNCTION public.handa_broadcast_evacuation_center();

DROP TRIGGER IF EXISTS handa_notifications_broadcast ON public.notifications;
CREATE TRIGGER handa_notifications_broadcast
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.handa_broadcast_notification();

DROP POLICY IF EXISTS "handa_feeds_receive" ON realtime.messages;
CREATE POLICY "handa_feeds_receive" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) IN ('incidents:feed', 'evacuation_centers:feed')
  AND (SELECT auth.jwt() ->> 'app_role') IN ('resident', 'responder', 'admin')
);

DROP POLICY IF EXISTS "handa_user_notifications_receive" ON realtime.messages;
CREATE POLICY "handa_user_notifications_receive" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT auth.jwt() ->> 'app_role') IN ('resident', 'responder')
  AND (SELECT realtime.topic()) = 'user:' || (SELECT auth.jwt() ->> 'sub') || ':notifications'
);

DROP POLICY IF EXISTS "handa_responders_live_receive" ON realtime.messages;
CREATE POLICY "handa_responders_live_receive" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (SELECT realtime.topic()) = 'responders:live'
  AND (SELECT auth.jwt() ->> 'app_role') IN ('responder', 'admin')
);

DROP POLICY IF EXISTS "handa_responders_live_send" ON realtime.messages;
CREATE POLICY "handa_responders_live_send" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (SELECT realtime.topic()) = 'responders:live'
  AND (SELECT auth.jwt() ->> 'app_role') = 'responder'
);
