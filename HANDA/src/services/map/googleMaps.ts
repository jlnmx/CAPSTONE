import { authenticatedFetch } from '../apiClient';

export type MapCoordinate = { latitude: number; longitude: number };
export type MapTravelMode = 'DRIVE' | 'WALK' | 'TWO_WHEELER';

export type SearchedPlace = MapCoordinate & {
  id: string;
  name: string;
  address: string;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  startLocation?: MapCoordinate;
  endLocation?: MapCoordinate;
};

export type MapRoute = {
  id: number;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps: RouteStep[];
};

async function postMapRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
    const detail = typeof payload?.detail === 'string' ? payload.detail : `Map request failed (${response.status}).`;
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function searchMapPlaces(query: string): Promise<SearchedPlace[]> {
  const result = await postMapRequest<{ places: SearchedPlace[] }>('/api/v1/map/places/search', { query });
  return result.places;
}

export async function getMapRoutes(
  origin: MapCoordinate,
  destination: MapCoordinate,
  travelMode: MapTravelMode,
): Promise<MapRoute[]> {
  const result = await postMapRequest<{ routes: MapRoute[] }>('/api/v1/map/routes', {
    origin,
    destination,
    travelMode,
  });
  return result.routes;
}

export function decodeRoutePolyline(encoded: string): MapCoordinate[] {
  const points: MapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

export function distanceToRouteMeters(point: MapCoordinate, route: MapCoordinate[]): number {
  if (!route.length) return Number.POSITIVE_INFINITY;
  if (route.length === 1) return distanceMeters(point, route[0]);
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    minimum = Math.min(minimum, distanceToSegmentMeters(point, route[index - 1], route[index]));
  }
  return minimum;
}

export function getNearestRouteSegmentIndex(point: MapCoordinate, route: MapCoordinate[], startSegment = 0): number {
  if (route.length < 2) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  let closestSegment = 0;
  for (let index = Math.max(1, startSegment + 1); index < route.length; index += 1) {
    const projection = projectPointToSegment(point, route[index - 1], route[index]);
    if (projection.distance < minimum) {
      minimum = projection.distance;
      closestSegment = index - 1;
    }
  }
  return closestSegment;
}

export function getRemainingRouteCoordinates(
  point: MapCoordinate,
  route: MapCoordinate[],
  startSegment = 0,
): MapCoordinate[] {
  if (route.length < 2) return route;
  const segment = getNearestRouteSegmentIndex(point, route, startSegment);
  const projection = projectPointToSegment(point, route[segment], route[segment + 1]).coordinate;
  return [projection, ...route.slice(segment + 1)];
}

export function bearingDegrees(from: MapCoordinate, to: MapCoordinate): number {
  const radians = Math.PI / 180;
  const latitude1 = from.latitude * radians;
  const latitude2 = to.latitude * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function distanceMeters(a: MapCoordinate, b: MapCoordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const latitude1 = a.latitude * radians;
  const latitude2 = b.latitude * radians;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function distanceToSegmentMeters(point: MapCoordinate, start: MapCoordinate, end: MapCoordinate): number {
  return projectPointToSegment(point, start, end).distance;
}

function projectPointToSegment(
  point: MapCoordinate,
  start: MapCoordinate,
  end: MapCoordinate,
): { coordinate: MapCoordinate; distance: number } {
  const scale = Math.PI / 180 * 6_371_000;
  const referenceLatitude = point.latitude * Math.PI / 180;
  const project = (coordinate: MapCoordinate) => ({
    x: (coordinate.longitude - point.longitude) * scale * Math.cos(referenceLatitude),
    y: (coordinate.latitude - point.latitude) * scale,
  });
  const a = project(start);
  const b = project(end);
  const segmentX = b.x - a.x;
  const segmentY = b.y - a.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const fraction = lengthSquared
    ? Math.max(0, Math.min(1, -(a.x * segmentX + a.y * segmentY) / lengthSquared))
    : 0;
  const coordinate = {
    latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    longitude: start.longitude + (end.longitude - start.longitude) * fraction,
  };
  const projected = project(coordinate);
  return { coordinate, distance: Math.hypot(projected.x, projected.y) };
}
