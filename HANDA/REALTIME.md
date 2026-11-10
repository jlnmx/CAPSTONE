# Supabase Realtime

Private Broadcast channels deliver database-driven events; Presence plus throttled Broadcast carry transient responder state. The app uses its own login, so the API mints a short-lived Supabase-compatible JWT.

## Auth flow

1. The client calls `POST /api/v1/realtime/token` with its normal HANDA bearer token (resident, responder or admin; demo users get none).
2. The API signs a JWT with the private key you imported into Supabase (`REALTIME_JWT_PRIVATE_KEY`, ES256 or RS256) and returns `{ token, expires_in }`. The key never leaves the server.
3. The client calls `supabase.realtime.setAuth(token)` before joining, and refreshes at 75% of the lifetime (`src/services/realtimeClient.ts`). A revoked HANDA session cannot mint new tokens; an issued token lives up to `REALTIME_TOKEN_MINUTES` (default 30).

Claims: `role=authenticated`, `aud=authenticated`, `sub=<public.users.id>` (text), `app_role=resident|responder|admin`, `iat`, `exp`; header `kid` = the imported key's id. The policies read `auth.jwt()->>'sub'` and `auth.jwt()->>'app_role'`, not `auth.uid()`.

## Channels

| Topic | Event | Payload | Who receives |
|---|---|---|---|
| `incidents:feed` | `incident_changed` | `{ op, incident: { id, type, severity, status, location, latitude, longitude, created_at, updated_at } }` (DELETE: id only) | resident, responder, admin |
| `evacuation_centers:feed` | `center_changed` | `{ op, center: { id, name, location, capacity, current_occupancy, status, latitude, longitude, updated_at } }` | resident, responder, admin |
| `user:<users.id>:notifications` | `notification_created` | `{ notification: { id, incident_id, title, message, created_at } }` | only that user (resident/responder) |
| `responders:live` | presence `{ availability, online_at }` (key = user id); broadcast `location` `{ user_id, latitude, longitude, accuracy?, ts }` | responders and admins read; only responders send |

Incident descriptions, photos, reporter ids, coordinator contacts and notification `user_id` are never broadcast. Responder locations are never written to the database; they exist only while the responder is online and fresh (60 s).

Known limit: `user_id` in location/presence payloads is supplied by the sending responder, so a malicious responder could impersonate another. Move location publishing behind the API if that matters.

## Setup (needs your approval)

1. Review and run `database/migrations/20261106_realtime_broadcast.sql` in the Supabase SQL Editor.
2. Dashboard > Realtime Settings: turn off **Allow public access** so only private channels work.
3. Set `REALTIME_JWT_PRIVATE_KEY` (private JWK as one JSON line, including `kid`) on the API host.
4. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public/publishable key only) for the app build, e.g. EAS environment variables. Set the same public values as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the administrator web app to sort responders by live location.

## Client hooks (`src/hooks/useRealtime.ts`)

`useIncidentFeed`, `useEvacuationCenterFeed`, `useNotificationStream`, `useResponderLive` (returns `responders`, `setAvailability`, `publishLocation`). Channels are private, retry with backoff and a fresh token, and close on unmount and logout. The hooks are wired into the resident incident feed, alerts, center status, notification bell, the responder dashboard, incident queue and the native responder live map (location publishing and live responder markers). The Command Center dispatch page also subscribes to responder presence and location; regular incident and roster polling remains as a fallback.
