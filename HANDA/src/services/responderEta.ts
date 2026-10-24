import * as Location from 'expo-location';

export type Coordinate = { latitude: number; longitude: number };
export type EtaEstimate = { minutes: number; source: 'route' | 'estimate' };

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const AVERAGE_SPEED_KMH = 30;
const ROAD_DETOUR_FACTOR = 1.35;
const REQUEST_TIMEOUT_MS = 6000;

export function haversineKm(from: Coordinate, to: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Straight-line fallback used only when no routed duration is available.
export function estimateTravelMinutes(from: Coordinate, to: Coordinate): number {
  return Math.max(1, Math.round((haversineKm(from, to) * ROAD_DETOUR_FACTOR / AVERAGE_SPEED_KMH) * 60));
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), milliseconds))]);
}

export async function getResponderPosition(): Promise<Coordinate | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

async function routedMinutes(from: Coordinate, to: Coordinate): Promise<number | null> {
  if (!mapboxToken) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false&access_token=${mapboxToken}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const result = await response.json() as { routes?: Array<{ duration?: number }> };
    const duration = result.routes?.[0]?.duration;
    return typeof duration === 'number' && Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60)) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Prefers the routed driving time (follows roads and traffic) and falls back to a distance-based estimate.
export async function estimateResponseEta(destination: Coordinate, origin?: Coordinate | null): Promise<EtaEstimate | null> {
  const from = origin ?? await getResponderPosition();
  if (!from) return null;
  const routed = await routedMinutes(from, destination);
  if (routed != null) return { minutes: routed, source: 'route' };
  return { minutes: estimateTravelMinutes(from, destination), source: 'estimate' };
}
