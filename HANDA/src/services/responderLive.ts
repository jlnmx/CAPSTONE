/**
 * Pure helpers for transient responder presence/location. Nothing here is persisted.
 */

import type { ChannelLike } from './realtimeChannel';
import { LOCATION_EVENT, ResponderAvailability, ResponderLive, ResponderLocation, ResponderPresence } from './realtimeTopics';

export const LOCATION_MIN_INTERVAL_MS = 5000;
export const LOCATION_STALE_MS = 60_000;

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** Accepts only well-formed location payloads whose user_id is a presence key, dropping everything else. */
export function parseLocation(payload: unknown): ResponderLocation | null {
  const value = payload as Partial<ResponderLocation> | null;
  if (!value || typeof value.user_id !== 'string' || !isValidCoordinate(value.latitude, value.longitude)) return null;
  return {
    user_id: value.user_id,
    latitude: value.latitude as number,
    longitude: value.longitude as number,
    accuracy: typeof value.accuracy === 'number' ? value.accuracy : undefined,
    ts: typeof value.ts === 'number' ? value.ts : Date.now(),
  };
}

/** Online responders come from Presence; a location is shown only for an online responder and only while fresh. */
export function mergeResponderLive(
  presenceState: Record<string, Array<Partial<ResponderPresence>>>,
  locations: Record<string, ResponderLocation>,
  now = Date.now(),
): Record<string, ResponderLive> {
  const merged: Record<string, ResponderLive> = {};
  for (const [userId, metas] of Object.entries(presenceState)) {
    const meta = metas[metas.length - 1];
    if (!meta) continue;
    const location = locations[userId];
    merged[userId] = {
      user_id: userId,
      availability: meta.availability === 'busy' ? 'busy' : 'available',
      online_at: meta.online_at ?? '',
      location: location && now - location.ts <= LOCATION_STALE_MS ? location : undefined,
    };
  }
  return merged;
}

export function presencePayload(availability: ResponderAvailability, now = new Date()): ResponderPresence {
  return { availability, online_at: now.toISOString() };
}

export function createLocationPublisher(
  getChannel: () => ChannelLike | null,
  userId: string,
  now: () => number = Date.now,
  minIntervalMs = LOCATION_MIN_INTERVAL_MS,
) {
  let lastSentAt = 0;
  return (latitude: number, longitude: number, accuracy?: number): boolean => {
    const channel = getChannel();
    const timestamp = now();
    if (!channel || !isValidCoordinate(latitude, longitude) || timestamp - lastSentAt < minIntervalMs) return false;
    lastSentAt = timestamp;
    const payload: ResponderLocation = { user_id: userId, latitude, longitude, accuracy, ts: timestamp };
    void channel.send({ type: 'broadcast', event: LOCATION_EVENT, payload }).catch(() => undefined);
    return true;
  };
}
