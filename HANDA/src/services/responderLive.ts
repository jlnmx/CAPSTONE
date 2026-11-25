/**
 * Pure helpers for transient responder presence/location. Nothing here is persisted.
 */

import type { ChannelLike } from './realtimeChannel';
import { LOCATION_EVENT, ResponderAvailability, ResponderLive, ResponderLocation, ResponderPresence } from './realtimeTopics';
import { BINAN_HAZARD_AREAS } from './map/hazardAreas';
import { findBinanBarangay, isBinanCity } from '../utils/currentAddress';

export const LOCATION_MIN_INTERVAL_MS = 5000;
export const LOCATION_STALE_MS = 60_000;
export interface ResponderLocationArea {
  city?: string;
  barangay?: string;
}

type Coordinates = { latitude: number; longitude: number };

function cleanAreaName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 100);
  return cleaned || undefined;
}

function normalizeAreaName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsPoint(ring: number[][], point: Coordinates): boolean {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crossesLatitude = (currentLatitude > point.latitude) !== (previousLatitude > point.latitude);
    if (crossesLatitude
      && point.longitude < (previousLongitude - currentLongitude)
        * (point.latitude - currentLatitude) / (previousLatitude - currentLatitude)
        + currentLongitude) {
      inside = !inside;
    }
  }
  return inside;
}

function findBinanBarangayAtCoordinates(point?: Coordinates): string | undefined {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return undefined;
  for (const feature of BINAN_HAZARD_AREAS) {
    const [outerRing, ...holes] = feature.geometry.coordinates;
    if (containsPoint(outerRing, point) && !holes.some((ring) => containsPoint(ring, point))) {
      return findBinanBarangay(feature.properties.name);
    }
  }
  return undefined;
}

export function resolveResponderLocationArea(address?: {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
}, coordinates?: Coordinates): ResponderLocationArea {
  const city = cleanAreaName(address?.city) ?? cleanAreaName(address?.subregion);
  const isBinan = [address?.city, address?.subregion]
    .map(cleanAreaName)
    .some((value) => value !== undefined && normalizeAreaName(value).includes('binan'));
  const district = cleanAreaName(address?.district);
  const barangay = isBinan
    ? findBinanBarangayAtCoordinates(coordinates)
      ?? (district && !isBinanCity(district) ? findBinanBarangay(district) : undefined)
    : undefined;
  return {
    ...(city ? { city } : {}),
    ...(isBinan && barangay ? { barangay } : {}),
  };
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** Accepts only well-formed location payloads whose user_id is a presence key, dropping everything else. */
export function parseLocation(payload: unknown): ResponderLocation | null {
  const value = payload as Partial<ResponderLocation> | null;
  if (!value || typeof value.user_id !== 'string' || !isValidCoordinate(value.latitude, value.longitude)) return null;
  const city = cleanAreaName(value.city);
  const barangay = cleanAreaName(value.barangay);
  const isBinan = city !== undefined && normalizeAreaName(city).includes('binan');
  return {
    user_id: value.user_id,
    latitude: value.latitude as number,
    longitude: value.longitude as number,
    accuracy: typeof value.accuracy === 'number' && Number.isFinite(value.accuracy) ? value.accuracy : undefined,
    ...(city ? { city } : {}),
    ...(isBinan && barangay ? { barangay } : {}),
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
  return (latitude: number, longitude: number, accuracy?: number, area?: ResponderLocationArea): boolean => {
    const channel = getChannel();
    const timestamp = now();
    if (!channel || !isValidCoordinate(latitude, longitude) || timestamp - lastSentAt < minIntervalMs) return false;
    lastSentAt = timestamp;
    const city = cleanAreaName(area?.city);
    const barangay = cleanAreaName(area?.barangay);
    const payload: ResponderLocation = {
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      ...(city ? { city } : {}),
      ...(barangay ? { barangay } : {}),
      ts: timestamp,
    };
    void channel.send({ type: 'broadcast', event: LOCATION_EVENT, payload }).catch(() => undefined);
    return true;
  };
}
